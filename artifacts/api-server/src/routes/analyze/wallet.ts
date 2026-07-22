import type { Analyzer, AnalyzerInput, AnalyzerOutput, WalletScanData } from "./types.js";

const STABLES = new Set(["USDT","USDC","DAI","BUSD","TUSD","FRAX","LUSD","USDE","PYUSD","GUSD"]);

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "Unknown";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(dec)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(dec)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(n < 1 ? 4 : dec)}`;
}
function usd(n: number | null | undefined): string { return fmt(n); }
function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  if (d < 365) return `${Math.floor(d / 30)} months ago`;
  return `${Math.floor(d / 365)} years ago`;
}

export const walletAnalyzer: Analyzer = {
  systemPrompt(_input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as WalletScanData | undefined;
    if (!d) {
      return `You are AlphaScout AI, an expert blockchain intelligence engine. Analyze the wallet address from patterns only. State live data was unavailable.
Return ONLY valid JSON: { "executiveSummary": "...", "riskScore": 50, "smartMoneyScore": 50, "walletHealthScore": 50, "walletLabels": [], "keyFindings": ["..."], "risks": ["..."], "opportunities": ["..."], "recommendations": ["..."], "confidenceScore": 20, "metrics": [] }`;
    }

    const tokenValue = d.tokens.reduce((s, t) => s + (t.usdValue ?? 0), 0);
    const stableValue = d.stablecoinUsd ?? d.tokens.filter((t) => STABLES.has(t.symbol.toUpperCase())).reduce((s, t) => s + (t.usdValue ?? 0), 0);
    const defiValue = d.defiPositions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);
    const top8Tokens = d.tokens.slice(0, 8).map((t) =>
      `  • ${t.symbol} (${t.name}): ${t.balanceFormatted}${t.usdValue ? ` = ${usd(t.usdValue)}${t.portfolioPct ? ` / ${t.portfolioPct.toFixed(1)}% of portfolio` : ""}` : ""}${t.change24h != null ? ` | 24h: ${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(2)}%` : ""}`
    ).join("\n") || "  None detected";
    const stableList = d.tokens.filter((t) => STABLES.has(t.symbol.toUpperCase())).map((t) =>
      `  • ${t.symbol}: ${usd(t.usdValue)}`
    ).join("\n") || "  None";
    const defiList = d.defiPositions.map((p) =>
      `  • ${p.protocol} — ${p.type}: ${p.valueUsd ? usd(p.valueUsd) : "Unknown"}`
    ).join("\n") || "  None";
    const riskSignals = d.addressRiskLabels.length > 0
      ? d.addressRiskLabels.map((l) => `  ⚠ ${l}`).join("\n")
      : "  ✓ No risk labels detected by GoPlus";
    const contractList = d.topContracts.slice(0, 5).map((c) =>
      `  • ${c.address.slice(0, 14)}... (${c.txCount}× interactions)`
    ).join("\n") || "  No contract interactions in recent history";
    const recentActivity = d.recentTransactions.slice(0, 5).map((t) =>
      `  • [${t.category.toUpperCase()}] ${t.summary} — ${timeAgo(t.timestamp)}`
    ).join("\n") || "  No recent transactions";
    const multiChainInfo = d.multiChainBalances && d.multiChainBalances.length > 1
      ? d.multiChainBalances.map((c) => `  • ${c.chain}: ${c.formatted} ${c.symbol}`).join("\n")
      : null;

    return `You are AlphaScout AI, an expert blockchain intelligence engine.

LIVE ON-CHAIN DATA (source: ${d.dataSource}, fetched: ${new Date(d.fetchedAt).toUTCString()})
══════════════════════════════════════════════════════════════
PORTFOLIO OVERVIEW
  Total Net Worth  : ${usd(d.totalNetWorthUsd)}
  Native Balance   : ${d.nativeBalance} ${d.nativeSymbol}${d.nativeBalanceUsd ? ` (${usd(d.nativeBalanceUsd)})` : ""}
  Token Holdings   : ${d.tokens.length} tokens${tokenValue > 0 ? ` — ${usd(tokenValue)} total value` : ""}
  Stablecoin Hold  : ${usd(stableValue)} in stablecoins
  NFTs Held        : ${d.nfts.length} items
  DeFi Positions   : ${d.defiPositions.length}${defiValue > 0 ? ` — ${usd(defiValue)} total` : ""}
  Is Contract      : ${d.isContract != null ? (d.isContract ? "Yes (smart contract address)" : "No (EOA wallet)") : "Unknown"}

