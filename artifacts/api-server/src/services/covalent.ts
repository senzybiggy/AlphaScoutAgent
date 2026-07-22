/**
 * Covalent GoldRush API — requires COVALENT_API_KEY (free tier: 10K queries/month).
 * https://goldrush.dev/docs/
 * Provides: rich multi-chain token balances, historical portfolio value, NFTs.
 */

import { cachedFetch } from "./cache.js";
import type { WalletToken } from "../routes/analyze/types.js";

const BASE = "https://api.covalenthq.com/v1";
const TIMEOUT = 12_000;

const CHAIN_IDS: Record<string, string> = {
  ethereum: "eth-mainnet",
  eth:      "eth-mainnet",
  bsc:      "bsc-mainnet",
  polygon:  "matic-mainnet",
  arbitrum: "arbitrum-mainnet",
  optimism: "optimism-mainnet",
  base:     "base-mainnet",
  avalanche:"avalanche-mainnet",
};

function getKey(): string | null {
  return process.env.COVALENT_API_KEY ?? null;
}

async function covalentFetch<T>(path: string): Promise<T | null> {
  const key = getKey();
  if (!key) return null;

  const url = `${BASE}${path}`;
  return cachedFetch(`covalent:${path}`, async () => {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) throw new Error(`Covalent HTTP ${r.status}`);
    const data = await r.json() as { data?: T; error?: boolean; error_message?: string };
    if (data.error) throw new Error(data.error_message ?? "Covalent API error");
    return data.data ?? null;
  }, 120_000);
}

interface CovalentTokenItem {
  contract_address: string;
  contract_ticker_symbol: string;
  contract_name: string;
  logo_url: string | null;
  balance: string;
  pretty_balance: string;
  quote: number | null;
  quote_rate: number | null;
}

interface CovalentBalanceResponse {
  items: CovalentTokenItem[];
  total_count: number;
}

export async function getTokenBalances(
  address: string,
  chain: string,
): Promise<WalletToken[] | null> {
  if (!getKey()) return null;

  const chainId = CHAIN_IDS[chain.toLowerCase()];
  if (!chainId) return null;

  const data = await covalentFetch<CovalentBalanceResponse>(
    `/${chainId}/address/${address}/balances_v2/?no-spam=true&nft=false`,
  );
  if (!data?.items?.length) return null;

  let totalUsd = 0;
  const tokens = data.items
    .filter((t) => (t.quote ?? 0) > 0.01)
    .map((t): WalletToken => {
      const usdValue = t.quote ?? null;
      totalUsd += usdValue ?? 0;
      const bal = parseFloat(t.balance ?? "0");
      const decimals = 18; // approximate; Covalent normalizes
      const balFormatted = (bal / Math.pow(10, decimals)).toFixed(4);
      return {
        address: t.contract_address,
        symbol: t.contract_ticker_symbol,
        name: t.contract_name,
        logo: t.logo_url ?? null,
        balanceFormatted: t.pretty_balance ?? balFormatted,
        usdPrice: t.quote_rate ?? null,
        usdValue,
        portfolioPct: null,
        change24h: null,
      };
    });

  // Compute portfolio pct
  if (totalUsd > 0) {
    tokens.forEach((t) => { t.portfolioPct = ((t.usdValue ?? 0) / totalUsd) * 100; });
  }

  return tokens.length > 0 ? tokens : null;
}
