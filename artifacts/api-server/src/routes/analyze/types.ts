export interface AnalyzerInput {
  target: string;
  type: "wallet" | "token" | "contract" | "project";
  chain?: string;
}

export interface AnalyzerMetric {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral" | null;
}

export interface AnalyzerSectionItem {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral" | null;
}

export interface AnalyzerSection {
  title: string;
  items: AnalyzerSectionItem[];
}

// ── Wallet scan types ────────────────────────────────────────────────────────

export interface WalletToken {
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

export interface WalletNFT {
  tokenAddress: string;
  tokenId: string;
  name: string;
  collection: string;
  image: string | null;
  floorPriceUsd: number | null;
}

export interface WalletTx {
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

export interface DeFiPosition {
  protocol: string;
  type: string;
  valueUsd: number | null;
  tokens: string[];
  apy: string | null;
  status: string;
}

export interface WalletScanData {
  chain: string;
  dataSource: "moralis" | "blockstream" | "limited";
  fetchedAt: string;
  nativeBalance: string;
  nativeSymbol: string;
  nativeBalanceUsd: number | null;
  totalNetWorthUsd: number | null;
  txCount: number;
  firstTxDate: string | null;
  lastTxDate: string | null;
  walletAgeDays: number | null;
  totalGasSpentNative: string | null;
  chainsUsed: string[];
  walletLabels: string[];
  tokens: WalletToken[];
  nfts: WalletNFT[];
  defiPositions: DeFiPosition[];
  recentTransactions: WalletTx[];
  topContracts: { address: string; label: string | null; txCount: number }[];
  topCounterparties: {
    address: string;
    label: string | null;
    txCount: number;
    direction: "in" | "out" | "both";
  }[];
  addressRiskLabels: string[];
  isSanctioned: boolean;
  isMixer: boolean;
  isScammer: boolean;
  smartMoneyScore: number | null;
  walletHealthScore: number | null;
  recommendations: string[];
}

// ── Token scan types ─────────────────────────────────────────────────────────

export interface TokenSecurity {
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
  ownerAddress: string | null;
  creatorAddress: string | null;
  overallRisk: "low" | "medium" | "high" | "critical" | "unknown";
}

export interface TokenScanData {
  dataSource: string;
  fetchedAt: string;
  symbol: string;
  name: string;
  chainId: string | null;
  contractAddress: string | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  priceChange6h: number | null;
  priceChange1h: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  volumeH24: number | null;
  buys24h: number | null;
  sells24h: number | null;
  holderCount: number | null;
  topHolders: { address: string; pct: number; tag: string | null; isLocked: boolean }[];
  dexPairs: { name: string; liquidity: string; pair: string }[];
  pairCreatedAt: string | null;
  imageUrl: string | null;
  websites: string[];
  socials: { type: string; url: string }[];
  security: TokenSecurity;
  recommendations: string[];
}

// ── Contract scan types ──────────────────────────────────────────────────────

export interface ContractScanData {
  dataSource: string;
  fetchedAt: string;
  chainId: string | null;
  security: TokenSecurity;
  ownerAddress: string | null;
  totalSupply: string | null;
  holderCount: number | null;
  recommendations: string[];
}

// ── Analyzer output ──────────────────────────────────────────────────────────

export interface AnalyzerOutput {
  summary: string;
  riskScore: number;
  metrics: AnalyzerMetric[];
  insights: string[];
  sections: AnalyzerSection[];
  // Extended rich scan data
  walletScan?: WalletScanData;
  tokenScan?: TokenScanData;
  contractScan?: ContractScanData;
  recommendations?: string[];
  smartMoneyScore?: number;
  walletHealthScore?: number;
}

export interface Analyzer {
  systemPrompt(input: AnalyzerInput, scanData?: unknown): string;
  userMessage(input: AnalyzerInput, scanData?: unknown): string;
  postProcess?(output: AnalyzerOutput, input: AnalyzerInput, scanData?: unknown): void;
}
