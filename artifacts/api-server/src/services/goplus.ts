/**
 * GoPlus Security API — completely free, no API key required.
 * https://docs.gopluslabs.io
 */
import { cachedFetch } from "./cache.js";

const BASE = "https://api.gopluslabs.io/api/v1";
const TIMEOUT = 10_000;

const CHAIN_MAP: Record<string, string> = {
  ethereum: "1", eth: "1",
  bsc: "56", binance: "56",
  polygon: "137", matic: "137",
  arbitrum: "42161",
  optimism: "10",
  base: "8453",
  avalanche: "43114",
  fantom: "250",
  cronos: "25",
};

export function toGoPlusChainId(chain: string): string {
  return CHAIN_MAP[chain.toLowerCase()] ?? "1";
}

async function gpFetch(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`GoPlus ${r.status}`);
  return r.json() as Promise<Record<string, unknown>>;
}

// ── Token / Contract Security ────────────────────────────────────────────────

export interface GoPlusTokenSecurity {
  isHoneypot: boolean | null;
  buyTax: string | null;
  sellTax: string | null;
  isOpenSource: boolean | null;
  isMintable: boolean | null;
  hasBlacklist: boolean | null;
  hasHiddenOwner: boolean | null;
  ownerCanTakeBack: boolean | null;
  cannotSellAll: boolean | null;
  transferPausable: boolean | null;
  isProxy: boolean | null;
  hasSelfDestruct: boolean | null;
  isAntiWhale: boolean | null;
  ownerAddress: string | null;
  creatorAddress: string | null;
  holderCount: number | null;
  totalSupply: string | null;
  topHolders: { address: string; pct: number; tag: string | null; isLocked: boolean }[];
  dexPairs: { name: string; liquidity: string; pair: string }[];
  overallRisk: "low" | "medium" | "high" | "critical" | "unknown";
}

function calcOverallRisk(d: Record<string, unknown>): GoPlusTokenSecurity["overallRisk"] {
  if (d.is_honeypot === "1") return "critical";
  const buy = parseFloat(String(d.buy_tax ?? "0"));
  const sell = parseFloat(String(d.sell_tax ?? "0"));
  if (buy > 30 || sell > 30) return "critical";
  if (
    d.hidden_owner === "1" ||
    d.cannot_sell_all === "1" ||
    d.transfer_pausable === "1" ||
    d.selfdestruct === "1"
  ) return "high";
  if (
    d.is_mintable === "1" ||
    d.can_take_back_ownership === "1" ||
    d.owner_change_balance === "1" ||
    (buy > 10 || sell > 10)
  ) return "medium";
  return "low";
}

