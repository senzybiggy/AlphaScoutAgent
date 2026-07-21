/**
 * Core analysis service — shared by both the legacy /api/analyze route
 * and the versioned /api/v1/analyze/* endpoints.
 *
 * Orchestrates:
 *   1. Real on-chain data fetch (GoPlus, DexScreener, Moralis, Blockstream)
 *   2. AI call with enriched prompt
 *   3. JSON parse + validation
 *   4. Post-processing (attaches scan data to output)
 *   5. DB history save (non-blocking)
 */

import { callAI } from "@workspace/integrations-anthropic-ai";
import { db, scanHistory } from "@workspace/db";
import { logger } from "../lib/logger.js";
import type { AnalyzerInput, AnalyzerOutput, AnalyzerSection, WalletScanData, TokenScanData, ContractScanData } from "../routes/analyze/types.js";
import { walletAnalyzer } from "../routes/analyze/wallet.js";
import { tokenAnalyzer } from "../routes/analyze/token.js";
import { contractAnalyzer } from "../routes/analyze/contract.js";
import { projectAnalyzer } from "../routes/analyze/project.js";
import { scanWallet } from "./wallet-scanner.js";
import { scanToken } from "./token-scanner.js";
import { checkTokenSecurity } from "./goplus.js";

export interface AnalysisResult {
  target: string;
  type: string;
  chain: string | null;
  summary: string;
  riskScore: number;
  metrics: { label: string; value: string; trend: "up" | "down" | "neutral" | null }[];
  sections: AnalyzerSection[];
  insights: string[];
  analyzedAt: string;
  walletScan: WalletScanData | null;
  tokenScan: TokenScanData | null;
  contractScan: ContractScanData | null;
  recommendations: string[];
  smartMoneyScore: number | null;
  walletHealthScore: number | null;
}

const ANALYZERS = {
  wallet:   walletAnalyzer,
  token:    tokenAnalyzer,
  contract: contractAnalyzer,
  project:  projectAnalyzer,
} as const;

export type AnalyzeType = keyof typeof ANALYZERS;
export const VALID_TYPES = Object.keys(ANALYZERS) as AnalyzeType[];

// ── Parsing helpers ───────────────────────────────────────────────────────────

function parseTrend(v: unknown): "up" | "down" | "neutral" | null {
  return ["up", "down", "neutral"].includes(String(v)) ? (v as "up" | "down" | "neutral") : null;
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

export function parseAiOutput(text: string): AnalyzerOutput {
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
  const recommendations = Array.isArray(raw.recommendations)
    ? (raw.recommendations as unknown[]).map(String)
    : undefined;

  const output: AnalyzerOutput & Record<string, unknown> = {
    summary: String(raw.summary ?? "No summary available."),
    riskScore: Math.min(100, Math.max(0, Math.round(riskScore))),
    metrics,
    insights,
    sections,
    recommendations,
  };
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in output)) (output as Record<string, unknown>)[k] = v;
  }
  return output as AnalyzerOutput;
}

// ── Real data fetch ───────────────────────────────────────────────────────────

export async function fetchScanData(
  input: AnalyzerInput,
): Promise<WalletScanData | TokenScanData | ContractScanData | undefined> {
  try {
    if (input.type === "wallet") return await scanWallet(input.target, input.chain ?? null);
    if (input.type === "token")  return await scanToken(input.target, input.chain ?? null);
    if (input.type === "contract") {
      const sec = await checkTokenSecurity(input.target, input.chain ?? "ethereum");
      if (!sec) return undefined;
      return {
        dataSource: "goplus",
        fetchedAt: new Date().toISOString(),
        chainId: input.chain ?? null,
        security: sec,
        ownerAddress: sec.ownerAddress,
        totalSupply: sec.totalSupply,
        holderCount: sec.holderCount,
        recommendations: [],
      } satisfies ContractScanData;
    }
  } catch (err) {
    logger.warn({ err, type: input.type }, "fetchScanData failed — continuing without real data");
  }
  return undefined;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function analyzeTarget(input: AnalyzerInput): Promise<AnalysisResult> {
  const analyzer = ANALYZERS[input.type as AnalyzeType];
  if (!analyzer) throw new Error(`Unknown analysis type: "${input.type}"`);

  // Step 1: Real data (parallel-friendly — runs before AI call)
  const scanData = await fetchScanData(input);

  // Step 2: AI with enriched context
  const text = await callAI({
    system: analyzer.systemPrompt(input, scanData),
    messages: [{ role: "user", content: analyzer.userMessage(input, scanData) }],
  });

  // Step 3: Parse
  const parsed = parseAiOutput(text);

  // Step 4: Post-process
  analyzer.postProcess?.(parsed, input, scanData);

  // Step 5: Compose result
  const result: AnalysisResult = {
    target:            input.target,
    type:              input.type,
    chain:             input.chain ?? null,
    summary:           parsed.summary,
    riskScore:         parsed.riskScore,
    metrics:           parsed.metrics,
    sections:          parsed.sections,
    insights:          parsed.insights,
    analyzedAt:        new Date().toISOString(),
    walletScan:        parsed.walletScan        ?? null,
    tokenScan:         parsed.tokenScan         ?? null,
    contractScan:      parsed.contractScan      ?? null,
    recommendations:   parsed.recommendations   ?? [],
    smartMoneyScore:   parsed.smartMoneyScore    ?? null,
    walletHealthScore: parsed.walletHealthScore  ?? null,
  };

  // Step 6: Persist to history (non-blocking, fire-and-forget)
  db.insert(scanHistory)
    .values({
      target: input.target,
      type:   input.type,
      chain:  input.chain ?? null,
      result: result as unknown as Record<string, unknown>,
    })
    .catch((err) => logger.warn({ err }, "Failed to save scan history"));

  return result;
}
