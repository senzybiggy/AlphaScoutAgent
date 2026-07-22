/**
 * Etherscan API — free tier available without key (5 req/sec, limited).
 * With ETHERSCAN_API_KEY: 5 req/sec, full historical data.
 * https://docs.etherscan.io/
 *
 * Only used as a fallback for Ethereum mainnet data.
 */

import { cachedFetch } from "./cache.js";
import type { WalletTx } from "../routes/analyze/types.js";

const BASE = "https://api.etherscan.io/api";
const TIMEOUT = 10_000;

function getKey(): string {
  // Empty string = free tier (still works, just rate-limited)
  return process.env.ETHERSCAN_API_KEY ?? "";
}

async function ethFetch(params: Record<string, string>): Promise<unknown> {
  const key = getKey();
  const allParams: Record<string, string> = { ...params };
  if (key) allParams.apikey = key;

  const qs = new URLSearchParams(allParams).toString();
  const cacheKey = `etherscan:${qs}`;

  return cachedFetch(cacheKey, async () => {
    const r = await fetch(`${BASE}?${qs}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) throw new Error(`Etherscan HTTP ${r.status}`);
    const data = await r.json() as Record<string, unknown>;
    if (data.status === "0" && data.result !== "0") {
      throw new Error(`Etherscan: ${String(data.message ?? data.result ?? "API error")}`);
    }
    return data.result;
  }, 60_000);
}

// ── Native balance ─────────────────────────────────────────────────────────

export async function getNativeBalance(
  address: string,
): Promise<{ balanceWei: string; balanceEth: string } | null> {
  try {
    const result = await ethFetch({ module: "account", action: "balance", address, tag: "latest" });
    const wei = String(result ?? "0");
    const eth = (parseInt(wei, 10) / 1e18).toFixed(8);
    return { balanceWei: wei, balanceEth: eth };
  } catch {
    return null;
  }
}

// ── Nonce (sent tx count) ──────────────────────────────────────────────────

export async function getNonce(address: string): Promise<number | null> {
  try {
    const result = await ethFetch({ module: "proxy", action: "eth_getTransactionCount", address, tag: "latest" });
    return parseInt(String(result ?? "0x0"), 16);
  } catch {
    return null;
  }
}

// ── Transaction list ───────────────────────────────────────────────────────

interface EtherscanTxRaw {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  gasUsed: string;
  gasPrice: string;
  input: string;
  functionName: string;
}

export async function getTxList(
  address: string,
  limit = 15,
): Promise<WalletTx[]> {
  try {
    const result = await ethFetch({
      module: "account", action: "txlist",
      address, startblock: "0", endblock: "99999999",
      sort: "desc", offset: String(limit),
    });
    if (!Array.isArray(result)) return [];

    return (result as EtherscanTxRaw[]).slice(0, limit).map((tx) => {
      const valueEth = parseInt(tx.value ?? "0", 10) / 1e18;
      const gasUsed  = parseInt(tx.gasUsed ?? "0", 10);
      const gasPrice = parseInt(tx.gasPrice ?? "0", 10);
      const gasFeeEth = gasUsed > 0 ? ((gasUsed * gasPrice) / 1e18).toFixed(8) : null;
      const isIn = tx.to?.toLowerCase() === address.toLowerCase();
      const ts   = new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString();
      const fnName = tx.functionName?.split("(")?.[0] || null;
      return {
        hash: tx.hash,
        category: isIn ? "receive" : fnName ? "contract_call" : "send",
        summary: fnName
          ? `Called ${fnName}()`
          : isIn
            ? `Received ${valueEth.toFixed(6)} ETH`
            : `Sent ${valueEth.toFixed(6)} ETH`,
        fromAddress: tx.from,
        toAddress: tx.to || null,
        valueFormatted: `${valueEth.toFixed(6)} ETH`,
        valueUsd: null,
        gasFeeNative: gasFeeEth ? `${gasFeeEth} ETH` : null,
        gasFeeUsd: null,
        timestamp: ts,
        status: tx.isError === "0" ? "success" : "failed",
      };
    });
  } catch {
    return [];
  }
}
