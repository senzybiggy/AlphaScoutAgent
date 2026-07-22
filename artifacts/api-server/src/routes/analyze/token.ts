import type { Analyzer, AnalyzerInput, AnalyzerOutput, AnalyzerMeta, TokenScanData } from "./types.js";

function usd(n: number | null | undefined): string {
  if (n == null) return "Data unavailable from providers.";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(n < 0.01 ? 8 : n < 1 ? 4 : 2)}`;
}
function pct(n: number | null | undefined): string {
  if (n == null) return "Data unavailable from providers.";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function yn(v: boolean | null | undefined, warnTrue = false): string {
  if (v == null) return "Data unavailable from providers.";
  if (v) return warnTrue ? "⚠ YES" : "✓ Yes";
  return warnTrue ? "✓ No" : "No";
}

export const tokenAnalyzer: Analyzer = {
  systemPrompt(_input: AnalyzerInput, scanData?: unknown, meta?: AnalyzerMeta): string {
    const d = scanData as TokenScanData | undefined;
    const maxConfidence = meta?.dataQualityScore ?? 20;
    const fieldSrc = meta?.fieldSources ?? {};

    if (!d) {
      return `You are AlphaScout AI, a token intelligence engine.
IMPORTANT: Live token data was unavailable from all providers. Do NOT invent or estimate any values.
Return ONLY valid JSON:
{ "executiveSummary": "Live token data was unavailable from all providers. No analysis can be performed without verified on-chain data.", "riskScore": 50, "keyFindings": ["Data unavailable from providers — no analysis generated"], "risks": ["Cannot assess risk without verified data"], "opportunities": [], "recommendations": ["Retry the scan — providers may be temporarily unavailable"], "confidenceScore": ${maxConfidence}, "metrics": [] }`;
    }

    const sec = d.security;
    const provNote = (src: string | undefined) => src ? `[${src}]` : "[source: unverified]";
    const holderList = d.topHolders.slice(0, 8).map((h) =>
      `  • ${h.address.slice(0, 12)}...${h.tag ? ` [${h.tag}]` : ""}: ${h.pct.toFixed(2)}%${h.isLocked ? " 🔒 locked" : ""}`
    ).join("\n") || "  Data unavailable from providers.";
    const pairList = d.dexPairs.slice(0, 4).map((p) =>
      `  • ${p.name}: ${p.liquidity} liquidity`
    ).join("\n") || "  None found";
    const cgCom = d.cgCommunity;
    const communitySection = cgCom ? `
COMMUNITY & SOCIAL (CoinGecko ${provNote(fieldSrc.cgCommunity)}):
  Twitter followers  : ${cgCom.twitterFollowers?.toLocaleString() ?? "Data unavailable from providers."}
  Reddit subscribers : ${cgCom.redditSubscribers?.toLocaleString() ?? "Data unavailable from providers."}
  Telegram size      : ${cgCom.telegramSize?.toLocaleString() ?? "Data unavailable from providers."}
  Community score    : ${cgCom.communityScore?.toFixed(1) ?? "Data unavailable from providers."} / 100
  Liquidity score    : ${cgCom.liquidityScore?.toFixed(1) ?? "Data unavailable from providers."} / 100` : "";
    const cgDetails = d.cgDescription ? `\nTOKEN DESCRIPTION (CoinGecko):\n  ${d.cgDescription.slice(0, 300)}...` : "";
    const categories = d.cgCategories?.length ? `\n  Categories: ${d.cgCategories.join(", ")}` : "";
    const athInfo = d.cgAthUsd ? `\n  All-Time High: ${usd(d.cgAthUsd)} (currently ${pct(d.cgAthChangePercent)} from ATH)` : "";

    return `You are AlphaScout AI, a blockchain token intelligence engine.

VERIFIED TOKEN DATA (sources: ${d.dataSource}, fetched: ${new Date(d.fetchedAt).toUTCString()})
Data quality: ${meta?.dataQualityScore ?? "unknown"}% | Reliability: ${meta?.reliabilityScore ?? "unknown"}%
══════════════════════════════════════════════════════════════
TOKEN IDENTITY
  Name / Symbol    : ${d.name || "Data unavailable from providers."} (${d.symbol || "?"})
  Chain            : ${d.chainId || "Data unavailable from providers."}
  Contract Address : ${d.contractAddress || "Data unavailable from providers."}
  Listed on DEX    : ${yn(sec.isInDex)}
  Pair Created     : ${d.pairCreatedAt ? new Date(d.pairCreatedAt).toLocaleDateString() : "Data unavailable from providers."}
  Genesis Date     : ${d.cgGenesisDate ?? "Data unavailable from providers."}${categories}

MARKET DATA ${provNote(fieldSrc.priceUsd)}
  Price            : ${d.priceUsd != null ? `$${d.priceUsd}` : "Data unavailable from providers."}
  1h Change        : ${pct(d.priceChange1h)}
  6h Change        : ${pct(d.priceChange6h)}
  24h Change       : ${pct(d.priceChange24h)}${athInfo}
  Market Cap       : ${usd(d.marketCapUsd)}
  FDV              : ${usd(d.fdvUsd)}
  Liquidity        : ${usd(d.liquidityUsd)} ${provNote(fieldSrc.liquidityUsd)}
  24h Volume       : ${usd(d.volumeH24)}
  24h Buys / Sells : ${d.buys24h ?? "Data unavailable from providers."} / ${d.sells24h ?? "Data unavailable from providers."}
  Total Holders    : ${d.holderCount != null ? d.holderCount.toLocaleString() : "Data unavailable from providers."} ${provNote(fieldSrc.holderCount)}

