import { callAI, type ChatMessage } from "@workspace/integrations-anthropic-ai";
import type { AgentResult } from "./types.js";

/** Strip markdown fences and extract the outermost JSON object */
export function extractJson(text: string): Record<string, unknown> {
  const stripped = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in AI response");

  return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
}

/** Normalise metric trend values coming from the AI */
export function normaliseTrend(
  t: unknown,
): "up" | "down" | "neutral" | null {
  if (t === "up" || t === "down" || t === "neutral") return t;
  return null;
}

/** Thin wrapper: call the AI and return a parsed AgentResult */
export async function runAnalysis(opts: {
  system: string;
  userMessage: string;
  target: string;
  type: string;
  chain: string | null;
}): Promise<AgentResult> {
  const messages: ChatMessage[] = [{ role: "user", content: opts.userMessage }];

  const text = await callAI({ system: opts.system, messages });
  const raw = extractJson(text);

  const riskScore = Number(raw.riskScore);
  const metrics = Array.isArray(raw.metrics)
    ? (raw.metrics as Array<Record<string, unknown>>).map((m) => ({
        label: String(m.label ?? ""),
        value: String(m.value ?? ""),
        trend: normaliseTrend(m.trend),
      }))
    : [];

  return {
    success: true,
    data: {
      target: opts.target,
      type: opts.type,
      chain: opts.chain,
      summary: String(raw.summary ?? ""),
      riskScore: Number.isFinite(riskScore)
        ? Math.min(100, Math.max(0, Math.round(riskScore)))
        : null,
      metrics,
      insights: Array.isArray(raw.insights)
        ? (raw.insights as unknown[]).map(String)
        : [],
      analyzedAt: new Date().toISOString(),
    },
  };
}