export async function checkTokenSecurity(
  contractAddress: string,
  chain = "ethereum",
): Promise<GoPlusTokenSecurity | null> {
  const chainId = toGoPlusChainId(chain);
  const key = `goplus:token:${chainId}:${contractAddress.toLowerCase()}`;
  try {
    return await cachedFetch(key, async () => {
      const data = await gpFetch(
        `${BASE}/token_security/${chainId}?contract_addresses=${contractAddress.toLowerCase()}`,
      );
      if (data.code !== 1) return null;
      const result = (data.result as Record<string, Record<string, unknown>>)?.[
        contractAddress.toLowerCase()
      ];
      if (!result) return null;

      const topHolders = Array.isArray(result.holders)
        ? (result.holders as Record<string, unknown>[]).slice(0, 10).map((h) => ({
            address: String(h.address ?? ""),
            pct: parseFloat(String(h.percent ?? "0")) * 100,
            tag: h.tag ? String(h.tag) : null,
            isLocked: h.is_locked === 1,
          }))
        : [];

      const dexPairs = Array.isArray(result.dex)
        ? (result.dex as Record<string, unknown>[]).map((d) => ({
            name: String(d.name ?? ""),
            liquidity: String(d.liquidity ?? "0"),
            pair: String(d.pair ?? ""),
          }))
        : [];

      return {
        isHoneypot: result.is_honeypot != null ? result.is_honeypot === "1" : null,
        buyTax: result.buy_tax != null ? String(result.buy_tax) : null,
        sellTax: result.sell_tax != null ? String(result.sell_tax) : null,
        isOpenSource: result.is_open_source != null ? result.is_open_source === "1" : null,
        isMintable: result.is_mintable != null ? result.is_mintable === "1" : null,
        hasBlacklist: result.is_blacklisted != null ? result.is_blacklisted === "1" : null,
        hasHiddenOwner: result.hidden_owner != null ? result.hidden_owner === "1" : null,
        ownerCanTakeBack: result.can_take_back_ownership != null ? result.can_take_back_ownership === "1" : null,
        cannotSellAll: result.cannot_sell_all != null ? result.cannot_sell_all === "1" : null,
        transferPausable: result.transfer_pausable != null ? result.transfer_pausable === "1" : null,
        isProxy: result.is_proxy != null ? result.is_proxy === "1" : null,
        hasSelfDestruct: result.selfdestruct != null ? result.selfdestruct === "1" : null,
        isAntiWhale: result.is_anti_whale != null ? result.is_anti_whale === "1" : null,
        ownerAddress: result.owner_address ? String(result.owner_address) : null,
        creatorAddress: result.creator_address ? String(result.creator_address) : null,
        holderCount: result.holder_count ? parseInt(String(result.holder_count), 10) : null,
        totalSupply: result.total_supply ? String(result.total_supply) : null,
        topHolders,
        dexPairs,
        overallRisk: calcOverallRisk(result),
      } satisfies GoPlusTokenSecurity;
    });
  } catch {
    return null;
  }
}

// ── Address Security (Wallet Risk) ───────────────────────────────────────────

export interface GoPlusAddressSecurity {
  isMalicious: boolean;
  labels: string[];
  isContractAddress: boolean;
  isSanctioned: boolean;
  isMixer: boolean;
  isPhishing: boolean;
  isDarkweb: boolean;
  isScammer: boolean;
}

export async function checkAddressSecurity(
  address: string,
  chain = "ethereum",
): Promise<GoPlusAddressSecurity | null> {
  const chainId = toGoPlusChainId(chain);
  const key = `goplus:addr:${chainId}:${address.toLowerCase()}`;
  try {
    return await cachedFetch(key, async () => {
      const data = await gpFetch(
        `${BASE}/address_security/${address}?chain_id=${chainId}`,
      );
      if (data.code !== 1) return null;
      const r = data.result as Record<string, unknown>;
      const labels: string[] = [];
      if (r.blacklist_doubt === "1") labels.push("Blacklist");
      if (r.darkweb_transactions === "1") labels.push("Darkweb");
      if (r.cybercrime === "1") labels.push("Cybercrime");
      if (r.money_laundering === "1") labels.push("Money Laundering");
      if (r.financial_crime === "1") labels.push("Financial Crime");
      if (r.blackmail_activities === "1") labels.push("Blackmail");
      if (r.phishing_activities === "1") labels.push("Phishing");
      if (r.stealing_attack === "1") labels.push("Theft");
      if (r.fake_kyc === "1") labels.push("Fake KYC");
      if (r.malicious_mining_activities === "1") labels.push("Malicious Mining");
      if (r.mixer === "1") labels.push("Mixer");
      if (r.sanctioned === "1") labels.push("Sanctioned");
      return {
        isMalicious: labels.length > 0,
        labels,
        isContractAddress: r.contract_address === "1",
        isSanctioned: r.sanctioned === "1",
        isMixer: r.mixer === "1",
        isPhishing: r.phishing_activities === "1",
        isDarkweb: r.darkweb_transactions === "1",
        isScammer: r.stealing_attack === "1" || r.phishing_activities === "1",
      };
    });
  } catch {
    return null;
  }
}
