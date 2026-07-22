/**
 * Token Scanner — verified multi-provider data layer.
 *
 * Priority chain:
 *   Market data:    DexScreener (free) → CoinGecko (free, rate-limited)
 *   Security data:  GoPlus (free, always)
 *   Metadata:       CoinGecko (via contract lookup)
 *
 * All provider attempts are tracked in TokenScanData.providerAttempts.
 * Every populated field is tagged in TokenScanData.fieldSources.
 */

import * as dex     from "./dexscreener.js";
import * as goplus  from "./goplus.js";
import * as cg      from "./coingecko.js";
import { runWithFallback, mergeAttempts, type ProviderAttempt } from "./provider-registry.js";
import type { TokenScanData, TokenSecurity } from "../routes/analyze/types.js";

export type { TokenScanData };

export interface TokenScanResult {
  data: TokenScanData | null;
  attempts: ProviderAttempt[];
}

function chainFromDexScreener(chainId: string): string {
  const map: Record<string, string> = {
    ethereum: "ethereum", solana: "solana", bsc: "bsc",
    polygon: "polygon", arbitrum: "arbitrum", optimism: "optimism",
    base: "base", avalanche: "avalanche",
  };
  return map[chainId.toLowerCase()] ?? chainId;
}

const EMPTY_SECURITY: TokenSecurity = {
  isHoneypot: null, buyTax: null, sellTax: null, isOpenSource: null,
  isMintable: null, hasBlacklist: null, hasHiddenOwner: null,
  ownerCanTakeBack: null, cannotSellAll: null, transferPausable: null,
  isProxy: null, hasSelfDestruct: null, hasExternalCalls: null,
  isAntiWhale: null, ownerAddress: null, creatorAddress: null,
  creatorHoldPct: null, ownerHoldPct: null, lpHolderCount: null,
  lpTopHolderPct: null, isInDex: null, overallRisk: "unknown" as const,
};

