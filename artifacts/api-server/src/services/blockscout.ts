/**
 * Blockscout public REST API v2 — no API key required.
 * Supports Ethereum, Base, Optimism, Polygon, Arbitrum, BSC, Avalanche and many more.
 * https://docs.blockscout.com/for-users/api
 */

import { cachedFetch } from "./cache.js";

const CHAIN_BASES: Record<string, string> = {
  ethereum: "https://eth.blockscout.com",
  eth:      "https://eth.blockscout.com",
  base:     "https://base.blockscout.com",
  optimism: "https://optimism.blockscout.com",
  polygon:  "https://polygon.blockscout.com",
  arbitrum: "https://arbitrum.blockscout.com",
  bsc:      "https://bsc.blockscout.com",
  avalanche:"https://avalanche.blockscout.com",
};

const TIMEOUT = 10_000;

function getBase(chain: string): string | null {
  return CHAIN_BASES[chain.toLowerCase()] ?? null;
}

async function bsFetch(chain: string, path: string): Promise<Record<string, unknown> | null> {
  const base = getBase(chain);
  if (!base) return null;
  const key = `blockscout:${chain}:${path}`;
  return cachedFetch(key, async () => {
    const r = await fetch(`${base}/api/v2${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    return r.json() as Promise<Record<string, unknown>>;
  }, 120_000).catch(() => null);
}

// ── Address info ─────────────────────────────────────────────────────────────

export interface BlockscoutAddressInfo {
  nativeBalance: string;    // human-readable (e.g. "1.234567")
  nativeBalanceWei: string; // raw wei string
  txCount: number;
  isContract: boolean;
  isVerified: boolean | null; // contract verification status
  name: string | null;        // for contracts: contract name
}

export async function getAddressInfo(
  address: string,
  chain: string,
): Promise<BlockscoutAddressInfo | null> {
  const data = await bsFetch(chain, `/addresses/${address}`);
  if (!data) return null;

  const balanceWei = String(data.coin_balance ?? "0");
  const nativeBalance = (parseInt(balanceWei, 10) / 1e18).toFixed(8);

  return {
    nativeBalance,
    nativeBalanceWei: balanceWei,
    txCount: parseInt(String(data.tx_count ?? "0"), 10),
    isContract: data.is_contract === true,
    isVerified: data.is_verified != null ? Boolean(data.is_verified) : null,
    name: data.name ? String(data.name) : null,
  };
}

// ── Recent transactions ───────────────────────────────────────────────────────

export interface BlockscoutTx {
  hash: string;
  from: string;
  to: string | null;
  valueEth: string;
  timestamp: string;
  status: "success" | "failed";
  gasFeeEth: string | null;
}

export async function getAddressTxs(
  address: string,
  chain: string,
  limit = 10,
): Promise<BlockscoutTx[]> {
  const data = await bsFetch(chain, `/addresses/${address}/transactions?filter=to%20%7C%20from&limit=${limit}`);
  if (!data || !Array.isArray(data.items)) return [];

  return (data.items as Record<string, unknown>[]).slice(0, limit).map((tx) => {
    const valueWei = parseInt(String(tx.value ?? "0"), 10);
    const gasUsed  = parseInt(String(tx.gas_used ?? "0"), 10);
    const gasPrice = parseInt(String(tx.gas_price ?? "0"), 10);
    const gasFeeEth = gasUsed > 0 && gasPrice > 0
      ? ((gasUsed * gasPrice) / 1e18).toFixed(8)
      : null;

    return {
      hash: String(tx.hash ?? ""),
      from: String((tx.from as Record<string, unknown>)?.hash ?? ""),
      to: (tx.to as Record<string, unknown>)?.hash ? String((tx.to as Record<string, unknown>).hash) : null,
      valueEth: (valueWei / 1e18).toFixed(8),
      timestamp: String(tx.timestamp ?? new Date().toISOString()),
      status: tx.status === "ok" ? "success" : "failed",
      gasFeeEth,
    };
  });
}

// ── Contract source verification ─────────────────────────────────────────────

export interface BlockscoutContractInfo {
  isVerified: boolean;
  compilerVersion: string | null;
  sourceCode: string | null;
  contractName: string | null;
  isProxy: boolean;
}

export async function getContractInfo(
  address: string,
  chain: string,
): Promise<BlockscoutContractInfo | null> {
  const data = await bsFetch(chain, `/smart-contracts/${address}`);
  if (!data) return null;

  return {
    isVerified: data.is_verified === true,
    compilerVersion: data.compiler_version ? String(data.compiler_version) : null,
    sourceCode: null, // We don't need to return the full source code
    contractName: data.name ? String(data.name) : null,
    isProxy: data.is_proxy === true,
  };
}
