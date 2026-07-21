import { Router } from "express";
import { callAI } from "@workspace/integrations-anthropic-ai";
import { logger } from "../../lib/logger.js";
import type { AnalyzerInput, AnalyzerOutput, AnalyzerSection } from "./types.js";
import { walletAnalyzer } from "./wallet.js";
import { tokenAnalyzer } from "./token.js";
import { contractAnalyzer } from "./contract.js";
import { projectAnalyzer } from "./project.js";

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
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in AI response");
  }

  const raw = JSON.parse(stripped.slice(start, end + 1)) as Record<
    string,
    unknown
  >;

  const riskScore = Number(raw.riskScore);
  if (!Number.isFinite(riskScore)) {
    throw new Error("Invalid riskScore in AI response");
  }

  // Legacy flat metrics — kept for backward compat but new prompts return []
  const metrics = Array.isArray(raw.metrics)
    ? (raw.metrics as Array<Record<string, unknown>>).map((m) => ({
        label: String(m.label ?? ""),
        value: String(m.value ?? ""),
        trend: parseTrend(m.trend),
      }))
    : [];

  const insights = Array.isArray(raw.insights)
    ? (raw.insights as unknown[]).map(String)
    : [];

  const sections = parseSections(raw.sections);

  return {
    summary: String(raw.summary ?? "No summary available."),
    riskScore: Math.min(100, Math.max(0, Math.round(riskScore))),
    metrics,
    insights,
    sections,
  };
}

// POST /api/analyze
router.post("/", async (req, res) => {
  const { target, type, chain } = req.body as Partial<AnalyzerInput>;

  if (!target?.trim()) {
    res.status(400).json({ error: "target is required" });
    return;
  }

  if (!type || !VALID_TYPES.includes(type as AnalyzeType)) {
    res.status(400).json({
      error: `type must be one of: ${VALID_TYPES.join(", ")}`,
    });
    return;
  }

  const input: AnalyzerInput = {
    target: target.trim(),
    type: type as AnalyzeType,
    chain: chain?.trim() || undefined,
  };

  const analyzer = ANALYZERS[input.type as AnalyzeType];

  try {
    const text = await callAI({
      system: analyzer.systemPrompt(input),
      messages: [{ role: "user", content: analyzer.userMessage(input) }],
    });

    let parsed: AnalyzerOutput;
    try {
      parsed = parseAiOutput(text);
    } catch (parseErr) {
      req.log.error(
        { parseErr, raw: text.slice(0, 500) },
        "Failed to parse AI output",
      );
      res
        .status(502)
        .json({ error: "AI response could not be parsed. Please try again." });
      return;
    }

    analyzer.postProcess?.(parsed, input);

    res.json({
      target: input.target,
      type: input.type,
      chain: input.chain ?? null,
      summary: parsed.summary,
      riskScore: parsed.riskScore,
      metrics: parsed.metrics,
      sections: parsed.sections,
      insights: parsed.insights,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Analyze route error");

    if (message.includes("rate_limit") || message.includes("429")) {
      res.status(429).json({ error: "AI rate limit reached. Please wait a moment and try again." });
      return;
    }

    if (message.includes("402") || message.toLowerCase().includes("insufficient credits") || message.toLowerCase().includes("payment")) {
      res.status(402).json({ error: "AI provider account has insufficient credits. Please top up your OpenRouter balance at openrouter.ai/settings/credits, then try again." });
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
