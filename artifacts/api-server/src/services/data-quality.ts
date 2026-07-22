/**
 * Programmatic Data Quality and Reliability scoring.
 *
 * - dataQualityScore  (0-100): what % of essential fields were filled from real provider data
 * - reliabilityScore  (0-100): weighted blend of provider success rate, data freshness, and primary-provider success
 *
 * These are computed from the raw scan data and provider attempt log — never invented by the AI.
 */

import type { ProviderAttempt } from "./provider-registry.js";
import type { WalletScanData, TokenScanData, ContractScanData } from "../routes/analyze/types.js";

export interface DataQuality {
  dataQualityScore: number;
  reliabilityScore: number;
  fieldSources: Record<string, string>;
  missingFields: string[];
}

interface FieldCheck {
  name: string;
  label: string;
  filled: boolean;
  weight: number;
  source: string;
}

function computeScores(
  checks: FieldCheck[],
  attempts: ProviderAttempt[],
  fetchedAt: string,
): DataQuality {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const filledWeight = checks.filter((c) => c.filled).reduce((s, c) => s + c.weight, 0);
  const dataQualityScore = Math.round((filledWeight / Math.max(totalWeight, 1)) * 100);

  const missingFields = checks.filter((c) => !c.filled).map((c) => c.label);
  const fieldSources: Record<string, string> = {};
  for (const c of checks) {
    if (c.filled) fieldSources[c.name] = c.source;
  }

  // Reliability: freshness + provider success rate + primary provider success
  const nonSkipped = attempts.filter((a) => a.status !== "skipped");
  const succeeded  = attempts.filter((a) => a.status === "success");
  const successRate = nonSkipped.length > 0 ? succeeded.length / nonSkipped.length : 0;

  const PRIMARY_PROVIDERS = new Set(["Moralis", "GoPlus", "Ankr", "DexScreener", "Blockscout"]);
  const primarySuccess = attempts.some((a) => PRIMARY_PROVIDERS.has(a.provider) && a.status === "success");

  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const ageMins = ageMs / 60_000;
  const freshnessScore = ageMins < 5 ? 100 : ageMins < 30 ? 80 : ageMins < 60 ? 60 : 40;

  const reliabilityScore = Math.min(
    100,
    Math.round((primarySuccess ? 35 : 0) + successRate * 35 + freshnessScore * 0.3),
  );

  return { dataQualityScore, reliabilityScore, fieldSources, missingFields };
}

// ── Wallet ─────────────────────────────────────────────────────────────────

export function scoreWalletData(
  d: WalletScanData | null,
  attempts: ProviderAttempt[],
): DataQuality {
  if (!d) {
    return {
      dataQualityScore: 0, reliabilityScore: 0,
      fieldSources: {}, missingFields: ["All wallet data unavailable"],
    };
  }

  const src = d.fieldSources ?? {};
  // A field is "filled" when there is confirmed provenance (explicit fieldSources entry or
  // a successful provider attempt) — NOT gated on value > 0, which would wrongly penalise
  // valid zero-balance / zero-tx wallets (e.g. freshly created wallets, burn addresses).
  const goplusRan = attempts.some((a) => a.provider === "GoPlus" && a.status === "success");
  const checks: FieldCheck[] = [
    {
      name: "nativeBalance", label: "Native balance",
      // filled when the provider tagged this field — value may legitimately be "0"
      filled: !!src.nativeBalance,
      weight: 2, source: src.nativeBalance ?? d.dataSource,
    },
    {
      name: "txCount", label: "Transaction count",
      // filled when provider returned a tx count (even 0 is valid for new wallets)
      filled: !!src.txCount || d.txCount !== undefined,
      weight: 2, source: src.txCount ?? d.dataSource,
    },
    {
      name: "totalNetWorth", label: "Total net worth",
      filled: d.totalNetWorthUsd !== null,
      weight: 2, source: src.totalNetWorth ?? d.dataSource,
    },
    {
      name: "walletAge", label: "Wallet age / first transaction",
      filled: d.firstTxDate !== null || d.walletAgeDays !== null,
      weight: 1.5, source: src.walletAge ?? d.dataSource,
    },
    {
      name: "tokenBalances", label: "Token balances",
      // filled when provider returned a token list (even empty is valid for wallets with no tokens)
      filled: !!src.tokenBalances || d.tokens !== undefined,
      weight: 1.5, source: src.tokenBalances ?? d.dataSource,
    },
    {
      name: "securityCheck", label: "Address security check (GoPlus)",
      filled: !!src.securityCheck || goplusRan,
      weight: 2, source: "GoPlus",
    },
    {
      name: "chainActivity", label: "Chain activity",
      filled: d.chainsUsed.length > 0,
      weight: 1, source: src.chainActivity ?? d.dataSource,
    },
  ];

  return computeScores(checks, attempts, d.fetchedAt);
}

