import type { Analyzer, AnalyzerInput, AnalyzerOutput, TokenScanData } from "./types.js";

function fmt(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(2)}`;
}

function pct(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function yn(v: boolean | null | undefined, yesWarn = false): string {
  if (v == null) return "Unknown";
  if (v) return yesWarn ? "⚠ Yes" : "✓ Yes";
  return yesWarn ? "✓ No" : "No";
}

export const tokenAnalyzer: Analyzer = {
  systemPrompt(_input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as TokenScanData | undefined;

    if (!d) {
      return `You are AlphaScout AI, a blockchain token intelligence engine.
Analyze the provided token and return ONLY valid JSON with: summary, riskScore (0-100), insights (5 strings), recommendations (3-4 strings), metrics (empty array).
Clearly state that live market data was unavailable.`;
    }

    const sec = d.security;
    const holderList = d.topHolders
      .slice(0, 5)
      .map((h) => `  • ${h.address.slice(0, 10)}... — ${h.pct.toFixed(2)}%${h.tag ? ` (${h.tag})` : ""}${h.isLocked ? " 🔒" : ""}`)
      .join("\n") || "  Not available";
    const pairList = d.dexPairs
      .slice(0, 3)
      .map((p) => `  • ${p.name}: ${p.liquidity} liquidity`)
      .join("\n") || "  None found";
    const socialList = d.socials.map((s) => `${s.type}: ${s.url}`).join(", ") || "None";

    return `You are AlphaScout AI, a blockchain token intelligence engine.

REAL TOKEN DATA (sourced from DexScreener + GoPlus):
════════════════════════════════════════════════════
Token      : ${d.name || "Unknown"} (${d.symbol || "?"})
Chain      : ${d.chainId || "Unknown"}
Contract   : ${d.contractAddress || "Unknown"}
Price      : ${d.priceUsd != null ? `$${d.priceUsd}` : "No price data"}
1h Change  : ${pct(d.priceChange1h)}
6h Change  : ${pct(d.priceChange6h)}
24h Change : ${pct(d.priceChange24h)}
Market Cap : ${fmt(d.marketCapUsd)}
FDV        : ${fmt(d.fdvUsd)}
Liquidity  : ${fmt(d.liquidityUsd)}
24h Volume : ${fmt(d.volumeH24)}
24h Buys   : ${d.buys24h ?? "N/A"}
24h Sells  : ${d.sells24h ?? "N/A"}
Holders    : ${d.holderCount?.toLocaleString() ?? "Unknown"}
Pair Age   : ${d.pairCreatedAt ? new Date(d.pairCreatedAt).toLocaleDateString() : "Unknown"}

DEX PAIRS:
${pairList}

SECURITY ANALYSIS (GoPlus):
Overall Risk    : ${sec.overallRisk.toUpperCase()}
Honeypot        : ${sec.isHoneypot === null ? "Unknown" : sec.isHoneypot ? "🚨 YES — HONEYPOT" : "✓ Not a honeypot"}
Buy Tax         : ${sec.buyTax ?? "Unknown"}%
Sell Tax        : ${sec.sellTax ?? "Unknown"}%
Open Source     : ${yn(sec.isOpenSource)}
Mintable        : ${yn(sec.isMintable, true)}
Hidden Owner    : ${yn(sec.hasHiddenOwner, true)}
Blacklist Fn    : ${yn(sec.hasBlacklist, true)}
Owner Takeback  : ${yn(sec.ownerCanTakeBack, true)}
Transfer Pause  : ${yn(sec.transferPausable, true)}
Self-destruct   : ${yn(sec.hasSelfDestruct, true)}
Proxy Contract  : ${yn(sec.isProxy)}
Owner Address   : ${sec.ownerAddress?.slice(0, 16) ?? "Unknown"}...
Creator Address : ${sec.creatorAddress?.slice(0, 16) ?? "Unknown"}...

TOP HOLDERS:
${holderList}

SOCIAL / WEB:
${d.websites.length > 0 ? d.websites.join(", ") : "No website detected"}
${socialList}
════════════════════════════════════════════════════

Based ONLY on the above real data, return ONLY valid JSON (no markdown):
{
  "riskScore": <0-100 based on security findings and liquidity>,
  "summary": "<2-3 sentences covering price, security, and key risk factors>",
  "insights": ["<5 specific observations from the real data>"],
  "recommendations": ["<3-4 actionable recommendations>"],
  "metrics": []
}

Risk guide: honeypot or high tax = critical (76-100); hidden owner/blacklist = high (51-75); mintable/proxy = medium (26-50); all clear = low (0-25).
NEVER invent any data not present above. If a field is "Unknown", acknowledge it.`;
  },

  userMessage(input: AnalyzerInput, scanData?: unknown): string {
    const d = scanData as TokenScanData | undefined;
    if (!d) {
      return `Analyze this token: ${input.target}${input.chain ? ` on ${input.chain}` : ""}
Note: Live market data unavailable. State this limitation clearly.`;
    }
    return `Analyze the token ${d.symbol || input.target} (${input.target}) using the real on-chain data in the system prompt.
Produce the JSON intelligence report. Cite specific numbers. Do not invent any data.`;
  },

  postProcess(output: AnalyzerOutput, _input: AnalyzerInput, scanData?: unknown): void {
    const d = scanData as TokenScanData | undefined;
    if (!d) return;

    const raw = output as unknown as Record<string, unknown>;
    if (Array.isArray(raw.recommendations)) {
      output.recommendations = (raw.recommendations as unknown[]).map(String);
      d.recommendations = output.recommendations;
    }
    output.tokenScan = d;
  },
};
