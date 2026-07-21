import { Router } from "express";

const router = Router();

const AGENTS = [
  {
    id: "wallet-scout",
    name: "WalletScout",
    description:
      "Deep wallet profiling — tracks transaction history, behavioral patterns, whale movements, and risk exposure across chains.",
    category: "analysis",
    status: "active",
    capabilities: [
      "Transaction history analysis",
      "Whale wallet tracking",
      "Portfolio risk scoring",
      "Cross-chain activity mapping",
    ],
  },
  {
    id: "token-sentinel",
    name: "TokenSentinel",
    description:
      "Real-time token intelligence — monitors liquidity, holder concentration, rugpull signals, and market momentum.",
    category: "analysis",
    status: "active",
    capabilities: [
      "Liquidity depth analysis",
      "Holder distribution scan",
      "Rugpull risk detection",
      "Price momentum signals",
    ],
  },
  {
    id: "contract-auditor",
    name: "ContractAuditor",
    description:
      "Automated smart contract security scanning — identifies vulnerabilities, backdoors, and malicious patterns without needing source code.",
    category: "security",
    status: "active",
    capabilities: [
      "Bytecode vulnerability scan",
      "Ownership privilege analysis",
      "Reentrancy detection",
      "Hidden mint function discovery",
    ],
  },
  {
    id: "alpha-hunter",
    name: "AlphaHunter",
    description:
      "Surfaces early alpha signals by monitoring on-chain activity, insider wallets, and emerging narrative trends before they go mainstream.",
    category: "research",
    status: "active",
    capabilities: [
      "Smart money tracking",
      "Early accumulation detection",
      "Narrative trend scoring",
      "Social signal correlation",
    ],
  },
  {
    id: "trade-commander",
    name: "TradeCommander",
    description:
      "AI-powered trading intelligence — generates entry/exit signals based on on-chain flows, market structure, and risk parameters.",
    category: "trading",
    status: "beta",
    capabilities: [
      "On-chain flow signals",
      "Market structure analysis",
      "Risk-adjusted positioning",
      "MEV opportunity detection",
    ],
  },
  {
    id: "project-analyst",
    name: "ProjectAnalyst",
    description:
      "Full-spectrum project due diligence — evaluates team credibility, tokenomics, roadmap execution, and community health.",
    category: "research",
    status: "active",
    capabilities: [
      "Team background verification",
      "Tokenomics stress testing",
      "Roadmap delivery tracking",
      "Community sentiment analysis",
    ],
  },
  {
    id: "defi-monitor",
    name: "DeFiMonitor",
    description:
      "24/7 DeFi protocol surveillance — tracks TVL shifts, exploit patterns, governance attacks, and yield opportunities.",
    category: "monitoring",
    status: "active",
    capabilities: [
      "TVL change alerts",
      "Exploit pattern recognition",
      "Governance attack detection",
      "Yield optimization signals",
    ],
  },
  {
    id: "okx-chain-scout",
    name: "OKX ChainScout",
    description:
      "Specialized intelligence for the OKX ecosystem — monitors OKT chain activity, OKX DEX flows, and OKX-native opportunities.",
    category: "analysis",
    status: "beta",
    capabilities: [
      "OKT chain transaction analysis",
      "OKX DEX liquidity tracking",
      "Cross-chain bridge monitoring",
      "OKX native yield farming alerts",
    ],
  },
  {
    id: "nft-oracle",
    name: "NFT Oracle",
    description:
      "NFT collection intelligence — tracks floor price dynamics, whale accumulation, wash trading detection, and rarity mispricing.",
    category: "analysis",
    status: "coming_soon",
    capabilities: [
      "Floor price trend analysis",
      "Wash trading detection",
      "Rarity mispricing alerts",
      "Whale accumulation patterns",
    ],
  },
];

// GET /api/agents
router.get("/", (_req, res) => {
  res.json(AGENTS);
});

export default router;
