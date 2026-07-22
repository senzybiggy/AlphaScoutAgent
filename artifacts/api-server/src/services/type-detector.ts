/**
 * Entity type detector — probes DexScreener + GoPlus in parallel to determine
 * whether an EVM address is a wallet, ERC-20 token contract, or other smart contract.
 *
 * Results are cached for 5 minutes so a frontend /detect-type call primes the
 * cache that analyze-service.ts later hits — zero double-fetch cost.
 */

import * as dex from "./dexscreener.js";
import { checkAddressSecurity } from "./goplus.js";
import { cachedFetch } from "./cache.js";

export type DetectedEntityType = "wallet" | "token" | "contract";

export interface TypeDetectionResult {
  type: DetectedEntityType;
  label: string;
  confidence: "high" | "medium" | "low";
  isContract: boolean;
  hasLiquidity: boolean;
}

const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

const TYPE_LABELS: Record<DetectedEntityType, string> = {
  token:    "ERC-20 Token",
  contract: "Smart Contract",
  wallet:   "EVM Wallet",
};

export async function detectEntityType(
  address: string,
  chain: string | null,
): Promise<TypeDetectionResult> {
  if (!EVM_RE.test(address)) {
    return { type: "wallet", label: "EVM Wallet", confidence: "low", isContract: false, hasLiquidity: false };
  }

  const key = `typedetect:${chain ?? "eth"}:${address.toLowerCase()}`;
  return cachedFetch(key, async () => {
    // Run DexScreener (token pairs) + GoPlus (address security) in parallel
    const [dexSettled, secSettled] = await Promise.allSettled([
      dex.getTokenPairs(address),
      checkAddressSecurity(address, chain ?? "ethereum"),
    ]);

    const pairs    = dexSettled.status  === "fulfilled" ? dexSettled.value  : { pairs: [], bestPair: null };
    const security = secSettled.status === "fulfilled" ? secSettled.value : null;

    const isContract   = security?.isContractAddress ?? false;
    const hasLiquidity = pairs.pairs.length > 0;

    let type: DetectedEntityType;
    let confidence: TypeDetectionResult["confidence"];

    if (hasLiquidity) {
      // DexScreener found trading pairs → it's a tradeable ERC-20 token
      type = "token"; confidence = "high";
    } else if (isContract) {
      // GoPlus says it's a contract but no DEX pairs → generic smart contract
      type = "contract"; confidence = "high";
    } else {
      // No contract flag, no pairs → regular wallet
      type = "wallet"; confidence = security != null ? "high" : "medium";
    }

    return {
      type,
      label: TYPE_LABELS[type],
      confidence,
      isContract: isContract || hasLiquidity,
      hasLiquidity,
    };
  });
}
