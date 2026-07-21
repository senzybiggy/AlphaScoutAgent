import { DetectedType } from "./detect-input-type";

export interface PlaceholderResult {
  target: string;
  type: string;
  chain: string | null;
  summary: string;
  riskScore: number;
  metrics: { label: string; value: string; trend: "up" | "down" | "neutral" | null }[];
  insights: string[];
  analyzedAt: string;
}

const WALLET_RESULTS: PlaceholderResult = {
  target: "",
  type: "wallet",
  chain: null,
  summary:
    "This wallet shows consistent accumulation behavior over the past 90 days with high on-chain activity across multiple DeFi protocols. Portfolio composition skews toward blue-chip assets with a notable exposure to newer yield strategies. No direct association with flagged mixer services detected.",
  riskScore: 28,
  metrics: [
    { label: "Total Txns", value: "1,847", trend: "up" },
    { label: "Portfolio Value", value: "$284K", trend: "up" },
    { label: "Active Since", value: "2021-03", trend: "neutral" },
    { label: "Unique Protocols", value: "34", trend: "up" },
    { label: "Avg Gas Spend", value: "$4.20", trend: "down" },
    { label: "Last Active", value: "2h ago", trend: "neutral" },
  ],
  insights: [
    "Wallet exhibits smart-money behavior — entered AAVE and Compound positions 2–3 weeks before major protocol announcements.",
    "18.4% of holdings are in locked liquidity positions with vesting schedules extending to Q4 2025.",
    "No interactions with tornado.cash, chipmixer, or other flagged mixing services in wallet history.",
    "Repeated micro-transactions suggest automated DCA strategy or bot-assisted trading activity.",
    "High NFT activity in 2022 — largely exited positions before the broader market correction.",
  ],
  analyzedAt: new Date().toISOString(),
};

const TOKEN_RESULTS: PlaceholderResult = {
  target: "",
  type: "token",
  chain: null,
  summary:
    "Token exhibits moderate liquidity depth with a holder base of approximately 12,400 unique addresses. Ownership is moderately concentrated — top 10 wallets control 38% of circulating supply. On-chain trading volume has increased 42% over the past 7 days, correlating with recent protocol announcements.",
  riskScore: 52,
  metrics: [
    { label: "Market Cap", value: "$48.2M", trend: "up" },
    { label: "Liquidity", value: "$3.1M", trend: "up" },
    { label: "Holders", value: "12,419", trend: "up" },
    { label: "7D Volume", value: "$9.8M", trend: "up" },
    { label: "Top 10 Supply", value: "38%", trend: "neutral" },
    { label: "LP Lock", value: "87 days", trend: "neutral" },
  ],
  insights: [
    "Liquidity pool is partially locked — 87 days remaining on the largest LP lock. Monitor for unlock events.",
    "Top holder wallet (0x3f4a...b92c) has been gradually distributing tokens over the past 30 days — possible early investor exit.",
    "No mint function present in contract bytecode — supply is fixed at deployment, reducing inflation risk.",
    "Token-to-ETH price correlation is 0.71 — partial independence from broader market movement.",
    "Trading volume spike on 2025-07-14 coincided with an unaudited contract upgrade — exercise caution.",
  ],
  analyzedAt: new Date().toISOString(),
};

const CONTRACT_RESULTS: PlaceholderResult = {
  target: "",
  type: "contract",
  chain: null,
  summary:
    "Smart contract bytecode analysis reveals a standard ERC-20 implementation with additional governance logic. No critical vulnerabilities detected in the execution paths sampled. Ownership is held by a multisig wallet requiring 3-of-5 signatures, which significantly reduces centralization risk.",
  riskScore: 19,
  metrics: [
    { label: "Audit Status", value: "Verified", trend: "neutral" },
    { label: "Proxy Pattern", value: "UUPS", trend: "neutral" },
    { label: "Owner Type", value: "3/5 Multisig", trend: "up" },
    { label: "Age", value: "14 months", trend: "neutral" },
    { label: "Total Calls", value: "892K", trend: "up" },
    { label: "Unique Users", value: "23,100", trend: "up" },
  ],
  insights: [
    "Contract is verified on Etherscan — source code matches deployed bytecode with no discrepancies.",
    "UUPS proxy upgrade pattern is in use. Upgrade rights are governed by the multisig, reducing single-point-of-failure risk.",
    "No hidden mint or burn functions detected in the publicly accessible contract methods.",
    "Reentrancy guards are present on all state-modifying external calls — no reentrancy vectors found.",
    "Contract interacts with 3 external price oracles (Chainlink, Uniswap TWAP, custom) — aggregation reduces manipulation risk.",
  ],
  analyzedAt: new Date().toISOString(),
};

const PROJECT_RESULTS: PlaceholderResult = {
  target: "",
  type: "project",
  chain: null,
  summary:
    "Project demonstrates strong fundamentals with a publicly doxxed team and two completed third-party audits. Tokenomics are well-structured with a 4-year vesting schedule for the team allocation. Community engagement metrics are healthy — Discord has 42K members with active daily discussion.",
  riskScore: 34,
  metrics: [
    { label: "Team", value: "Doxxed", trend: "up" },
    { label: "Audits", value: "2 completed", trend: "up" },
    { label: "TVL", value: "$127M", trend: "up" },
    { label: "GitHub", value: "Active", trend: "up" },
    { label: "Community", value: "42K Discord", trend: "up" },
    { label: "Token Vesting", value: "48 months", trend: "neutral" },
  ],
  insights: [
    "Core team has prior verifiable experience at Consensys and Binance — reduces execution risk significantly.",
    "Two audits completed by Trail of Bits and Certik. All critical findings were resolved prior to mainnet launch.",
    "Team allocation is 18% with a 12-month cliff and 48-month linear vesting — aligned long-term incentives.",
    "Roadmap milestones for Q1 and Q2 2025 were delivered on schedule. Q3 milestone (cross-chain bridge) is in progress.",
    "Community growth rate has slowed — 8% increase in the past 90 days vs 34% in the prior quarter. Monitor for disengagement.",
  ],
  analyzedAt: new Date().toISOString(),
};

const FALLBACK_RESULTS = WALLET_RESULTS;

export function buildPlaceholderResult(
  target: string,
  type: DetectedType,
  chain: string | null,
): PlaceholderResult {
  const base: PlaceholderResult =
    type === "wallet"
      ? { ...WALLET_RESULTS }
      : type === "token"
        ? { ...TOKEN_RESULTS }
        : type === "contract"
          ? { ...CONTRACT_RESULTS }
          : type === "project"
            ? { ...PROJECT_RESULTS }
            : { ...FALLBACK_RESULTS };

  return {
    ...base,
    target,
    chain: chain ?? base.chain,
    analyzedAt: new Date().toISOString(),
  };
}
