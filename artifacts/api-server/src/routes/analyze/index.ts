import { Router } from "express";
import { callAI } from "@workspace/integrations-anthropic-ai";
import { db, scanHistory } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import type { AnalyzerInput, AnalyzerOutput, AnalyzerSection, WalletScanData, TokenScanData, ContractScanData } from "./types.js";
import { walletAnalyzer } from "./wallet.js";
import { tokenAnalyzer } from "./token.js";
import { contractAnalyzer } from "./contract.js";
import { projectAnalyzer } from "./project.js";
import { scanWallet } from "../../services/wallet-scanner.js";
import { scanToken } from "../../services/token-scanner.js";
import { checkTokenSecurity } from "../../services/goplus.js";

const router = Router();

const ANALYZERS = {
  wallet: walletAnalyzer,
  token: tokenAnalyzer,
  contract: contractAnalyzer,
  project: projectAnalyzer,
} as const;

type AnalyzeType = keyof typeof ANALYZERS;
const VALID_TYPES = Object.keys(ANALYZERS) as AnalyzeType[];

function parseTrend(v: unknown): "up" | "down" | "neutral" | null {
  return ["up", "down", "neutral"].includes(String(v))
    ? (v as "up" | "down" | "neutral")
    : null;
}

function parseSections(raw: unknown): AnalyzerSection[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((s) => ({
    title: String(s.title ?? ""),
    items: Array.isArray(s.items)
      ? (s.items as Array<Record<string, unknown>>).map((item) => ({
          label: String(item.label ?? ""),
          value: String(item.value ?? ""),
          trend: parseTrend(item.trend),
        }))
      : [],
  }));
}

function parseAiOutput(text: string): AnalyzerOutput {
  const stripped = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");

  const raw = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;

  const riskScore = Number(raw.riskScore);
  if (!Number.isFinite(riskScore)) throw new Error("Invalid riskScore in AI response");

  const metrics = Array.isArray(raw.metrics)
    ? (raw.metrics as Array<Record<string, unknown>>).map((m) => ({
        label: String(m.label ?? ""),
        value: String(m.value ?? ""),
        trend: parseTrend(m.trend),
      }))
    : [];

  const insights = Array.isArray(raw.insights) ? (raw.insights as unknown[]).map(String) : [];
  const sections = parseSections(raw.sections);
  const recommendations = Array.isArray(raw.recommendations) ? (raw.recommendations as unknown[]).map(String) : undefined;

  // Pass extended fields through for postProcess to pick up
  const output: AnalyzerOutput & Record<string, unknown> = {
    summary: String(raw.summary ?? "No summary available."),
    riskScore: Math.min(100, Math.max(0, Math.round(riskScore))),
    metrics,
    insights,
    sections,
    recommendations,
  };
  // Copy all raw fields so postProcess can access smartMoneyScore, walletLabels, etc.
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in output)) (output as Record<string, unknown>)[k] = v;
  }
  return output as AnalyzerOutput;
}

// ── Fetch real blockchain data before AI ─────────────────────────────────────

async function fetchScanData(
  input: AnalyzerInput,
): Promise<WalletScanData | TokenScanData | ContractScanData | undefined> {
  try {
    if (input.type === "wallet") {
      return await scanWallet(input.target, input.chain ?? null);
    }
    if (input.type === "token") {
      return await scanToken(input.target, input.chain ?? null);
    }
    if (input.type === "contract") {
      const sec = await checkTokenSecurity(input.target, input.chain ?? "ethereum");
      if (!sec) return undefined;
      const cs: ContractScanData = {
        dataSource: "goplus",
        fetchedAt: new Date().toISOString(),
        chainId: input.chain ?? null,
        security: sec,
        ownerAddress: sec.ownerAddress,
        totalSupply: sec.totalSupply,
        holderCount: sec.holderCount,
        recommendations: [],
      };
      return cs;
    }
  } catch (err) {
    logger.warn({ err, type: input.type }, "fetchScanData failed — continuing without real data");
  }
  return undefined;
}

// ── History endpoint ─────────────────────────────────────────────────────────

