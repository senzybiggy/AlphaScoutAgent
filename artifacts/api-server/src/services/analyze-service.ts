/**
 * Core analysis service — shared by both the legacy /api/analyze route
 * and the versioned /api/v1/analyze/* endpoints.
 *
 * Orchestrates:
 *   1. Real on-chain data fetch (multi-provider with verified fallback chain)
 *   2. Programmatic Data Quality + Reliability scoring
 *   3. DATA_UNAVAILABLE gate (returns error result without AI call if below threshold)
 *   4. AI call with enriched prompt and capped confidence score
 *   5. JSON parse + validation
 *   6. Post-processing (attaches scan data + quality scores to output)
 *   7. DB history save (non-blocking)
 */

import { callAI } from "@workspace/integrations-anthropic-ai";
import { db, scanHistory } from "@workspace/db";
import { logger } from "../lib/logger.js";
import type {
  AnalyzerInput, AnalyzerOutput, AnalyzerSection, AnalyzerMeta,
  WalletScanData, TokenScanData, ContractScanData, ProjectScanData,
  ProviderAttempt,
} from "../routes/analyze/types.js";
import { walletAnalyzer }   from "../routes/analyze/wallet.js";
import { tokenAnalyzer }    from "../routes/analyze/token.js";
import { contractAnalyzer } from "../routes/analyze/contract.js";
import { projectAnalyzer, fetchProjectScanData } from "../routes/analyze/project.js";
import { scanWallet }    from "./wallet-scanner.js";
import type { WalletScanResult } from "./wallet-scanner.js";
import { scanToken }     from "./token-scanner.js";
import type { TokenScanResult } from "./token-scanner.js";
import { checkTokenSecurity } from "./goplus.js";
import { scoreData, DATA_QUALITY_THRESHOLDS } from "./data-quality.js";
import { detectEntityType } from "./type-detector.js";

export interface AnalysisResult {
  target: string;
  type: string;
  chain: string | null;
  summary: string;
  riskScore: number | null;
  metrics: { label: string; value: string; trend: "up" | "down" | "neutral" | null }[];
  sections: AnalyzerSection[];
  insights: string[];
  analyzedAt: string;
  walletScan: WalletScanData | null;
  tokenScan: TokenScanData | null;
  contractScan: ContractScanData | null;
  projectScan: ProjectScanData | null;
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  confidenceScore: number | null;
  smartMoneyScore: number | null;
  walletHealthScore: number | null;
  // Verified data quality fields
  dataQualityScore: number;
  reliabilityScore: number;
  providerAttempts: ProviderAttempt[];
  fieldSources: Record<string, string>;
  isDataUnavailable?: boolean;
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

  const insights = Array.isArray(raw.insights)
    ? (raw.insights as unknown[]).map(String)
    : (Array.isArray(raw.keyFindings) ? (raw.keyFindings as unknown[]).map(String) : []);

  const sections         = parseSections(raw.sections);
  const recommendations  = Array.isArray(raw.recommendations) ? (raw.recommendations as unknown[]).map(String) : undefined;
  const risks            = Array.isArray(raw.risks) ? (raw.risks as unknown[]).map(String) : undefined;
  const opportunities    = Array.isArray(raw.opportunities) ? (raw.opportunities as unknown[]).map(String) : undefined;
  const confidenceScore  = typeof raw.confidenceScore === "number"
    ? Math.min(100, Math.max(0, Math.round(raw.confidenceScore)))
    : undefined;

  const output: AnalyzerOutput & Record<string, unknown> = {
    summary: String(raw.executiveSummary ?? raw.summary ?? "No summary available."),
    riskScore: Math.min(100, Math.max(0, Math.round(riskScore))),
    metrics, insights, sections, recommendations, risks, opportunities, confidenceScore,
  };
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in output)) (output as Record<string, unknown>)[k] = v;
  }
  return output as AnalyzerOutput;
}

// ── Real data fetch ───────────────────────────────────────────────────────────

interface ScanResult {
  scanData: WalletScanData | TokenScanData | ContractScanData | ProjectScanData | null;
  providerAttempts: ProviderAttempt[];
}