DEX PAIRS:
${pairList}

CONTRACT SECURITY ${provNote(fieldSrc.honeypotCheck)}:
  Overall Risk       : ${sec.overallRisk.toUpperCase()}
  Honeypot           : ${sec.isHoneypot === null ? "Data unavailable from providers." : sec.isHoneypot ? "🚨 HONEYPOT CONFIRMED" : "✓ Not a honeypot"}
  Source Code        : ${sec.isOpenSource === null ? "Data unavailable from providers." : sec.isOpenSource ? "✓ Verified / Open Source" : "⚠ NOT VERIFIED — bytecode only"}
  Buy Tax            : ${sec.buyTax ?? "Data unavailable from providers."}%
  Sell Tax           : ${sec.sellTax ?? "Data unavailable from providers."}%
  Mintable           : ${yn(sec.isMintable, true)}
  Hidden Owner       : ${yn(sec.hasHiddenOwner, true)}
  Blacklist Function : ${yn(sec.hasBlacklist, true)}
  Owner Can Takeback : ${yn(sec.ownerCanTakeBack, true)}
  Transfer Pausable  : ${yn(sec.transferPausable, true)}
  Self-Destruct      : ${yn(sec.hasSelfDestruct, true)}
  Anti-Whale         : ${yn(sec.isAntiWhale)}
  Proxy Contract     : ${yn(sec.isProxy)}

TOP HOLDERS (concentration analysis ${provNote(fieldSrc.topHolders)}):
${holderList}
${communitySection}${cgDetails}

SOCIAL / WEBSITE:
  Websites : ${d.websites.length > 0 ? d.websites.join(", ") : "None detected"}
  Socials  : ${d.socials.map((s) => `${s.type}: ${s.url}`).join(" | ") || "None detected"}
══════════════════════════════════════════════════════════════

CRITICAL INSTRUCTIONS:
1. NEVER invent prices, market caps, holder counts, or security flags not shown above.
2. If a field says "Data unavailable from providers.", you MUST repeat that phrase — do not substitute a guess.
3. Your confidenceScore MUST NOT exceed ${maxConfidence} (data quality cap).
4. Risk score for honeypot must be 95-100; do not lower it regardless of other factors.

Based ONLY on the verified data above, return ONLY valid JSON (no markdown fences):
{
  "executiveSummary": "<2-3 sentences. State token name, price (or 'price data unavailable'), security verdict. Be specific about data gaps.>",
  "riskScore": <0-100. Honeypot=100; high tax=85+; hidden owner/blacklist=70+; unverified=60+; mintable=50+; all clear+verified=0-25. If security data unavailable, use 50.>,
  "keyFindings": ["<5 findings. For any unavailable field, say 'Data unavailable from providers for [field name]'. Cite only verified data.>"],
  "risks": ["<3-4 risks. Reference only confirmed GoPlus flags and verified market data.>"],
  "opportunities": ["<2-3 upside factors from verified data only.>"],
  "recommendations": ["<3-4 actionable items based on verified data>"],
  "confidenceScore": <0-${maxConfidence}. MUST NOT exceed ${maxConfidence}.>,
  "metrics": []
}`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown, meta?: AnalyzerMeta): string {
    const d = scanData as TokenScanData | undefined;
    const maxConf = meta?.dataQualityScore ?? 20;
    if (!d) return `Analyze token: ${input.target}. Data unavailable from all providers. Keep confidenceScore at ${maxConf}.`;
    return `Produce the intelligence report for ${d.symbol || input.target} (${input.target}) using ONLY the verified data in the system prompt. For fields marked "Data unavailable from providers.", reproduce that phrase exactly. Your confidenceScore must not exceed ${maxConf}.`;
  },

  postProcess(output: AnalyzerOutput, _input: AnalyzerInput, scanData?: unknown): void {
    const d = scanData as TokenScanData | undefined;
    const raw = output as unknown as Record<string, unknown>;
    if (typeof raw.executiveSummary === "string") output.summary = raw.executiveSummary;
    if (Array.isArray(raw.keyFindings)) output.insights = (raw.keyFindings as unknown[]).map(String);
    if (Array.isArray(raw.risks)) output.risks = (raw.risks as unknown[]).map(String);
    if (Array.isArray(raw.opportunities)) output.opportunities = (raw.opportunities as unknown[]).map(String);
    if (Array.isArray(raw.recommendations)) output.recommendations = (raw.recommendations as unknown[]).map(String);
    if (typeof raw.confidenceScore === "number") output.confidenceScore = Math.min(100, Math.max(0, Math.round(raw.confidenceScore)));
    if (d) { d.recommendations = output.recommendations ?? []; output.tokenScan = d; }
  },
};
