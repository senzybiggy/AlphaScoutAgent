import type { Analyzer, AnalyzerInput, AnalyzerOutput, AnalyzerMeta, WalletScanData } from "./types.js";

const STABLES = new Set(["USDT","USDC","DAI","BUSD","TUSD","FRAX","LUSD","USDE","PYUSD","GUSD"]);

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "Data unavailable from providers.";
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
  systemPrompt(_input: AnalyzerInput, scanData?: unknown, meta?: AnalyzerMeta): string {
    const d = scanData as WalletScanData | undefined;
    const maxConfidence = meta?.dataQualityScore ?? 20;
    const fieldSrc = meta?.fieldSources ?? {};

    if (!d) {
      return `You are AlphaScout AI, an expert blockchain intelligence engine.
IMPORTANT: Live blockchain data was unavailable from all providers. Do NOT invent or estimate any values.
Return ONLY valid JSON:
{ "executiveSummary": "Live blockchain data was unavailable from all providers. No analysis can be performed without verified on-chain data.", "riskScore": 50, "smartMoneyScore": null, "walletHealthScore": null, "walletLabels": [], "keyFindings": ["Data unavailable from providers — no analysis generated"], "risks": ["Cannot assess risk without verified data"], "opportunities": [], "recommendations": ["Retry the scan — providers may be temporarily unavailable"], "confidenceScore": ${maxConfidence}, "metrics": [] }`;
    }

    const tokenValue = d.tokens.reduce((s, t) => s + (t.usdValue ?? 0), 0);
    const stableValue = d.stablecoinUsd ?? d.tokens.filter((t) => STABLES.has(t.symbol.toUpperCase())).reduce((s, t) => s + (t.usdValue ?? 0), 0);
    const defiValue = d.defiPositions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);
    const top8Tokens = d.tokens.slice(0, 8).map((t) =>
      `  • ${t.symbol} (${t.name}): ${t.balanceFormatted}${t.usdValue ? ` = ${usd(t.usdValue)}${t.portfolioPct ? ` / ${t.portfolioPct.toFixed(1)}% of portfolio` : ""}` : " [price unavailable]"}${t.change24h != null ? ` | 24h: ${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(2)}%` : ""}`
    ).join("\n") || "  None detected";
    const defiList = d.defiPositions.map((p) =>
      `  • ${p.protocol} — ${p.type}: ${p.valueUsd ? usd(p.valueUsd) : "Data unavailable from providers."}`
    ).join("\n") || "  None";
    const riskSignals = d.addressRiskLabels.length > 0
      ? d.addressRiskLabels.map((l) => `  ⚠ ${l}`).join("\n")
      : fieldSrc.securityCheck
        ? "  ✓ No risk labels detected by GoPlus"
        : "  ⬜ Security check unavailable from providers";
    const contractList = d.topContracts.slice(0, 5).map((c) =>
      `  • ${c.address.slice(0, 14)}... (${c.txCount}× interactions)`
    ).join("\n") || "  No contract interactions in recent history";
    const recentActivity = d.recentTransactions.slice(0, 5).map((t) =>
      `  • [${t.category.toUpperCase()}] ${t.summary} — ${timeAgo(t.timestamp)}`
    ).join("\n") || "  No recent transactions";
    const multiChainInfo = d.multiChainBalances && d.multiChainBalances.length > 1
      ? d.multiChainBalances.map((c) => `  • ${c.chain}: ${c.formatted} ${c.symbol}`).join("\n")
      : null;

    // Build field provenance notes
    const provNote = (field: string, src: string | undefined) => src ? `[source: ${src}]` : "[source: unverified]";

    return `You are AlphaScout AI, an expert blockchain intelligence engine.

VERIFIED ON-CHAIN DATA (primary source: ${d.dataSource}, fetched: ${new Date(d.fetchedAt).toUTCString()})
Data quality: ${meta?.dataQualityScore ?? "unknown"}% | Reliability: ${meta?.reliabilityScore ?? "unknown"}%
══════════════════════════════════════════════════════════════
PORTFOLIO OVERVIEW
  Total Net Worth  : ${usd(d.totalNetWorthUsd)} ${provNote("totalNetWorth", fieldSrc.totalNetWorth)}
  Native Balance   : ${d.nativeBalance && parseFloat(d.nativeBalance) > 0 ? `${d.nativeBalance} ${d.nativeSymbol}` : "Data unavailable from providers."} ${provNote("nativeBalance", fieldSrc.nativeBalance)}${d.nativeBalanceUsd ? ` (${usd(d.nativeBalanceUsd)})` : ""}
  Token Holdings   : ${d.tokens.length > 0 ? `${d.tokens.length} tokens${tokenValue > 0 ? ` — ${usd(tokenValue)} total value` : ""}` : "Data unavailable from providers."} ${provNote("tokenBalances", fieldSrc.tokenBalances)}
  Stablecoin Hold  : ${stableValue > 0 ? usd(stableValue) + " in stablecoins" : "None detected"}
  NFTs Held        : ${d.nfts.length > 0 ? d.nfts.length + " items" : "None detected or unavailable"}
  DeFi Positions   : ${d.defiPositions.length}${defiValue > 0 ? ` — ${usd(defiValue)} total` : ""}
  Is Contract      : ${d.isContract != null ? (d.isContract ? "Yes (smart contract address)" : "No (EOA wallet)") : "Data unavailable from providers."}

ACTIVITY & AGE
  Transaction Count: ${d.txCount > 0 ? d.txCount.toLocaleString() : "Data unavailable from providers."} ${provNote("txCount", fieldSrc.txCount)}
  Wallet Age       : ${d.walletAgeDays != null ? `${d.walletAgeDays} days (${Math.floor(d.walletAgeDays / 365)} years ${Math.floor((d.walletAgeDays % 365) / 30)} months)` : "Data unavailable from providers."} ${provNote("walletAge", fieldSrc.walletAge)}
  First Activity   : ${d.firstTxDate ? new Date(d.firstTxDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Data unavailable from providers."}
  Last Active      : ${d.lastTxDate ? timeAgo(d.lastTxDate) + " (" + new Date(d.lastTxDate).toLocaleDateString() + ")" : "Data unavailable from providers."}
  Gas Spent Total  : ${d.totalGasSpentNative ?? "Data unavailable from providers."}
  Chains Active    : ${d.chainsUsed.length > 0 ? d.chainsUsed.join(", ") : "Data unavailable from providers."} ${provNote("chainActivity", fieldSrc.chainActivity)}

LARGEST HOLDINGS (by USD value):
${top8Tokens}

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

CRITICAL INSTRUCTIONS:
1. NEVER invent, estimate, or extrapolate any number not shown above.
2. If a field says "Data unavailable from providers.", you MUST repeat that phrase in your finding — do not substitute a guess.
3. Your confidenceScore MUST be at most ${maxConfidence} (data quality cap) — do not report higher.
4. Only cite specific values that appear in the data above.

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "executiveSummary": "<2-3 sentences. Quote actual verified numbers only. Explicitly state any major data gaps.>",
  "riskScore": <0-100 integer. Base ONLY on: GoPlus flags (+30 each for sanction/mixer/scammer, +5-15 for risk labels). If security check unavailable, add 15 uncertainty premium.>,
  "smartMoneyScore": <0-100. Base on DeFi engagement, protocol diversity, portfolio sophistication. If data sparse, stay 30-50.>,
  "walletHealthScore": <0-100. Base on: diversification, activity recency, chain diversity. Null fields = lower score.>,
  "walletLabels": ["<1-4 labels from: DeFi Power User, NFT Collector, Long-term HODLer, Active Trader, Whale, Smart Money, New Wallet, Multi-chain User, DeFi Farmer, Passive Holder, High Risk Profile, Stablecoin Heavy, Bot Activity>"],
  "keyFindings": ["<5 specific observations. For any unavailable field, say 'Data unavailable from providers for [field]'. Cite only verified numbers.>"],
  "risks": ["<3-4 risk factors. Reference only GoPlus flags and confirmed data.>"],
  "opportunities": ["<2-3 opportunities visible in verified data only. If data is sparse, note the limitation.>"],
  "recommendations": ["<3-5 actionable items based on actual verified holdings and patterns>"],
  "confidenceScore": <0-${maxConfidence}. Must not exceed ${maxConfidence} (data quality cap).>,
  "metrics": []
}`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown, meta?: AnalyzerMeta): string {
    const d = scanData as WalletScanData | undefined;
    const maxConf = meta?.dataQualityScore ?? 20;
    if (!d) return `Analyze wallet: ${input.target}${input.chain ? ` on ${input.chain}` : ""}. Data was unavailable from all providers — acknowledge this honestly. Keep confidenceScore at ${maxConf}.`;
    return `Analyze wallet ${input.target} using ONLY the verified on-chain data in the system prompt. For any field marked "Data unavailable from providers.", repeat that exact phrase in your finding. Your confidenceScore must not exceed ${maxConf}.`;
  },

  postProcess(output: AnalyzerOutput, _input: AnalyzerInput, scanData?: unknown): void {
    const d = scanData as WalletScanData | undefined;
    const raw = output as unknown as Record<string, unknown>;
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
      if (output.smartMoneyScore   != null) d.smartMoneyScore   = output.smartMoneyScore;
      if (output.walletHealthScore != null) d.walletHealthScore = output.walletHealthScore;
      if (output.recommendations)           d.recommendations   = output.recommendations;
      if (Array.isArray(raw.walletLabels))  d.walletLabels = (raw.walletLabels as unknown[]).map(String);
      output.walletScan = d;
    }
  },
};