// ── Token ──────────────────────────────────────────────────────────────────

export function scoreTokenData(
  d: TokenScanData | null,
  attempts: ProviderAttempt[],
): DataQuality {
  if (!d) {
    return {
      dataQualityScore: 0, reliabilityScore: 0,
      fieldSources: {}, missingFields: ["All token data unavailable"],
    };
  }

  const src = d.fieldSources ?? {};
  const checks: FieldCheck[] = [
    {
      name: "priceUsd", label: "Token price",
      filled: d.priceUsd !== null && !!src.priceUsd, weight: 3,
      source: src.priceUsd ?? "",
    },
    {
      name: "liquidityUsd", label: "Liquidity data",
      filled: d.liquidityUsd !== null && !!src.liquidityUsd, weight: 2,
      source: src.liquidityUsd ?? "",
    },
    {
      name: "marketCap", label: "Market cap",
      filled: d.marketCapUsd !== null && !!src.marketCap, weight: 2,
      source: src.marketCap ?? "",
    },
    {
      name: "honeypotCheck", label: "Honeypot check",
      // filled only if GoPlus actually ran and returned data
      filled: d.security.isHoneypot !== null && !!src.honeypotCheck,
      weight: 3, source: src.honeypotCheck ?? "",
    },
    {
      name: "sourceVerification", label: "Source code verification",
      filled: d.security.isOpenSource !== null && !!src.sourceVerification,
      weight: 1, source: src.sourceVerification ?? "",
    },
    {
      name: "holderCount", label: "Holder count",
      filled: d.holderCount !== null && !!src.holderCount, weight: 1,
      source: src.holderCount ?? "",
    },
  ];

  return computeScores(checks, attempts, d.fetchedAt);
}

// ── Contract ───────────────────────────────────────────────────────────────

export function scoreContractData(
  d: ContractScanData | null,
  attempts: ProviderAttempt[],
): DataQuality {
  if (!d) {
    return {
      dataQualityScore: 0, reliabilityScore: 0,
      fieldSources: {}, missingFields: ["All contract data unavailable"],
    };
  }

  const checks: FieldCheck[] = [
    {
      name: "honeypotCheck", label: "Honeypot check",
      filled: d.security.isHoneypot !== null, weight: 3, source: "GoPlus",
    },
    {
      name: "sourceVerification", label: "Source code verification",
      filled: d.security.isOpenSource !== null, weight: 2, source: "GoPlus",
    },
    {
      name: "ownership", label: "Ownership information",
      filled: d.security.ownerAddress !== null, weight: 1, source: "GoPlus",
    },
    {
      name: "mintable", label: "Mintable supply check",
      filled: d.security.isMintable !== null, weight: 1, source: "GoPlus",
    },
    {
      name: "blacklist", label: "Blacklist function check",
      filled: d.security.hasBlacklist !== null, weight: 1, source: "GoPlus",
    },
  ];

  return computeScores(checks, attempts, d.fetchedAt);
}

// ── Universal dispatcher ───────────────────────────────────────────────────

export function scoreData(
  type: string,
  scanData: WalletScanData | TokenScanData | ContractScanData | null,
  attempts: ProviderAttempt[],
): DataQuality {
  if (type === "wallet") return scoreWalletData(scanData as WalletScanData | null, attempts);
  if (type === "token")  return scoreTokenData(scanData as TokenScanData | null, attempts);
  if (type === "contract") return scoreContractData(scanData as ContractScanData | null, attempts);
  // project type: no strict quality gate
  return { dataQualityScore: 60, reliabilityScore: 60, fieldSources: {}, missingFields: [] };
}

/** Minimum data quality scores to allow AI generation. Below these = DATA_UNAVAILABLE. */
export const DATA_QUALITY_THRESHOLDS: Record<string, number> = {
  wallet:   30,
  token:    40,
  contract: 30,
  project:   0, // project uses web scraping, no strict threshold
};
