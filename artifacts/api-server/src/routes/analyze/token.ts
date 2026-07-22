import type { Analyzer, AnalyzerInput, AnalyzerOutput, TokenScanData } from "./types.js";

function usd(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(n < 0.01 ? 8 : n < 1 ? 4 : 2)}`;
}
function pct(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function yn(v: boolean | null | undefined, warnTrue = false): string {
  if (v == null) return "Unknown";
  if (v) return warnTrue ? "⚠ YES" : "✓ Yes";
  return warnTrue ? "✓ No" : "No";
}

export const tokenAnalyzer: Analyzer = {
  systemPrompt(_input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as TokenScanData | undefined;
    if (!d) {
      return `You are AlphaScout AI, a token intelligence engine. Analyze the token. State live data was unavailable.
Return ONLY valid JSON: { "executiveSummary": "...", "riskScore": 50, "keyFindings": ["..."], "risks": ["..."], "opportunities": ["..."], "recommendations": ["..."], "confidenceScore": 20, "metrics": [] }`;
    }

    const sec = d.security;
    const holderList = d.topHolders.slice(0, 8).map((h) =>
      `  • ${h.address.slice(0, 12)}...${h.tag ? ` [${h.tag}]` : ""}: ${h.pct.toFixed(2)}%${h.isLocked ? " 🔒 locked" : ""}`
    ).join("\n") || "  Not available";
    const pairList = d.dexPairs.slice(0, 4).map((p) =>
      `  • ${p.name}: ${p.liquidity} liquidity — ${p.pair.slice(0, 14)}...`
    ).join("\n") || "  None found";
    const cgCom = d.cgCommunity;
    const communitySection = cgCom ? `
COMMUNITY & SOCIAL (CoinGecko):
  Twitter followers  : ${cgCom.twitterFollowers?.toLocaleString() ?? "N/A"}
  Reddit subscribers : ${cgCom.redditSubscribers?.toLocaleString() ?? "N/A"}
  Telegram size      : ${cgCom.telegramSize?.toLocaleString() ?? "N/A"}
  Community score    : ${cgCom.communityScore?.toFixed(1) ?? "N/A"} / 100
  Liquidity score    : ${cgCom.liquidityScore?.toFixed(1) ?? "N/A"} / 100` : "";
    const cgDetails = d.cgDescription ? `\nTOKEN DESCRIPTION (CoinGecko):\n  ${d.cgDescription.slice(0, 300)}...` : "";
    const categories = d.cgCategories?.length ? `\n  Categories: ${d.cgCategories.join(", ")}` : "";
    const athInfo = d.cgAthUsd ? `\n  All-Time High: ${usd(d.cgAthUsd)} (currently ${pct(d.cgAthChangePercent)} from ATH)` : "";
    const github = d.cgGithubUrls?.length ? `\n  GitHub: ${d.cgGithubUrls[0]}` : "";

    return `You are AlphaScout AI, a blockchain token intelligence engine.

LIVE TOKEN DATA (source: ${d.dataSource}, fetched: ${new Date(d.fetchedAt).toUTCString()})
══════════════════════════════════════════════════════════════
TOKEN IDENTITY
  Name / Symbol    : ${d.name || "Unknown"} (${d.symbol || "?"})
  Chain            : ${d.chainId || "Unknown"}
  Contract Address : ${d.contractAddress || "Unknown"}
  Listed on DEX    : ${yn(d.security.isInDex)}
  Pair Created     : ${d.pairCreatedAt ? new Date(d.pairCreatedAt).toLocaleDateString() : "Unknown"}
  Genesis Date     : ${d.cgGenesisDate ?? "Unknown"}${categories}

MARKET DATA (DexScreener + CoinGecko)
  Price            : ${d.priceUsd != null ? `$${d.priceUsd}` : "No price data"}
  1h Change        : ${pct(d.priceChange1h)}
  6h Change        : ${pct(d.priceChange6h)}
  24h Change       : ${pct(d.priceChange24h)}${athInfo}
  Market Cap       : ${usd(d.marketCapUsd)}
  FDV              : ${usd(d.fdvUsd)}
  Liquidity        : ${usd(d.liquidityUsd)}
  24h Volume       : ${usd(d.volumeH24)}
  24h Buys / Sells : ${d.buys24h ?? "N/A"} / ${d.sells24h ?? "N/A"}
  Total Holders    : ${d.holderCount?.toLocaleString() ?? "Unknown"}