ACTIVITY & AGE
  Transaction Count: ${d.txCount > 0 ? d.txCount.toLocaleString() : "Unknown"}
  Wallet Age       : ${d.walletAgeDays != null ? `${d.walletAgeDays} days (${Math.floor(d.walletAgeDays / 365)} years ${Math.floor((d.walletAgeDays % 365) / 30)} months)` : "Unknown"}
  First Activity   : ${d.firstTxDate ? new Date(d.firstTxDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown"}
  Last Active      : ${d.lastTxDate ? timeAgo(d.lastTxDate) + " (" + new Date(d.lastTxDate).toLocaleDateString() + ")" : "Unknown"}
  Gas Spent Total  : ${d.totalGasSpentNative ?? "Unknown"}
  Chains Active    : ${d.chainsUsed.join(", ") || "Unknown"}

LARGEST HOLDINGS (by USD value):
${top8Tokens}

STABLECOIN HOLDINGS:
${stableList}

DEFI POSITIONS:
${defiList}
${multiChainInfo ? `\nMULTI-CHAIN NATIVE BALANCES:\n${multiChainInfo}` : ""}
SECURITY ASSESSMENT (GoPlus):
${riskSignals}${d.isSanctioned ? "\n  🚨 SANCTIONED ADDRESS — OFAC or similar list" : ""}${d.isMixer ? "\n  ⚠ MIXER ACTIVITY — privacy tool interactions detected" : ""}${d.isScammer ? "\n  🚨 SCAMMER — flagged for phishing or theft" : ""}

MOST INTERACTED CONTRACTS:
${contractList}

RECENT TRANSACTIONS (newest first):
${recentActivity}
══════════════════════════════════════════════════════════════

You have the REAL on-chain data above. Return ONLY valid JSON (no markdown fences, no extra text):
{
  "executiveSummary": "<2-3 sentences. Quote actual numbers: portfolio value, age, chain activity, key holdings. Be specific.>",
  "riskScore": <0-100 integer. Base on: GoPlus flags (+30 each for sanction/mixer/scammer, +5-15 for risk labels), portfolio concentration, transaction patterns>,
  "smartMoneyScore": <0-100. Based on: DeFi engagement, protocol diversity, token sophistication, portfolio size, first-mover signals>,
  "walletHealthScore": <0-100. Based on: diversification across tokens+stables+DeFi, activity recency, chain diversity>,
  "walletLabels": ["<1-4 from: DeFi Power User, NFT Collector, Long-term HODLer, Active Trader, Whale, Smart Money, New Wallet, Multi-chain User, DeFi Farmer, Passive Holder, High Risk Profile, Stablecoin Heavy, Bot Activity>"],
  "keyFindings": ["<5 specific observations with exact numbers from the data above>"],
  "risks": ["<3-4 risk factors citing specific data: concentration risk, risk labels, suspicious patterns, etc.>"],
  "opportunities": ["<2-3 opportunities visible in the on-chain data: underutilized capital, DeFi gaps, diversification opportunities>"],
  "recommendations": ["<3-5 actionable items based on actual holdings and patterns>"],
  "confidenceScore": <0-100. High (80-100) if Moralis/Ankr data rich; medium (50-79) if RPC only; low (<50) if minimal data>,
  "metrics": []
}

RULES:
- NEVER invent numbers not present in the data
- If a value shows "Unknown", acknowledge the data gap — do not guess
- Every finding must reference specific data from the table above
- Risk score must correlate with actual GoPlus flags (0 flags = start from 0-20 baseline)`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as WalletScanData | undefined;
    if (!d) return `Analyze wallet: ${input.target}${input.chain ? ` on ${input.chain}` : ""}. Live data unavailable — acknowledge this.`;
    return `Analyze wallet ${input.target} using the live on-chain data in the system prompt. Cite specific numbers. Never invent data.`;
  },

  postProcess(output: AnalyzerOutput, _input: AnalyzerInput, scanData?: unknown): void {
    const d = scanData as WalletScanData | undefined;
    const raw = output as unknown as Record<string, unknown>;

    // Map new fields from AI response
    if (typeof raw.executiveSummary === "string") output.summary = raw.executiveSummary;
    if (Array.isArray(raw.keyFindings)) output.insights = (raw.keyFindings as unknown[]).map(String);
    if (Array.isArray(raw.risks)) output.risks = (raw.risks as unknown[]).map(String);
    if (Array.isArray(raw.opportunities)) output.opportunities = (raw.opportunities as unknown[]).map(String);
    if (typeof raw.confidenceScore === "number") output.confidenceScore = Math.min(100, Math.max(0, Math.round(raw.confidenceScore)));
    if (typeof raw.smartMoneyScore === "number") output.smartMoneyScore = Math.min(100, Math.max(0, Math.round(raw.smartMoneyScore)));
    if (typeof raw.walletHealthScore === "number") output.walletHealthScore = Math.min(100, Math.max(0, Math.round(raw.walletHealthScore)));
    if (Array.isArray(raw.recommendations)) output.recommendations = (raw.recommendations as unknown[]).map(String);

    output.riskScore = Math.min(100, Math.max(0, output.riskScore));

    if (d) {
      if (output.smartMoneyScore != null)   d.smartMoneyScore   = output.smartMoneyScore;
      if (output.walletHealthScore != null) d.walletHealthScore = output.walletHealthScore;
      if (output.recommendations)           d.recommendations   = output.recommendations;
      if (Array.isArray(raw.walletLabels))  d.walletLabels = (raw.walletLabels as unknown[]).map(String);
      output.walletScan = d;
    }
  },
};