router.get("/history", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: scanHistory.id,
        target: scanHistory.target,
        type: scanHistory.type,
        chain: scanHistory.chain,
        scannedAt: scanHistory.scannedAt,
      })
      .from(scanHistory)
      .orderBy(scanHistory.scannedAt)
      .limit(50);
    // Return newest first
    res.json(rows.reverse());
  } catch (err) {
    logger.error({ err }, "Failed to fetch scan history");
    res.json([]);
  }
});

router.get("/history/:id", async (req, res) => {
  try {
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(scanHistory)
      .where(eq(scanHistory.id, parseInt(req.params.id, 10)))
      .limit(1);
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "Failed to fetch scan history item");
    res.status(500).json({ error: "Failed to load history item" });
  }
});

// ── Scan chat endpoint ───────────────────────────────────────────────────────

router.post("/chat", async (req, res) => {
  const { message, context } = req.body as { message?: string; context?: string };
  if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

  try {
    const system = `You are AlphaScout AI Copilot, an expert blockchain analyst.
You have access to the following scan result as context:

${context ?? "No scan context provided."}

Answer the user's question based ONLY on this context. If data is unavailable, say so.
Be concise, specific, and cite actual numbers from the scan data when relevant.
Never make up data not present in the context.`;

    const reply = await callAI({
      system,
      messages: [{ role: "user", content: message.trim() }],
    });
    res.json({ reply: reply.trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Scan chat error");
    res.status(500).json({ error: msg });
  }
});

// ── Main analyze endpoint ────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const { target, type, chain } = req.body as Partial<AnalyzerInput>;

  if (!target?.trim()) { res.status(400).json({ error: "target is required" }); return; }
  if (!type || !VALID_TYPES.includes(type as AnalyzeType)) {
    res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
    return;
  }

  const input: AnalyzerInput = {
    target: target.trim(),
    type: type as AnalyzeType,
    chain: chain?.trim() || undefined,
  };

  const analyzer = ANALYZERS[input.type as AnalyzeType];

  try {
    // Step 1: Fetch real blockchain data (runs in parallel with AI prompt prep)
    const scanData = await fetchScanData(input);

    // Step 2: Call AI with real data context
    const text = await callAI({
      system: analyzer.systemPrompt(input, scanData),
      messages: [{ role: "user", content: analyzer.userMessage(input, scanData) }],
    });

    // Step 3: Parse AI output
    let parsed: AnalyzerOutput;
    try {
      parsed = parseAiOutput(text);
    } catch (parseErr) {
      req.log.error({ parseErr, raw: text.slice(0, 500) }, "Failed to parse AI output");
      res.status(502).json({ error: "AI response could not be parsed. Please try again." });
      return;
    }

    // Step 4: Post-process (attaches scan data to output)
    analyzer.postProcess?.(parsed, input, scanData);

    // Step 5: Build response
    const response = {
      target: input.target,
      type: input.type,
      chain: input.chain ?? null,
      summary: parsed.summary,
      riskScore: parsed.riskScore,
      metrics: parsed.metrics,
      sections: parsed.sections,
      insights: parsed.insights,
      analyzedAt: new Date().toISOString(),
      // Rich scan data
      walletScan: parsed.walletScan ?? null,
      tokenScan: parsed.tokenScan ?? null,
      contractScan: parsed.contractScan ?? null,
      recommendations: parsed.recommendations ?? [],
      smartMoneyScore: parsed.smartMoneyScore ?? null,
      walletHealthScore: parsed.walletHealthScore ?? null,
    };

    // Step 6: Save to history (non-blocking)
    db.insert(scanHistory)
      .values({ target: input.target, type: input.type, chain: input.chain ?? null, result: response })
      .catch((err) => logger.warn({ err }, "Failed to save scan history"));

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Analyze route error");

    if (message.includes("rate_limit") || message.includes("429")) {
      res.status(429).json({ error: "AI rate limit reached. Please wait a moment and try again." });
      return;
    }
    if (message.includes("402") || message.toLowerCase().includes("insufficient credits") || message.toLowerCase().includes("payment")) {
      res.status(402).json({ error: "AI provider account has insufficient credits. Please top up your OpenRouter balance." });
      return;
    }
    if (message.includes("401") || message.includes("invalid_api_key") || message.includes("authentication")) {
      res.status(401).json({ error: "AI API key is invalid or missing. Check your ANTHROPIC_API_KEY environment variable." });
      return;
    }
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
