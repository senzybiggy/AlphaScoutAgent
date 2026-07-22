/**
 * Multi-chain public JSON-RPC provider — no API key required.
 *
 * Supports: Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain
 * Data: native balance, transaction count, bytecode check (is contract)
 */

const TIMEOUT = 8_000;

export interface ChainRpc {
  rpc: string;
  symbol: string;
  decimals: number;
  explorerApi?: string;
  chainId: number;
}

export const CHAINS: Record<string, ChainRpc> = {
  ethereum:  { rpc: "https://eth.llamarpc.com",             symbol: "ETH",  decimals: 18, chainId: 1 },
  base:      { rpc: "https://mainnet.base.org",             symbol: "ETH",  decimals: 18, chainId: 8453 },
  arbitrum:  { rpc: "https://arb1.arbitrum.io/rpc",         symbol: "ETH",  decimals: 18, chainId: 42161 },
  optimism:  { rpc: "https://mainnet.optimism.io",          symbol: "ETH",  decimals: 18, chainId: 10 },
  polygon:   { rpc: "https://polygon-rpc.com",              symbol: "POL",  decimals: 18, chainId: 137 },
  bsc:       { rpc: "https://bsc-dataseed.binance.org/",    symbol: "BNB",  decimals: 18, chainId: 56 },
  avalanche: { rpc: "https://api.avax.network/ext/bc/C/rpc",symbol: "AVAX", decimals: 18, chainId: 43114 },
};

// Canonical chain name mapping
const CHAIN_ALIASES: Record<string, string> = {
  eth: "ethereum", matic: "polygon", "bnb chain": "bsc", "bnb": "bsc",
  avax: "avalanche", arb: "arbitrum", op: "optimism", "okx-xlayer": "ethereum",
};

export function resolveChain(chain: string): string {
  const lc = chain.toLowerCase().trim();
  return CHAIN_ALIASES[lc] ?? lc;
}

export function getChainConfig(chain: string): ChainRpc | null {
  return CHAINS[resolveChain(chain)] ?? null;
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const data = await res.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

/** Native balance in human-readable format (e.g. "1.2345 ETH") */
export async function getNativeBalance(
  address: string,
  chain: string,
): Promise<{ raw: string; formatted: string; symbol: string; wei: bigint } | null> {
  const cfg = getChainConfig(chain);
  if (!cfg) return null;
  try {
    const hex = await rpcCall(cfg.rpc, "eth_getBalance", [address, "latest"]) as string;
    const wei = BigInt(hex);
    const divisor = BigInt(10 ** cfg.decimals);
    const whole = wei / divisor;
    const frac = ((wei % divisor) * 10000n) / divisor; // 4 decimal places
    const formatted = `${whole}.${String(frac).padStart(4, "0")}`;
    return { raw: hex, formatted: parseFloat(formatted).toFixed(6), symbol: cfg.symbol, wei };
  } catch {
    return null;
  }
}

/** Transaction count (nonce = total txs sent by this address) */
export async function getTxCount(address: string, chain: string): Promise<number | null> {
  const cfg = getChainConfig(chain);
  if (!cfg) return null;
  try {
    const hex = await rpcCall(cfg.rpc, "eth_getTransactionCount", [address, "latest"]) as string;
    return parseInt(hex, 16);
  } catch {
    return null;
  }
}

/** Check if address is a contract (has bytecode) */
export async function isContract(address: string, chain: string): Promise<boolean | null> {
  const cfg = getChainConfig(chain);
  if (!cfg) return null;
  try {
    const code = await rpcCall(cfg.rpc, "eth_getCode", [address, "latest"]) as string;
    return code !== "0x" && code.length > 2;
  } catch {
    return null;
  }
}

/** Fetch multiple chains' native balances in parallel */
export async function getMultiChainNativeBalances(
  address: string,
  chains: string[] = ["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc"],
): Promise<{ chain: string; formatted: string; symbol: string; usd: null }[]> {
  const results = await Promise.allSettled(
    chains.map(async (chain) => {
      const bal = await getNativeBalance(address, chain);
      if (!bal || parseFloat(bal.formatted) === 0) return null;
      return { chain, formatted: bal.formatted, symbol: bal.symbol, usd: null };
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<{ chain: string; formatted: string; symbol: string; usd: null } | null> =>
      r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value!);
}
