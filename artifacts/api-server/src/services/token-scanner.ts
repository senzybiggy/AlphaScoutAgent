/**
 * Token Scanner — orchestrates DexScreener + GoPlus security for tokens.
 */
import * as dex from "./dexscreener.js";
import * as goplus from "./goplus.js";
import type { TokenScanData } from "../routes/analyze/types.js";

export type { TokenScanData };

function chainFromDexScreener(chainId: string): string {
  const map: Record<string, string> = {
    ethereum: "ethereum", solana: "solana", bsc: "bsc",
    polygon: "polygon", arbitrum: "arbitrum", optimism: "optimism",
    base: "base", avalanche: "avalanche",
  };
  return map[chainId.toLowerCase()] ?? chainId;
}

export async function scanToken(
  address: string,
  inputChain: string | null,
): Promise<TokenScanData> {
  const [dexResult, goplusResult] = await Promise.allSettled([
    dex.getTokenPairs(address),
    goplus.checkTokenSecurity(address, inputChain ?? "ethereum"),
  ]);

  const dexData = dexResult.status === "fulfilled" ? dexResult.value : { pairs: [], bestPair: null };
  const best = dexData.bestPair;
  const sec = goplusResult.status === "fulfilled" ? goplusResult.value : null;

  const chainId = best?.chainId ?? inputChain ?? null;
  const topHolders = sec?.topHolders ?? [];

  return {
    dataSource: "dexscreener+goplus",
    fetchedAt: new Date().toISOString(),
    symbol: best?.baseToken.symbol ?? "",
    name: best?.baseToken.name ?? "",
    chainId,
    contractAddress: best?.baseToken.address ?? address,
    priceUsd: best?.priceUsd ?? null,
    priceChange24h: best?.priceChange.h24 ?? null,
    priceChange6h: best?.priceChange.h6 ?? null,
    priceChange1h: best?.priceChange.h1 ?? null,
    marketCapUsd: best?.marketCap ?? null,
    fdvUsd: best?.fdv ?? null,
    liquidityUsd: best?.liquidity.usd ?? null,
    volumeH24: best?.volume.h24 ?? null,
    buys24h: best?.txns.h24?.buys ?? null,
    sells24h: best?.txns.h24?.sells ?? null,
    holderCount: sec?.holderCount ?? null,
    topHolders,
    dexPairs: dexData.pairs.slice(0, 5).map((p) => ({
      name: `${p.dexId} (${chainFromDexScreener(p.chainId)})`,
      liquidity: p.liquidity.usd != null ? `$${(p.liquidity.usd / 1e3).toFixed(0)}K` : "N/A",
      pair: p.pairAddress,
    })),
    pairCreatedAt: best?.pairCreatedAt ?? null,
    imageUrl: best?.imageUrl ?? null,
    websites: best?.websites ?? [],
    socials: best?.socials ?? [],
    security: sec
      ? {
          isHoneypot: sec.isHoneypot,
          buyTax: sec.buyTax,
          sellTax: sec.sellTax,
          isOpenSource: sec.isOpenSource,
          isMintable: sec.isMintable,
          hasBlacklist: sec.hasBlacklist,
          hasHiddenOwner: sec.hasHiddenOwner,
          ownerCanTakeBack: sec.ownerCanTakeBack,
          cannotSellAll: sec.cannotSellAll,
          transferPausable: sec.transferPausable,
          isProxy: sec.isProxy,
          hasSelfDestruct: sec.hasSelfDestruct,
          ownerAddress: sec.ownerAddress,
          creatorAddress: sec.creatorAddress,
          overallRisk: sec.overallRisk,
        }
      : {
          isHoneypot: null, buyTax: null, sellTax: null, isOpenSource: null,
          isMintable: null, hasBlacklist: null, hasHiddenOwner: null,
          ownerCanTakeBack: null, cannotSellAll: null, transferPausable: null,
          isProxy: null, hasSelfDestruct: null, ownerAddress: null,
          creatorAddress: null, overallRisk: "unknown" as const,
        },
    recommendations: [],
  };
}
