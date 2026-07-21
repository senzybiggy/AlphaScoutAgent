/**
 * DexScreener API — free, no API key required.
 * https://docs.dexscreener.com/api/reference
 */
import { cachedFetch } from "./cache.js";

const BASE = "https://api.dexscreener.com/latest";
const TIMEOUT = 10_000;

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: number | null;
  priceNative: string;
  priceChange: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  volume: { h24: number | null; h6: number | null; h1: number | null; m5: number | null };
  liquidity: { usd: number | null; base: number | null; quote: number | null };
  fdv: number | null;
  marketCap: number | null;
  txns: { h24: { buys: number; sells: number } | null; h1: { buys: number; sells: number } | null };
  pairCreatedAt: string | null;
  imageUrl: string | null;
  websites: string[];
  socials: { type: string; url: string }[];
}

export interface DexScreenerResult {
  pairs: DexPair[];
  bestPair: DexPair | null;
}

function parsePair(p: Record<string, unknown>): DexPair {
  const info = p.info as Record<string, unknown> | undefined;
  return {
    chainId: String(p.chainId ?? ""),
    dexId: String(p.dexId ?? ""),
    pairAddress: String(p.pairAddress ?? ""),
    baseToken: {
      address: String((p.baseToken as Record<string, unknown>)?.address ?? ""),
      name: String((p.baseToken as Record<string, unknown>)?.name ?? ""),
      symbol: String((p.baseToken as Record<string, unknown>)?.symbol ?? ""),
    },
    quoteToken: {
      address: String((p.quoteToken as Record<string, unknown>)?.address ?? ""),
      name: String((p.quoteToken as Record<string, unknown>)?.name ?? ""),
      symbol: String((p.quoteToken as Record<string, unknown>)?.symbol ?? ""),
    },
    priceUsd: p.priceUsd ? parseFloat(String(p.priceUsd)) : null,
    priceNative: String(p.priceNative ?? "0"),
    priceChange: {
      m5: (p.priceChange as Record<string, unknown>)?.m5 != null ? Number((p.priceChange as Record<string, unknown>).m5) : null,
      h1: (p.priceChange as Record<string, unknown>)?.h1 != null ? Number((p.priceChange as Record<string, unknown>).h1) : null,
      h6: (p.priceChange as Record<string, unknown>)?.h6 != null ? Number((p.priceChange as Record<string, unknown>).h6) : null,
      h24: (p.priceChange as Record<string, unknown>)?.h24 != null ? Number((p.priceChange as Record<string, unknown>).h24) : null,
    },
    volume: {
      h24: (p.volume as Record<string, unknown>)?.h24 != null ? Number((p.volume as Record<string, unknown>).h24) : null,
      h6: (p.volume as Record<string, unknown>)?.h6 != null ? Number((p.volume as Record<string, unknown>).h6) : null,
      h1: (p.volume as Record<string, unknown>)?.h1 != null ? Number((p.volume as Record<string, unknown>).h1) : null,
      m5: (p.volume as Record<string, unknown>)?.m5 != null ? Number((p.volume as Record<string, unknown>).m5) : null,
    },
    liquidity: {
      usd: (p.liquidity as Record<string, unknown>)?.usd != null ? Number((p.liquidity as Record<string, unknown>).usd) : null,
      base: (p.liquidity as Record<string, unknown>)?.base != null ? Number((p.liquidity as Record<string, unknown>).base) : null,
      quote: (p.liquidity as Record<string, unknown>)?.quote != null ? Number((p.liquidity as Record<string, unknown>).quote) : null,
    },
    fdv: p.fdv != null ? Number(p.fdv) : null,
    marketCap: p.marketCap != null ? Number(p.marketCap) : null,
    txns: {
      h24: (p.txns as Record<string, Record<string, number>>)?.h24
        ? { buys: (p.txns as Record<string, Record<string, number>>).h24.buys, sells: (p.txns as Record<string, Record<string, number>>).h24.sells }
        : null,
      h1: (p.txns as Record<string, Record<string, number>>)?.h1
        ? { buys: (p.txns as Record<string, Record<string, number>>).h1.buys, sells: (p.txns as Record<string, Record<string, number>>).h1.sells }
        : null,
    },
    pairCreatedAt: p.pairCreatedAt ? new Date(Number(p.pairCreatedAt)).toISOString() : null,
    imageUrl: info?.imageUrl ? String(info.imageUrl) : null,
    websites: Array.isArray(info?.websites)
      ? (info.websites as Record<string, string>[]).map((w) => w.url).filter(Boolean)
      : [],
    socials: Array.isArray(info?.socials)
      ? (info.socials as Record<string, string>[]).map((s) => ({ type: s.type, url: s.url }))
      : [],
  };
}

export async function getTokenPairs(address: string): Promise<DexScreenerResult> {
  const key = `dex:token:${address.toLowerCase()}`;
  return cachedFetch(key, async () => {
    const r = await fetch(`${BASE}/dex/tokens/${address}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return { pairs: [], bestPair: null };
    const data = (await r.json()) as Record<string, unknown>;
    const rawPairs = Array.isArray(data.pairs) ? (data.pairs as Record<string, unknown>[]) : [];
    const pairs = rawPairs.map(parsePair);
    // Best pair = highest liquidity USD
    const bestPair = pairs.reduce<DexPair | null>((best, p) => {
      if (!best) return p;
      return (p.liquidity.usd ?? 0) > (best.liquidity.usd ?? 0) ? p : best;
    }, null);
    return { pairs, bestPair };
  });
}

export async function searchTokens(query: string): Promise<DexPair[]> {
  const key = `dex:search:${query.toLowerCase()}`;
  return cachedFetch(key, async () => {
    const r = await fetch(`${BASE}/dex/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as Record<string, unknown>;
    return Array.isArray(data.pairs) ? (data.pairs as Record<string, unknown>[]).map(parsePair) : [];
  });
}