export async function scanToken(
  address: string,
  inputChain: string | null,
): Promise<TokenScanResult> {
  const allAttempts: ProviderAttempt[] = [];
  const fieldSources: Record<string, string> = {};

  // ── Run DexScreener and GoPlus in parallel ────────────────────────────────
  const [dexResult, secResult] = await Promise.all([
    runWithFallback("marketData", [
      { name: "DexScreener", fn: () => dex.getTokenPairs(address) },
    ]),
    runWithFallback("tokenSecurity", [
      { name: "GoPlus", fn: () => goplus.checkTokenSecurity(address, inputChain ?? "ethereum") },
    ]),
  ]);

  allAttempts.push(...dexResult.attempts, ...secResult.attempts);

  const dexData = dexResult.data ?? { pairs: [], bestPair: null };
  const best = dexData.bestPair;
  const sec  = secResult.data;

  // If neither DexScreener nor GoPlus returned any data, return null with full attempt log
  if (!best && !sec) return { data: null, attempts: allAttempts };

  const chainId = best?.chainId ?? inputChain ?? null;

  // ── CoinGecko enrichment (parallel, non-blocking) ─────────────────────────
  const cgContractChain = chainId ? chainFromDexScreener(chainId) : null;
  const cgResult = cgContractChain
    ? await runWithFallback("coinMetadata", [
        { name: "CoinGecko", fn: () => cg.getCoinByContract(address, cgContractChain) },
      ])
    : { data: null, provider: null, attempts: [] as ProviderAttempt[] };
  allAttempts.push(...cgResult.attempts);

  const cgData = cgResult.data;

  // ── Assign fieldSources AFTER all values are resolved ─────────────────────
  // Tag each field to the provider that actually supplied the value used.
  // DexScreener fields: only tag when best pair was returned
  if (best) {
    if (best.priceUsd   != null)            fieldSources.priceUsd       = "DexScreener";
    if (best.liquidity?.usd != null)         fieldSources.liquidityUsd   = "DexScreener";
    if (best.txns?.h24)                      fieldSources.holderActivity = "DexScreener";
  }
  // marketCap / fdvUsd / volumeH24 may come from DexScreener OR CoinGecko fallback
  const marketCapUsd = best?.marketCap ?? cgData?.marketCap ?? null;
  const fdvUsd       = best?.fdv       ?? cgData?.fullyDilutedValuation ?? null;
  const volumeH24    = best?.volume?.h24 ?? cgData?.volume24h ?? null;
  if (marketCapUsd != null) fieldSources.marketCap = best?.marketCap != null ? "DexScreener" : "CoinGecko";
  if (fdvUsd != null)       fieldSources.fdvUsd    = best?.fdv != null        ? "DexScreener" : "CoinGecko";
  if (volumeH24 != null)    fieldSources.volumeH24 = best?.volume?.h24 != null ? "DexScreener" : "CoinGecko";
  // GoPlus fields: only tag when security data was returned
  if (sec) {
    fieldSources.honeypotCheck      = "GoPlus";
    fieldSources.sourceVerification = "GoPlus";
    if (sec.holderCount != null) fieldSources.holderCount = "GoPlus";
    if (sec.topHolders?.length)  fieldSources.topHolders  = "GoPlus";
  }
  // CoinGecko-only fields
  if (cgData) {
    fieldSources.cgCommunity = "CoinGecko";
    fieldSources.cgMetadata  = "CoinGecko";
  }

  const topHolders = sec?.topHolders ?? [];

  const security: TokenSecurity = sec
    ? {
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
        isInDex:          dexData.pairs.length > 0,
        overallRisk:      sec.overallRisk,
      }
    : EMPTY_SECURITY;

  // If DexScreener found pairs, mark isInDex on security
  if (!sec && best) security.isInDex = true;

  const tokenData: TokenScanData = {
    dataSource: [
      dexResult.provider ?? "",
      secResult.provider ?? "",
      cgResult.provider ?? "",
    ].filter(Boolean).join("+") || "unknown",
    fetchedAt: new Date().toISOString(),

    symbol: best?.baseToken.symbol ?? "",
    name:   best?.baseToken.name   ?? "",
    chainId,
    contractAddress: best?.baseToken.address ?? address,

    priceUsd:       best?.priceUsd            ?? null,
    priceChange24h: best?.priceChange.h24      ?? null,
    priceChange6h:  best?.priceChange.h6       ?? null,
    priceChange1h:  best?.priceChange.h1       ?? null,
    marketCapUsd:   best?.marketCap            ?? cgData?.marketCap ?? null,
    fdvUsd:         best?.fdv                  ?? cgData?.fullyDilutedValuation ?? null,
    liquidityUsd:   best?.liquidity.usd        ?? null,
    volumeH24:      best?.volume.h24           ?? cgData?.volume24h ?? null,
    buys24h:        best?.txns.h24?.buys       ?? null,
    sells24h:       best?.txns.h24?.sells      ?? null,
    holderCount:    sec?.holderCount           ?? null,
    totalSupply:    sec?.totalSupply           ?? null,
    topHolders,

    dexPairs: dexData.pairs.slice(0, 5).map((p) => ({
      name:      `${p.dexId} (${chainFromDexScreener(p.chainId)})`,
      liquidity: p.liquidity.usd != null ? `$${(p.liquidity.usd / 1e3).toFixed(0)}K` : "N/A",
      pair:      p.pairAddress,
    })),
    pairCreatedAt: best?.pairCreatedAt ?? null,
    imageUrl:  best?.imageUrl  ?? cgData?.imageUrl ?? null,
    websites:  best?.websites  ?? (cgData?.homepage ? [cgData.homepage] : []),
    socials:   best?.socials   ?? [],
    security,
    recommendations: [],

    // CoinGecko enrichment
    cgDescription:   cgData?.description ?? null,
    cgCategories:    cgData?.categories  ?? [],
    cgCommunity: cgData
      ? {
          twitterFollowers: cgData.twitterFollowers,
          redditSubscribers: cgData.redditSubscribers,
          telegramSize: cgData.telegramChannelSize,
          communityScore: cgData.communityScore,
          liquidityScore: cgData.liquidityScore,
        }
      : null,
    cgAthUsd:          cgData?.ath               ?? null,
    cgAthChangePercent: cgData?.athChangePercent  ?? null,
    cgGenesisDate:     cgData?.genesisDate        ?? null,
    cgGithubUrls:      cgData?.githubUrls         ?? [],

    // Provider provenance
    providerAttempts: allAttempts,
    fieldSources,
  };

  return { data: tokenData, attempts: allAttempts };
}
