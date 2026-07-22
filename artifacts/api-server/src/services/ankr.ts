/**
 * Ankr Advanced API — free tier (no API key required for basic usage).
 * Rate limited but sufficient for demo/hackathon use.
 *
 * Provides: multi-chain token balances, NFTs, transaction history
 * https://www.ankr.com/docs/advanced-api/
 */

import { cachedFetch } from "./cache.js";
import type { WalletToken, WalletNFT, WalletTx } from "../routes/analyze/types.js";

const BASE = "https://rpc.ankr.com/multichain/";
const KEY  = process.env["ANKR_API_KEY"] ?? "";
const URL  = KEY ? `${BASE}${KEY}` : BASE;
const TIMEOUT = 12_000;

const ANKR_CHAINS: Record<string, string> = {
  ethereum: "eth", bsc: "bsc", polygon: "polygon",
  arbitrum: "arbitrum", optimism: "optimism", base: "base",
  avalanche: "avalanche", eth: "eth",
};

function toAnkrChain(chain: string): string {
  return ANKR_CHAINS[chain.toLowerCase()] ?? "eth";
}

async function ankrCall(method: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Ankr HTTP ${res.status}`);
  const data = await res.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(`Ankr: ${data.error.message}`);
  return data.result;
}

// ── Token Balances ─────────────────────────────────────────────────────────

export interface AnkrBalance {
  blockchain: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenType: string;
  contractAddress?: string;
  holderAddress: string;
  balance: string;
  balanceRawInteger: string;
  balanceUsd: string;
  tokenPrice: string;
  thumbnail?: string;
  isDefault?: boolean;
}

export async function getAccountBalance(
  address: string,
  chains: string[] = ["eth", "bsc", "polygon", "arbitrum", "optimism", "base"],
): Promise<WalletToken[]> {
  const key = `ankr:balance:${address.toLowerCase()}:${chains.join(",")}`;
  try {
    const result = await cachedFetch(key, async () => {
      const data = await ankrCall("ankr_getAccountBalance", {
        walletAddress: address,
        blockchain: chains,
        onlyWhitelisted: false,
        pageSize: 50,
      }) as { assets?: AnkrBalance[] } | null;
      return data?.assets ?? [];
    }, 120_000);

    return (result as AnkrBalance[]).map((a): WalletToken => {
      const usdValue = parseFloat(a.balanceUsd || "0");
      const usdPrice = parseFloat(a.tokenPrice || "0");
      return {
        address: a.contractAddress ?? `native-${a.blockchain}`,
        symbol: a.tokenSymbol,
        name: a.tokenName,
        logo: a.thumbnail ?? null,
        balanceFormatted: parseFloat(a.balance || "0").toFixed(4),
        usdPrice: usdPrice || null,
        usdValue: usdValue || null,
        portfolioPct: null, // calculated later
        change24h: null,
      };
    }).filter((t) => (t.usdValue ?? 0) > 0.01 || parseFloat(t.balanceFormatted) > 0);
  } catch {
    return [];
  }
}

// ── NFTs ────────────────────────────────────────────────────────────────────

export async function getAccountNFTs(
  address: string,
  chains: string[] = ["eth", "bsc", "polygon"],
): Promise<WalletNFT[]> {
  const key = `ankr:nft:${address.toLowerCase()}`;
  try {
    const result = await cachedFetch(key, async () => {
      const data = await ankrCall("ankr_getNFTsByOwner", {
        walletAddress: address,
        blockchain: chains,
        pageSize: 20,
      }) as { assets?: Record<string, unknown>[] } | null;
      return data?.assets ?? [];
    }, 120_000);

    return (result as Record<string, unknown>[]).slice(0, 20).map((n): WalletNFT => ({
      tokenAddress: String(n.contractAddress ?? ""),
      tokenId: String(n.tokenId ?? ""),
      name: String(n.name ?? "Unknown NFT"),
      collection: String(n.collectionName ?? "Unknown Collection"),
      image: n.imageUrl ? String(n.imageUrl) : null,
      floorPriceUsd: null,
    }));
  } catch {
    return [];
  }
}

// ── Transactions ────────────────────────────────────────────────────────────

export async function getAccountTransactions(
  address: string,
  chain: string,
  limit = 20,
): Promise<WalletTx[]> {
  const ankrChain = toAnkrChain(chain);
  const key = `ankr:txs:${address.toLowerCase()}:${ankrChain}`;
  try {
    const result = await cachedFetch(key, async () => {
      const data = await ankrCall("ankr_getTransactionsByAddress", {
        address,
        blockchain: ankrChain,
        pageSize: limit,
        descOrder: true,
      }) as { transactions?: Record<string, unknown>[] } | null;
      return data?.transactions ?? [];
    }, 60_000);

    return (result as Record<string, unknown>[]).map((tx): WalletTx => {
      const valueWei = BigInt(String(tx.value ?? "0"));
      const valueEth = Number(valueWei) / 1e18;
      const gasUsed = parseInt(String(tx.gasUsed ?? "0"), 16);
      const gasPrice = parseInt(String(tx.effectiveGasPrice ?? tx.gasPrice ?? "0"), 16);
      const gasFeeWei = gasUsed * gasPrice;
      const gasFeeEth = gasFeeWei / 1e18;
      const from = String(tx.from ?? "");
      const to = String(tx.to ?? "");
      const isIn = to.toLowerCase() === address.toLowerCase();
      return {
        hash: String(tx.hash ?? ""),
        category: isIn ? "receive" : "send",
        summary: `${isIn ? "Received" : "Sent"} ${valueEth > 0 ? valueEth.toFixed(6) + " ETH" : "token tx"}`,
        fromAddress: from,
        toAddress: to,
        valueFormatted: valueEth > 0 ? `${valueEth.toFixed(6)} ETH` : "0 ETH",
        valueUsd: null,
        gasFeeNative: gasFeeEth > 0 ? `${gasFeeEth.toFixed(6)} ETH` : null,
        gasFeeUsd: null,
        timestamp: tx.timestamp
          ? new Date(parseInt(String(tx.timestamp), 16) * 1000).toISOString()
          : new Date().toISOString(),
        status: tx.status === "0x1" || tx.status === 1 ? "success" : "failed",
      };
    });
  } catch {
    return [];
  }
}

// ── Summary stats from balances ─────────────────────────────────────────────

export function computePortfolioStats(tokens: WalletToken[]): {
  totalUsd: number;
  stablecoinUsd: number;
  chainsUsed: string[];
} {
  const STABLECOINS = new Set(["USDT", "USDC", "DAI", "BUSD", "TUSD", "FRAX", "LUSD", "CRVUSD", "USDE", "PYUSD"]);
  let totalUsd = 0;
  let stablecoinUsd = 0;
  tokens.forEach((t) => {
    const v = t.usdValue ?? 0;
    totalUsd += v;
    if (STABLECOINS.has(t.symbol.toUpperCase())) stablecoinUsd += v;
  });
  // Add portfolio percentages
  if (totalUsd > 0) {
    tokens.forEach((t) => {
      t.portfolioPct = ((t.usdValue ?? 0) / totalUsd) * 100;
    });
  }
  return { totalUsd, stablecoinUsd, chainsUsed: [] };
}
