/** Extended types returned by the enriched /api/analyze endpoint. */

export interface ProviderAttempt {
  provider: string;
  category: string;
  status: "success" | "failed" | "skipped";
  error: string | null;
  latencyMs: number;
}

export interface WalletToken {
  address: string; symbol: string; name: string; logo: string | null;
  balanceFormatted: string; usdPrice: number | null; usdValue: number | null;
  portfolioPct: number | null; change24h: number | null;
}
export interface WalletNFT {
  tokenAddress: string; tokenId: string; name: string; collection: string;
  image: string | null; floorPriceUsd: number | null;
}
export interface WalletTx {
  hash: string; category: string; summary: string; fromAddress: string;
  toAddress: string | null; valueFormatted: string; valueUsd: string | null;
  gasFeeNative: string | null; gasFeeUsd: string | null;
  timestamp: string; status: "success" | "failed";
}
export interface DeFiPosition {
  protocol: string; type: string; valueUsd: number | null;
  tokens: string[]; apy: string | null; status: string;
}
export interface WalletScanData {
  chain: string; dataSource: string; fetchedAt: string;
  nativeBalance: string; nativeSymbol: string;
  nativeBalanceUsd: number | null; totalNetWorthUsd: number | null;
  txCount: number; firstTxDate: string | null; lastTxDate: string | null;
  walletAgeDays: number | null; totalGasSpentNative: string | null;
  chainsUsed: string[]; walletLabels: string[];
  isContract?: boolean; stablecoinUsd?: number;
  multiChainBalances?: { chain: string; formatted: string; symbol: string }[];
  tokens: WalletToken[]; nfts: WalletNFT[]; defiPositions: DeFiPosition[];
  recentTransactions: WalletTx[];
  topContracts: { address: string; label: string | null; txCount: number }[];
  topCounterparties: { address: string; label: string | null; txCount: number; direction: "in" | "out" | "both" }[];
  addressRiskLabels: string[]; isSanctioned: boolean; isMixer: boolean; isScammer: boolean;
  smartMoneyScore: number | null; walletHealthScore: number | null; recommendations: string[];
  providerAttempts?: ProviderAttempt[];
  fieldSources?: Record<string, string>;
}
export interface TokenSecurity {
  isHoneypot: boolean | null; buyTax: string | null; sellTax: string | null;
  isOpenSource: boolean | null; isMintable: boolean | null; hasBlacklist: boolean | null;
  hasHiddenOwner: boolean | null; ownerCanTakeBack: boolean | null;
  cannotSellAll: boolean | null; transferPausable: boolean | null;
  isProxy: boolean | null; hasSelfDestruct: boolean | null;
  hasExternalCalls: boolean | null; isAntiWhale: boolean | null;
  ownerAddress: string | null; creatorAddress: string | null;
  creatorHoldPct: string | null; ownerHoldPct: string | null;
  lpHolderCount: number | null; lpTopHolderPct: string | null;
  isInDex: boolean | null;
  overallRisk: "low" | "medium" | "high" | "critical" | "unknown";
}
export interface TokenScanData {
  dataSource: string; fetchedAt: string; symbol: string; name: string;
  chainId: string | null; contractAddress: string | null;
  priceUsd: number | null; priceChange24h: number | null;
  priceChange6h: number | null; priceChange1h: number | null;
  marketCapUsd: number | null; fdvUsd: number | null;
  liquidityUsd: number | null; volumeH24: number | null;
  buys24h: number | null; sells24h: number | null; holderCount: number | null;
  totalSupply: string | null;
  topHolders: { address: string; pct: number; tag: string | null; isLocked: boolean }[];
  dexPairs: { name: string; liquidity: string; pair: string }[];
  pairCreatedAt: string | null; imageUrl: string | null;
  websites: string[]; socials: { type: string; url: string }[];
  security: TokenSecurity; recommendations: string[];
  cgDescription: string | null; cgCategories: string[];
  cgCommunity: { twitterFollowers: number | null; redditSubscribers: number | null; telegramSize: number | null; communityScore: number | null; liquidityScore: number | null } | null;
  cgAthUsd: number | null; cgAthChangePercent: number | null;
  cgGenesisDate: string | null; cgGithubUrls: string[];
  providerAttempts?: ProviderAttempt[];
  fieldSources?: Record<string, string>;
}
export interface ContractScanData {
  dataSource: string; fetchedAt: string; chainId: string | null;
  security: TokenSecurity; ownerAddress: string | null;
  totalSupply: string | null; holderCount: number | null; recommendations: string[];
  providerAttempts?: ProviderAttempt[];
  fieldSources?: Record<string, string>;
}
export interface ProjectScanData {
  dataSource: string; fetchedAt: string; url: string | null;
  title: string | null; description: string | null; bodyPreview: string | null;
  socials: { platform: string; url: string }[];
  tokenMentions: string[]; keywords: string[];
  hasWhitepaper: boolean; hasAudit: boolean;
  isPhishingSite: boolean; fetchError: string | null;
}
export interface RichAnalyzeResult {
  target: string; type: string; chain: string | null;
  summary: string; riskScore: number | null;
  metrics: { label: string; value: string; trend: string | null }[];
  sections: { title: string; items: { label: string; value: string; trend: string | null }[] }[];
  insights: string[]; analyzedAt: string;
  walletScan: WalletScanData | null;
  tokenScan: TokenScanData | null;
  contractScan: ContractScanData | null;
  projectScan: ProjectScanData | null;
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  confidenceScore: number | null;
  smartMoneyScore: number | null; walletHealthScore: number | null;
  // Verified data quality fields
  dataQualityScore: number;
  reliabilityScore: number;
  providerAttempts: ProviderAttempt[];
  fieldSources: Record<string, string>;
  isDataUnavailable?: boolean;
}

export function fmtUsd(n: number | null | undefined, compact = false): string {
  if (n == null) return "—";
  if (compact) {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  }
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: n < 1 ? 6 : 2 })}`;
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function riskColor(risk: string): string {
  switch (risk) {
    case "low": return "text-success border-success/30 bg-success/10";
    case "medium": return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
    case "high": return "text-orange-400 border-orange-400/30 bg-orange-400/10";
    case "critical": return "text-destructive border-destructive/30 bg-destructive/10";
    default: return "text-muted-foreground border-border/30 bg-muted/10";
  }
}
