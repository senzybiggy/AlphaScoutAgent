import type { Analyzer, AnalyzerInput, AnalyzerOutput, WalletScanData } from "./types.js";

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "Unknown";
  return n >= 1_000_000_000
    ? `${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : n.toFixed(decimals);
}

function usd(n: number | null | undefined): string {
  if (n == null) return "Unknown";
  return `$${fmt(n, n < 1 ? 4 : 2)}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diffMs / 86_400_000);
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
      // Fallback: no real data available
      return `You are AlphaScout AI, an expert blockchain intelligence engine.
Analyze the provided wallet address and produce a credible intelligence report.
State clearly that live data was unavailable and base your analysis on address patterns only.
Return ONLY valid JSON with keys: summary, riskScore (0-100), insights (array of 5 strings), recommendations (array of 3-4 strings), walletLabels (array), smartMoneyScore (0-100), walletHealthScore (0-100), metrics (empty array).`;
    }

    const tokenValue = d.tokens.reduce((s, t) => s + (t.usdValue ?? 0), 0);
    const defiValue = d.defiPositions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);
    const topTokenList = d.tokens
      .slice(0, 8)
      .map((t) => `  • ${t.symbol}: ${t.balanceFormatted}${t.usdValue ? ` (${usd(t.usdValue)})` : ""}`)
      .join("\n") || "  None detected";
    const defiList = d.defiPositions
      .map((p) => `  • ${p.protocol} — ${p.type}: ${p.valueUsd ? usd(p.valueUsd) : "Unknown value"}`)
      .join("\n") || "  None";
    const riskSignals = d.addressRiskLabels.length > 0
      ? d.addressRiskLabels.map((l) => `  ⚠ ${l}`).join("\n")
      : "  ✓ No risk labels detected";
    const contractList = d.topContracts
      .slice(0, 5)
      .map((c) => `  • ${c.address.slice(0, 10)}... (${c.txCount}×)`)
      .join("\n") || "  None in recent history";
    const recentActivity = d.recentTransactions
      .slice(0, 5)
      .map((t) => `  • [${t.category}] ${t.summary}`)
      .join("\n") || "  No recent transactions";

    return `You are AlphaScout AI, an expert blockchain intelligence engine.

REAL ON-CHAIN DATA (sourced from ${d.dataSource}):
═══════════════════════════════════════════════════
Portfolio Value : ${usd(d.totalNetWorthUsd)}
Native Balance  : ${d.nativeBalance} ${d.nativeSymbol}${d.nativeBalanceUsd ? ` (${usd(d.nativeBalanceUsd)})` : ""}
Token Holdings  : ${d.tokens.length} tokens${tokenValue > 0 ? ` (${usd(tokenValue)})` : ""}
NFTs Held       : ${d.nfts.length} items
DeFi Positions  : ${d.defiPositions.length}${defiValue > 0 ? ` (${usd(defiValue)})` : ""}
Transaction Count: ${d.txCount > 0 ? d.txCount : "Unknown"}
Wallet Age      : ${d.walletAgeDays != null ? `${d.walletAgeDays} days` : "Unknown"}
First Activity  : ${d.firstTxDate ? new Date(d.firstTxDate).toLocaleDateString() : "Unknown"}
Last Active     : ${d.lastTxDate ? timeAgo(d.lastTxDate) : "Unknown"}
Gas Spent       : ${d.totalGasSpentNative ?? "Unknown"}
Chains Active   : ${d.chainsUsed.join(", ") || "Unknown"}

TOP TOKENS:
${topTokenList}

DEFI POSITIONS:
${defiList}

SECURITY SIGNALS (GoPlus):
${riskSignals}${d.isSanctioned ? "\n  🚨 SANCTIONED ADDRESS" : ""}${d.isMixer ? "\n  ⚠ MIXER ACTIVITY DETECTED" : ""}

TOP RECENT CONTRACTS:
${contractList}

RECENT ACTIVITY (last 5):
${recentActivity}
═══════════════════════════════════════════════════

Based ONLY on the above real data, return ONLY valid JSON (no markdown):
{
  "riskScore": <0-100 based on actual data and risk signals>,
  "smartMoneyScore": <0-100, sophistication of holdings and trading patterns>,
  "walletHealthScore": <0-100, diversification and overall health>,
  "walletLabels": ["<1-4 labels from: DeFi Power User, NFT Collector, Long-term HODLer, Active Trader, Whale, Smart Money, New Wallet, Multi-chain User, DeFi Farmer, Passive Holder, High Risk Profile>"],
  "summary": "<2-3 sentences summarising what the real data shows>",
  "insights": ["<5 specific observations citing actual numbers from the data>"],
  "recommendations": ["<3-5 actionable suggestions based on actual holdings>"],
  "metrics": []
}

Risk guide: 0-25 clean, 26-50 minor concerns, 51-75 moderate, 76-100 high risk.
If any field is "Unknown", acknowledge that rather than guessing.
NEVER invent portfolio values, transaction counts, or any numbers not present above.`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as WalletScanData | undefined;
    if (!d) {
      return `Analyze this wallet address: ${input.target}${input.chain ? ` on ${input.chain}` : ""}
Note: Live blockchain data could not be fetched. Base your analysis on address characteristics only and clearly state this limitation.`;
    }
    return `Analyze the wallet ${input.target} using the real on-chain data provided in the system prompt.
Produce the JSON intelligence report. Cite specific numbers. Do not invent any data.`;
  },

  postProcess(output: AnalyzerOutput, _input: AnalyzerInput, scanData?: unknown): void {
    const d = scanData as WalletScanData | undefined;
    if (!d) return;

    // Parse extended AI fields from the raw output (they come through JSON)
    const raw = output as unknown as Record<string, unknown>;
    if (typeof raw.smartMoneyScore === "number") {
      output.smartMoneyScore = Math.min(100, Math.max(0, Math.round(raw.smartMoneyScore)));
      d.smartMoneyScore = output.smartMoneyScore;
    }
    if (typeof raw.walletHealthScore === "number") {
      output.walletHealthScore = Math.min(100, Math.max(0, Math.round(raw.walletHealthScore)));
      d.walletHealthScore = output.walletHealthScore;
    }
    if (Array.isArray(raw.recommendations)) {
      output.recommendations = (raw.recommendations as unknown[]).map(String);
      d.recommendations = output.recommendations;
    }
    if (Array.isArray(raw.walletLabels)) {
      d.walletLabels = (raw.walletLabels as unknown[]).map(String);
    }

    // Override riskScore bounds
    output.riskScore = Math.min(100, Math.max(0, output.riskScore));

    // Attach wallet scan to output
    output.walletScan = d;
  },
};
