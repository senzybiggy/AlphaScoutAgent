/**
 * Moralis Web3 Data API — requires MORALIS_API_KEY (free tier available).
 * https://docs.moralis.com
 */
import { cachedFetch } from "./cache.js";

const EVM_BASE = "https://deep-index.moralis.io/api/v2.2";
const SOL_BASE = "https://solana-gateway.moralis.io";
const TIMEOUT = 15_000;

const CHAIN_MAP: Record<string, string> = {
  ethereum: "eth", eth: "eth",
  bsc: "bsc", binance: "bsc",
  polygon: "polygon", matic: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avalanche",
  fantom: "fantom",
  cronos: "cronos",
};

export function toMoralisChain(chain: string | null | undefined): string {
  return CHAIN_MAP[(chain ?? "").toLowerCase()] ?? "eth";
}

function getKey(): string | null {
  return process.env.MORALIS_API_KEY ?? null;
}

async function mFetch(url: string): Promise<Record<string, unknown>> {
  const key = getKey();
  if (!key) throw new Error("MORALIS_API_KEY not set");
  const r = await fetch(url, {
    headers: { "X-API-Key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText);
    throw new Error(`Moralis ${r.status}: ${text.slice(0, 200)}`);
  }
  return r.json() as Promise<Record<string, unknown>>;
}

// ── Wallet token balances ────────────────────────────────────────────────────

export interface MoralisToken {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  balanceFormatted: string;
  usdPrice: number | null;
  usdValue: number | null;
  portfolioPct: number | null;
  change24h: number | null;
}

export async function getWalletTokens(address: string, chain: string): Promise<MoralisToken[]> {
  const c = toMoralisChain(chain);
  return cachedFetch(`moralis:tokens:${c}:${address.toLowerCase()}`, async () => {
    const data = await mFetch(`${EVM_BASE}/wallets/${address}/tokens?chain=${c}&limit=50`);
    if (!Array.isArray(data.result)) return [];
    return (data.result as Record<string, unknown>[]).map((t) => ({
      address: String(t.token_address ?? ""),
      symbol: String(t.symbol ?? ""),
      name: String(t.name ?? ""),
      logo: t.logo ? String(t.logo) : t.thumbnail ? String(t.thumbnail) : null,
      balanceFormatted: String(t.balance_formatted ?? t.balance ?? "0"),
      usdPrice: t.usd_price != null ? Number(t.usd_price) : null,
      usdValue: t.usd_value != null ? Number(t.usd_value) : null,
      portfolioPct: t.portfolio_percentage != null ? Number(t.portfolio_percentage) : null,
      change24h: t.usd_price_24hr_percent_change != null ? Number(t.usd_price_24hr_percent_change) : null,
    }));
  });
}

// ── Wallet NFTs ──────────────────────────────────────────────────────────────

export interface MoralisNFT {
  tokenAddress: string;
  tokenId: string;
  name: string;
  collection: string;
  image: string | null;
  floorPriceUsd: number | null;
}

export async function getWalletNFTs(address: string, chain: string): Promise<MoralisNFT[]> {
  const c = toMoralisChain(chain);
  return cachedFetch(`moralis:nfts:${c}:${address.toLowerCase()}`, async () => {
    const data = await mFetch(`${EVM_BASE}/${address}/nft?chain=${c}&limit=20&normalizeMetadata=true&media_items=false`);
    if (!Array.isArray(data.result)) return [];
    return (data.result as Record<string, unknown>[]).map((n) => {
      const meta = n.normalized_metadata as Record<string, unknown> | null;
      const rawImg = meta?.image ?? n.token_uri ?? null;
      let image = rawImg ? String(rawImg) : null;
      if (image?.startsWith("ipfs://")) image = `https://ipfs.io/ipfs/${image.slice(7)}`;
      return {
        tokenAddress: String(n.token_address ?? ""),
        tokenId: String(n.token_id ?? ""),
        name: meta?.name ? String(meta.name) : String(n.name ?? `#${n.token_id}`),
        collection: String(n.name ?? n.symbol ?? "Unknown"),
        image,
        floorPriceUsd: null, // Moralis doesn't include floor price in basic endpoint
      };
    });
  });
}

// ── Wallet transaction history ───────────────────────────────────────────────

export interface MoralisTx {
  hash: string;
  category: string;
  summary: string;
  fromAddress: string;
  toAddress: string | null;
  valueFormatted: string;
  valueUsd: string | null;
  gasFeeNative: string | null;
  gasFeeUsd: string | null;
  timestamp: string;
  status: "success" | "failed";
}

export async function getWalletHistory(address: string, chain: string): Promise<MoralisTx[]> {
  const c = toMoralisChain(chain);
  return cachedFetch(`moralis:history:${c}:${address.toLowerCase()}`, async () => {
    const data = await mFetch(`${EVM_BASE}/wallets/${address}/history?chain=${c}&limit=25&include_internal_transactions=false`);
    if (!Array.isArray(data.result)) return [];
    return (data.result as Record<string, unknown>[]).map((t) => ({
      hash: String(t.hash ?? ""),
      category: String(t.category ?? "unknown"),
      summary: String(t.summary ?? "Transaction"),
      fromAddress: String(t.from_address ?? ""),
      toAddress: t.to_address ? String(t.to_address) : null,
      valueFormatted: formatEth(String(t.value ?? "0")),
      valueUsd: t.value_usd != null ? String(Number(t.value_usd).toFixed(2)) : null,
      gasFeeNative: t.transaction_fee ? String(Number(t.transaction_fee).toFixed(6)) : null,
      gasFeeUsd: t.transaction_fee_usd ? String(Number(t.transaction_fee_usd).toFixed(4)) : null,
      timestamp: String(t.block_timestamp ?? new Date().toISOString()),
      status: t.receipt_status === "0" ? "failed" : "success",
    }));
  });
}

// ── Net worth across chains ──────────────────────────────────────────────────

export interface MoralisNetWorth {
  totalUsd: number;
  nativeUsd: number;
  tokenUsd: number;
  nftUsd: number;
  chains: { chain: string; nativeSymbol: string; nativeBalance: string; nativeUsd: number; tokenUsd: number }[];
}

export async function getWalletNetWorth(address: string): Promise<MoralisNetWorth | null> {
  return cachedFetch(`moralis:networth:${address.toLowerCase()}`, async () => {
    const chains = ["eth", "polygon", "bsc", "arbitrum", "optimism", "base", "avalanche"];
    const qs = chains.map((c) => `chains[]=${c}`).join("&");
    const data = await mFetch(`${EVM_BASE}/wallets/${address}/net-worth?${qs}&exclude_spam=true&exclude_unverified_contracts=true`);
    const total = parseFloat(String(data.total_networth_usd ?? "0"));
    let nativeUsd = 0, tokenUsd = 0, nftUsd = 0;
    const chainData: MoralisNetWorth["chains"] = [];
    if (Array.isArray(data.chains)) {
      for (const c of data.chains as Record<string, unknown>[]) {
        const nu = parseFloat(String(c.native_balance_usd ?? "0"));
        const tu = parseFloat(String(c.token_balance_usd ?? "0"));
        const ntu = parseFloat(String(c.nft_balance_usd ?? "0"));
        if (nu + tu + ntu > 0) {
          nativeUsd += nu; tokenUsd += tu; nftUsd += ntu;
          chainData.push({
            chain: String(c.chain ?? ""),
            nativeSymbol: String(c.native_token_symbol ?? "ETH"),
            nativeBalance: String(c.native_balance_formatted ?? "0"),
            nativeUsd: nu,
            tokenUsd: tu,
          });
        }
      }
    }
    return { totalUsd: total, nativeUsd, tokenUsd, nftUsd, chains: chainData };
  });
}

// ── Wallet stats ─────────────────────────────────────────────────────────────

export interface MoralisStats {
  txCount: number;
  nftCount: number;
  collectionCount: number;
}

export async function getWalletStats(address: string, chain: string): Promise<MoralisStats | null> {
  const c = toMoralisChain(chain);
  return cachedFetch(`moralis:stats:${c}:${address.toLowerCase()}`, async () => {
    const data = await mFetch(`${EVM_BASE}/wallets/${address}/stats?chain=${c}`);
    return {
      txCount: Number((data.transactions as Record<string, unknown>)?.total ?? 0),
      nftCount: Number((data.nfts as Record<string, unknown>)?.total ?? 0),
      collectionCount: Number((data.collections as Record<string, unknown>)?.total ?? 0),
    };
  });
}

// ── DeFi positions ───────────────────────────────────────────────────────────

export interface MoralisDefiPosition {
  protocol: string;
  type: string;
  valueUsd: number | null;
  tokens: string[];
  status: string;
}

export async function getDefiPositions(address: string, chain: string): Promise<MoralisDefiPosition[]> {
  const c = toMoralisChain(chain);
  return cachedFetch(`moralis:defi:${c}:${address.toLowerCase()}`, async () => {
    const data = await mFetch(`${EVM_BASE}/wallets/${address}/defi/positions?chain=${c}&protocol=all`);
    if (!Array.isArray(data.result)) return [];
    return (data.result as Record<string, unknown>[]).map((p) => {
      const pos = p.position as Record<string, unknown> | null;
      const tokenNames = Array.isArray(pos?.tokens)
        ? (pos!.tokens as Record<string, unknown>[]).map((t) => String(t.symbol ?? t.name ?? "?"))
        : [];
      return {
        protocol: String(p.protocol_name ?? p.protocol ?? "Unknown"),
        type: String(p.position_type ?? p.label ?? "Position"),
        valueUsd: pos?.balance_usd != null ? Number(pos.balance_usd) : null,
        tokens: tokenNames,
        status: String(p.status ?? "active"),
      };
    });
  });
}

// ── Solana balance ───────────────────────────────────────────────────────────

export async function getSolanaBalance(address: string): Promise<{ solBalance: string; usdValue: number | null } | null> {
  return cachedFetch(`moralis:sol:balance:${address}`, async () => {
    const key = getKey();
    if (!key) throw new Error("No key");
    const r = await fetch(`${SOL_BASE}/account/mainnet/${address}/balance`, {
      headers: { "X-API-Key": key },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    return { solBalance: String(data.solana ?? "0"), usdValue: null };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatEth(wei: string): string {
  try {
    const n = BigInt(wei);
    const eth = Number(n) / 1e18;
    if (eth === 0) return "0 ETH";
    return `${eth.toFixed(eth < 0.001 ? 8 : 4)} ETH`;
  } catch {
    return "0 ETH";
  }
}