DEX PAIRS:
${pairList}

CONTRACT SECURITY (GoPlus):
  Overall Risk       : ${sec.overallRisk.toUpperCase()}
  Honeypot           : ${sec.isHoneypot === null ? "Unknown" : sec.isHoneypot ? "🚨 HONEYPOT CONFIRMED" : "✓ Not a honeypot"}
  Source Code        : ${sec.isOpenSource === null ? "Unknown" : sec.isOpenSource ? "✓ Verified / Open Source" : "⚠ NOT VERIFIED — unverified contract"}
  Buy Tax            : ${sec.buyTax ?? "Unknown"}%
  Sell Tax           : ${sec.sellTax ?? "Unknown"}%
  Mintable           : ${yn(sec.isMintable, true)}
  Hidden Owner       : ${yn(sec.hasHiddenOwner, true)}
  Blacklist Function : ${yn(sec.hasBlacklist, true)}
  Owner Can Takeback : ${yn(sec.ownerCanTakeBack, true)}
  Transfer Pausable  : ${yn(sec.transferPausable, true)}
  Self-Destruct      : ${yn(sec.hasSelfDestruct, true)}
  External Calls     : ${yn(sec.hasExternalCalls, true)}
  Anti-Whale         : ${yn(sec.isAntiWhale)}
  Proxy Contract     : ${yn(sec.isProxy)}
  LP Holder Count    : ${sec.lpHolderCount ?? "Unknown"}
  LP Top Holder %    : ${sec.lpTopHolderPct != null ? `${parseFloat(sec.lpTopHolderPct).toFixed(2)}%` : "Unknown"}
  Creator Address    : ${sec.creatorAddress?.slice(0, 18) ?? "Unknown"}...
  Creator Holds      : ${sec.creatorHoldPct != null ? `${parseFloat(sec.creatorHoldPct).toFixed(2)}%` : "Unknown"}
  Owner Address      : ${sec.ownerAddress?.slice(0, 18) ?? "Unknown"}...
  Owner Holds        : ${sec.ownerHoldPct != null ? `${parseFloat(sec.ownerHoldPct).toFixed(2)}%` : "Unknown"}

TOP HOLDERS (concentration analysis):
${holderList}
${communitySection}${cgDetails}${github}

SOCIAL / WEBSITE:
  Websites : ${d.websites.length > 0 ? d.websites.join(", ") : "None detected"}
  Socials  : ${d.socials.map((s) => `${s.type}: ${s.url}`).join(" | ") || "None detected"}
══════════════════════════════════════════════════════════════

Based ONLY on the real data above, return ONLY valid JSON (no markdown fences):
{
  "executiveSummary": "<2-3 sentences. State token name, current price, market cap, overall security verdict, and key risk factor. Be specific.>",
  "riskScore": <0-100. Honeypot=100; high tax=85+; hidden owner/blacklist=70+; unverified=60+; mintable=50+; all clear+verified=0-25>,
  "keyFindings": ["<5 specific findings referencing exact data: price action, liquidity depth, holder concentration, security flags, community metrics>"],
  "risks": ["<3-4 specific risks with data: top holder concentration %, tax levels, dangerous functions detected, low liquidity vs mcap, etc.>"],
  "opportunities": ["<2-3 upside factors if any: strong community metrics, low risk score, growing liquidity, use case, etc. Only cite real data.>"],
  "recommendations": ["<3-4 actionable items: due diligence steps, position sizing given risks, contract verification check, etc.>"],
  "confidenceScore": <0-100. 90+ if DexScreener+GoPlus+CoinGecko all present; 70-89 if DexScreener+GoPlus; 40-69 if partial data; <40 if minimal data>,
  "metrics": []
}

RULES: Never invent prices, market caps, or holder counts. If "Unknown", acknowledge it. Every risk finding must cite a specific data point.`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as TokenScanData | undefined;
    if (!d) return `Analyze token: ${input.target}${input.chain ? ` on ${input.chain}` : ""}. State data unavailable.`;
    return `Produce the intelligence report for ${d.symbol || input.target} (${input.target}) using the live data in the system prompt. Cite exact numbers.`;
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
