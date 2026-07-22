/**
 * Legacy /api/analyze route — kept for UI backward compatibility.
 *
 * Delegates all heavy lifting to services/analyze-service.ts,
 * which is also used by the versioned /api/v1/analyze/* endpoints.
 */

import { Router } from "express";
import { callAI } from "@workspace/integrations-anthropic-ai";
import { db, scanHistory } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { analyzeTarget, VALID_TYPES } from "../../services/analyze-service.js";
import type { AnalyzerInput } from "./types.js";
import { analysisLimiter } from "../../middlewares/rate-limit.js";

const router = Router();

type AnalyzeType = (typeof VALID_TYPES)[number];

// ── History ──────────────────────────────────────────────────────────────────

router.get("/history", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id:        scanHistory.id,
        target:    scanHistory.target,
        type:      scanHistory.type,
        chain:     scanHistory.chain,
        scannedAt: scanHistory.scannedAt,
      })
      .from(scanHistory)
      .orderBy(scanHistory.scannedAt)
      .limit(50);
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

// ── AI Copilot chat ──────────────────────────────────────────────────────────

router.post("/chat", async (req, res) => {
  const { message, context, history } = req.body as {
    message?: string;
    context?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };
  if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

  try {
    const system = `You are AlphaScout AI Copilot, an expert blockchain analyst and on-chain intelligence engine.
You have access to the following scan result as context:

${context ?? "No scan context provided."}

INSTRUCTIONS:
- Answer based ONLY on this context and the conversation history. If data is unavailable, say so explicitly.
- Be concise, specific, and cite actual numbers when relevant.
- Never invent data not present in the context.
- Use bullet points for lists. Keep answers under 200 words unless the user asks for detail.
- For risk questions, always reference the riskScore and specific security flags.
- For wallet questions, reference on-chain metrics like txCount, nativeBalance, walletHealthScore.`;

    // Build conversation messages including history
    const priorMessages: { role: "user" | "assistant"; content: string }[] = (history ?? [])
      .slice(-10) // last 10 messages for context window efficiency
      .map((m) => ({ role: m.role, content: m.content }));

    const allMessages = [
      ...priorMessages,
      { role: "user" as const, content: message.trim() },
    ];

    const reply = await callAI({ system, messages: allMessages });
    res.json({ reply: reply.trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Scan chat error");
    res.status(500).json({ error: msg });
  }
});

// ── Main analyze endpoint ────────────────────────────────────────────────────

router.post("/", analysisLimiter, async (req, res) => {
  const { target, type, chain } = req.body as Partial<AnalyzerInput>;

  if (!target?.trim()) {
    res.status(400).json({ error: "target is required" });
    return;
  }
  if (!type || !(VALID_TYPES as string[]).includes(type)) {
    res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
    return;
  }

  const input: AnalyzerInput = {
    target: target.trim(),
    type:   type as AnalyzeType,
    chain:  chain?.trim() || undefined,
  };

  try {
    const result = await analyzeTarget(input);
    res.json(result);
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