export async function fetchScanData(input: AnalyzerInput): Promise<ScanResult> {
  try {
    if (input.type === "wallet") {
      const { data: walletScan, attempts } = await scanWallet(input.target, input.chain ?? null);
      return { scanData: walletScan, providerAttempts: attempts };
    }

    if (input.type === "token") {
      const { data: tokenScan, attempts } = await scanToken(input.target, input.chain ?? null);
      return { scanData: tokenScan, providerAttempts: attempts };
    }

    if (input.type === "contract") {
      const sec = await checkTokenSecurity(input.target, input.chain ?? "ethereum");
      const attempts: ProviderAttempt[] = [{
        provider: "GoPlus", category: "contractSecurity",
        status: sec ? "success" : "failed",
        error: sec ? null : "GoPlus returned no security data",
        latencyMs: 0,
      }];
      if (!sec) return { scanData: null, providerAttempts: attempts };

      // Adapt GoPlusTokenSecurity to the full TokenSecurity interface
      const contractSecurity: import("../routes/analyze/types.js").TokenSecurity = {
        isHoneypot:       sec.isHoneypot,
        buyTax:           sec.buyTax,
        sellTax:          sec.sellTax,
        isOpenSource:     sec.isOpenSource,
        isMintable:       sec.isMintable,
        hasBlacklist:     sec.hasBlacklist,
        hasHiddenOwner:   sec.hasHiddenOwner,
        ownerCanTakeBack: sec.ownerCanTakeBack,
        cannotSellAll:    sec.cannotSellAll,
        transferPausable: sec.transferPausable,
        isProxy:          sec.isProxy,
        hasSelfDestruct:  sec.hasSelfDestruct,
        hasExternalCalls: null,
        isAntiWhale:      sec.isAntiWhale ?? null,
        ownerAddress:     sec.ownerAddress,
        creatorAddress:   sec.creatorAddress,
        creatorHoldPct:   null,
        ownerHoldPct:     null,
        lpHolderCount:    null,
        lpTopHolderPct:   null,
        isInDex:          sec.dexPairs?.length > 0,
        overallRisk:      sec.overallRisk,
      };

      const contractScan: ContractScanData = {
        dataSource: "goplus",
        fetchedAt: new Date().toISOString(),
        chainId: input.chain ?? null,
        security: contractSecurity,
        ownerAddress: sec.ownerAddress,
        totalSupply: sec.totalSupply,
        holderCount: sec.holderCount,
        recommendations: [],
        providerAttempts: attempts,
        fieldSources: {
          honeypotCheck: "GoPlus", sourceVerification: "GoPlus",
          ownership: "GoPlus", mintable: "GoPlus", blacklist: "GoPlus",
        },
      };
      return { scanData: contractScan, providerAttempts: attempts };
    }

    if (input.type === "project") {
      const projectScan = await fetchProjectScanData(input);
      return { scanData: projectScan ?? null, providerAttempts: [] };
    }
  } catch (err) {
    logger.warn({ err, type: input.type }, "fetchScanData failed — continuing without real data");
  }
  return { scanData: null, providerAttempts: [] };
}

// ── DATA_UNAVAILABLE result builder ──────────────────────────────────────────

