/**
 * Blockchair public API — no API key required for basic usage (30 req/hour free).
 * Supports Bitcoin, Ethereum, and several other chains.
 * https://blockchair.com/api/docs
 */

import { cachedFetch } from "./cache.js";

const BASE = "https://api.blockchair.com";
const TIMEOUT = 10_000;

const CHAIN_MAP: Record<string, string> = {
  bitcoin:  "bitcoin",
  btc:      "bitcoin",
  ethereum: "ethereum",
  eth:      "ethereum",
  bsc:      "bnb",
  polygon:  "polygon",
};

// ── Address dashboard ──────────────────────────────────────────────────────

export interface BlockchairAddressInfo {
  chain: string;
  balance: number;      // in base units (satoshis for BTC, wei for ETH)
  balanceFormatted: string; // human-readable
  txCount: number;
  firstSeenReceiving: string | null; // ISO timestamp
  lastSeenReceiving: string | null;
  received: number;
  spent: number;
}

export async function getAddressInfo(
  address: string,
  chain: string,
): Promise<BlockchairAddressInfo | null> {
  const chainName = CHAIN_MAP[chain.toLowerCase()];
  if (!chainName) return null;

  const cacheKey = `blockchair:${chainName}:${address.toLowerCase()}`;
  return cachedFetch(cacheKey, async () => {
    const r = await fetch(
      `${BASE}/${chainName}/dashboards/address/${address}?limit=1`,
      { signal: AbortSignal.timeout(TIMEOUT) },
    );
    if (!r.ok) throw new Error(`Blockchair HTTP ${r.status}`);

    const data = await r.json() as Record<string, unknown>;
    if (data.context && (data.context as Record<string, unknown>).code !== 200) {
      throw new Error(`Blockchair error: ${(data.context as Record<string, unknown>).error}`);
    }

    const addrKey = Object.keys((data.data as Record<string, unknown>) ?? {})[0];
    if (!addrKey) return null;

    const addrData = ((data.data as Record<string, unknown>)[addrKey]) as Record<string, unknown>;
    const addr = addrData?.address as Record<string, unknown> | null;
    if (!addr) return null;

    const isBtc = chainName === "bitcoin";
    const balance = parseInt(String(addr.balance ?? "0"), 10);
    const divisor = isBtc ? 1e8 : 1e18;
    const symbol  = isBtc ? "BTC" : "ETH";

    const parseTs = (v: unknown): string | null => {
      if (!v) return null;
      const d = new Date(String(v).replace(" ", "T") + (String(v).includes("Z") ? "" : "Z"));
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    return {
      chain: chainName,
      balance,
      balanceFormatted: `${(balance / divisor).toFixed(isBtc ? 8 : 6)} ${symbol}`,
      txCount: parseInt(String(addr.transaction_count ?? addr.transactions ?? "0"), 10),
      firstSeenReceiving: parseTs(addr.first_seen_receiving),
      lastSeenReceiving:  parseTs(addr.last_seen_receiving),
      received: parseInt(String(addr.received ?? "0"), 10),
      spent:    parseInt(String(addr.spent ?? "0"), 10),
    };
  }, 120_000);
}
