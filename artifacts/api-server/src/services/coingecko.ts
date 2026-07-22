/**
 * CoinGecko free API — no API key required for basic endpoints.
 * Rate limit: ~10-30 RPM without key. Used to supplement DexScreener.
 *
 * Provides: detailed market data, community links, token description,
 *           team info, social stats for established tokens.
 */

import { cachedFetch } from "./cache.js";

const BASE = "https://api.coingecko.com/api/v3";
const KEY  = process.env["COINGECKO_API_KEY"] ?? "";
const TIMEOUT = 8_000;

const CG_PLATFORM_MAP: Record<string, string> = {
  ethereum: "ethereum", bsc: "binance-smart-chain", polygon: "polygon-pos",
  arbitrum: "arbitrum-one", optimism: "optimistic-ethereum", base: "base",
  avalanche: "avalanche", solana: "solana",
};

function cgHeaders(): HeadersInit {
  return KEY ? { "x-cg-demo-api-key": KEY } : {};
}

async function cgFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: cgHeaders(),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.status === 429) throw new Error("CoinGecko rate limit");
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export interface CoinGeckoTokenData {
  id: string;
  symbol: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categories: string[];
  marketCap: number | null;
  fullyDilutedValuation: number | null;
  currentPrice: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  ath: number | null;
  athDate: string | null;
  athChangePercent: number | null;
  twitterFollowers: number | null;
  redditSubscribers: number | null;
  telegramChannelSize: number | null;
  coingeckoScore: number | null;
  developerScore: number | null;
  communityScore: number | null;
  liquidityScore: number | null;
  homepage: string | null;
  twitterUrl: string | null;
  telegramUrl: string | null;
  githubUrls: string[];
  contractAddress: string | null;
  platform: string | null;
  genesisDate: string | null;
  publicNotice: string | null;
}

interface CgCoinResponse {
  id: string;
  symbol: string;
  name: string;
  description?: { en?: string };
  image?: { large?: string };
  categories?: string[];
  market_data?: {
    current_price?: Record<string, number>;
    price_change_percentage_24h?: number;
    market_cap?: Record<string, number>;
    fully_diluted_valuation?: Record<string, number>;
    total_volume?: Record<string, number>;
    circulating_supply?: number;
    total_supply?: number;
    max_supply?: number;
    ath?: Record<string, number>;
    ath_date?: Record<string, string>;
    ath_change_percentage?: Record<string, number>;
  };
  community_data?: {
    twitter_followers?: number;
    reddit_subscribers?: number;
    telegram_channel_user_count?: number;
  };
  developer_data?: Record<string, unknown>;
  coingecko_score?: number;
  developer_score?: number;
  community_score?: number;
  liquidity_score?: number;
  links?: {
    homepage?: string[];
    twitter_screen_name?: string;
    telegram_channel_identifier?: string;
    repos_url?: { github?: string[] };
  };
  genesis_date?: string | null;
  asset_platform_id?: string;
  platforms?: Record<string, string>;
  public_notice?: string | null;
}

export async function getCoinByContract(
  contractAddress: string,
  chain: string,
): Promise<CoinGeckoTokenData | null> {
  const platform = CG_PLATFORM_MAP[chain.toLowerCase()] ?? "ethereum";
  const key = `cg:contract:${platform}:${contractAddress.toLowerCase()}`;

  return cachedFetch(key, async () => {
    const data = await cgFetch<CgCoinResponse>(
      `/coins/${platform}/contract/${contractAddress.toLowerCase()}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`,
    );
    if (!data) return null;
    return mapCoinData(data);
  });
}

export async function getCoinById(coinId: string): Promise<CoinGeckoTokenData | null> {
  const key = `cg:coin:${coinId}`;
  return cachedFetch(key, async () => {
    const data = await cgFetch<CgCoinResponse>(
      `/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`,
    );
    if (!data) return null;
    return mapCoinData(data);
  });
}

export async function searchCoin(query: string): Promise<string | null> {
  const key = `cg:search:${query.toLowerCase()}`;
  return cachedFetch(key, async () => {
    const data = await cgFetch<{ coins?: { id: string; symbol: string; name: string }[] }>(
      `/search?query=${encodeURIComponent(query)}`,
    );
    return data?.coins?.[0]?.id ?? null;
  }, 600_000);
}

function mapCoinData(data: CgCoinResponse): CoinGeckoTokenData {
  const md = data.market_data ?? {};
  const cm = data.community_data ?? {};
  const links = data.links ?? {};
  return {
    id: data.id,
    symbol: data.symbol?.toUpperCase() ?? "",
    name: data.name ?? "",
    description: data.description?.en?.slice(0, 500) ?? null,
    imageUrl: data.image?.large ?? null,
    categories: data.categories ?? [],
    marketCap: md.market_cap?.usd ?? null,
    fullyDilutedValuation: md.fully_diluted_valuation?.usd ?? null,
    currentPrice: md.current_price?.usd ?? null,
    priceChange24h: md.price_change_percentage_24h ?? null,
    volume24h: md.total_volume?.usd ?? null,
    circulatingSupply: md.circulating_supply ?? null,
    totalSupply: md.total_supply ?? null,
    maxSupply: md.max_supply ?? null,
    ath: md.ath?.usd ?? null,
    athDate: md.ath_date?.usd ?? null,
    athChangePercent: md.ath_change_percentage?.usd ?? null,
    twitterFollowers: cm.twitter_followers ?? null,
    redditSubscribers: cm.reddit_subscribers ?? null,
    telegramChannelSize: cm.telegram_channel_user_count ?? null,
    coingeckoScore: data.coingecko_score ?? null,
    developerScore: data.developer_score ?? null,
    communityScore: data.community_score ?? null,
    liquidityScore: data.liquidity_score ?? null,
    homepage: links.homepage?.[0] ?? null,
    twitterUrl: links.twitter_screen_name
      ? `https://twitter.com/${links.twitter_screen_name}`
      : null,
    telegramUrl: links.telegram_channel_identifier
      ? `https://t.me/${links.telegram_channel_identifier}`
      : null,
    githubUrls: links.repos_url?.github?.filter(Boolean) ?? [],
    contractAddress: Object.values(data.platforms ?? {})[0] ?? null,
    platform: data.asset_platform_id ?? null,
    genesisDate: data.genesis_date ?? null,
    publicNotice: data.public_notice ?? null,
  };
}