function buildUnavailableResult(
  input: AnalyzerInput,
  providerAttempts: ProviderAttempt[],
  dataQualityScore: number,
  reliabilityScore: number,
  missingFields: string[],
): AnalysisResult {
  const failed = providerAttempts.filter((a) => a.status === "failed");
  const skipped = providerAttempts.filter((a) => a.status === "skipped");

  const summary = [
    "Data unavailable from providers.",
    failed.length > 0
      ? `Failed: ${failed.map((a) => `${a.provider} (${a.error ?? "no data"})`).join("; ")}.`
      : "",
    skipped.length > 0
      ? `Skipped (no API key): ${skipped.map((a) => a.provider).join(", ")}.`
      : "",
    missingFields.length > 0
      ? `Missing: ${missingFields.join(", ")}.`
      : "",
  ].filter(Boolean).join(" ");

  return {
    target: input.target, type: input.type, chain: input.chain ?? null,
    summary,
    riskScore: null, metrics: [], sections: [], insights: [],
    analyzedAt: new Date().toISOString(),
    walletScan: null, tokenScan: null, contractScan: null, projectScan: null,
    recommendations: [], risks: [], opportunities: [],
    confidenceScore: 0,
    smartMoneyScore: null, walletHealthScore: null,
    dataQualityScore, reliabilityScore,
    providerAttempts, fieldSources: {},
    isDataUnavailable: true,
  };
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function analyzeTarget(input: AnalyzerInput): Promise<AnalysisResult> {
  // ── Auto-detect entity type for EVM addresses submitted as "wallet" ────────
  // Users often paste ERC-20 token contracts into the wallet field. Probe
  // DexScreener + GoPlus to reclassify before routing to the wrong analyzer.
  // This also benefits from cache primed by the frontend /detect-type call.
  const isEvmAddress = /^0x[0-9a-fA-F]{40}$/.test(input.target);
  if (input.type === "wallet" && isEvmAddress) {
    const detected = await detectEntityType(input.target, input.chain ?? null);
    if (detected.type !== "wallet") {
      logger.info(
        { target: input.target, from: "wallet", to: detected.type },
        "Entity type auto-corrected from wallet",
      );
      input = { ...input, type: detected.type as AnalyzerInput["type"] };
    }
  }

  const analyzer = ANALYZERS[input.type as AnalyzeType];
  if (!analyzer) throw new Error(`Unknown analysis type: "${input.type}"`);

  // Step 1: Real data with full provider chain
  const { scanData, providerAttempts } = await fetchScanData(input);

  // Step 2: Programmatic data quality scoring
  const quality = scoreData(
    input.type,
    scanData as WalletScanData | TokenScanData | ContractScanData | null,
    providerAttempts,
  );

  const threshold = DATA_QUALITY_THRESHOLDS[input.type] ?? 0;

  // Step 3: Gate — if data quality is below threshold, return DATA_UNAVAILABLE
  if (quality.dataQualityScore < threshold) {
    logger.warn({
      type: input.type,
      target: input.target,
      dataQualityScore: quality.dataQualityScore,
      threshold,
      missingFields: quality.missingFields,
    }, "Data quality below threshold — returning DATA_UNAVAILABLE");

    const result = buildUnavailableResult(
      input, providerAttempts,
      quality.dataQualityScore, quality.reliabilityScore, quality.missingFields,
    );

    db.insert(scanHistory)
      .values({ target: input.target, type: input.type, chain: input.chain ?? null, result: result as unknown as Record<string, unknown> })
      .catch((err) => logger.warn({ err }, "Failed to save scan history"));

    return result;
  }

  // Step 4: Build analyzer meta (caps AI confidence to data quality score)
  const meta: AnalyzerMeta = {
    dataQualityScore: quality.dataQualityScore,
    reliabilityScore: quality.reliabilityScore,
    fieldSources: quality.fieldSources,
  };

  // Step 5: AI with enriched context and capped confidence
  const text = await callAI({
    system: analyzer.systemPrompt(input, scanData, meta),
    messages: [{ role: "user", content: analyzer.userMessage(input, scanData, meta) }],
  });

  // Step 6: Parse AI output
  const parsed = parseAiOutput(text);

  // Step 7: Post-process (attaches scan data)
  analyzer.postProcess?.(parsed, input, scanData);

  // Step 8: Cap AI-reported confidence to our programmatic data quality score
  const rawAiConfidence = parsed.confidenceScore ?? 50;
  const cappedConfidence = Math.min(rawAiConfidence, quality.dataQualityScore);

  // Step 9: Compose result
  const result: AnalysisResult = {
    target:    input.target,
    type:      input.type,
    chain:     input.chain ?? null,
    summary:   parsed.summary,
    riskScore: parsed.riskScore,
    metrics:   parsed.metrics,
    sections:  parsed.sections,
    insights:  parsed.insights,
    analyzedAt: new Date().toISOString(),
    walletScan:        parsed.walletScan        ?? null,
    tokenScan:         parsed.tokenScan         ?? null,
    contractScan:      parsed.contractScan      ?? null,
    projectScan:       parsed.projectScan       ?? (input.type === "project" ? (scanData as ProjectScanData | null) : null),
    recommendations:   parsed.recommendations   ?? [],
    risks:             parsed.risks             ?? [],
    opportunities:     parsed.opportunities     ?? [],
    confidenceScore:   cappedConfidence,
    smartMoneyScore:   parsed.smartMoneyScore    ?? null,
    walletHealthScore: parsed.walletHealthScore  ?? null,
    // Verified quality scores
    dataQualityScore:  quality.dataQualityScore,
    reliabilityScore:  quality.reliabilityScore,
    providerAttempts,
    fieldSources:      quality.fieldSources,
    isDataUnavailable: false,
  };

  // Step 10: Persist (non-blocking)
  db.insert(scanHistory)
    .values({
      target: input.target, type: input.type, chain: input.chain ?? null,
      result: result as unknown as Record<string, unknown>,
    })
    .catch((err) => logger.warn({ err }, "Failed to save scan history"));

  return result;
}
