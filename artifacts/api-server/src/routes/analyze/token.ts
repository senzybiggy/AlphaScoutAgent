import type { Analyzer, AnalyzerInput } from "./types.js";

export const tokenAnalyzer: Analyzer = {
  systemPrompt(input: AnalyzerInput): string {
    const chain = input.chain ?? "unknown chain";
    return `You are AlphaScout AI, an expert blockchain intelligence engine specialising in token and ERC-20 contract analysis.

You are analyzing a token contract on ${chain}. Produce a credible market intelligence and risk report.

Return ONLY valid JSON with this EXACT structure — no markdown fences, no extra keys, no comments:
{
  "summary": "2-3 sentence executive summary covering market position, liquidity health, and key risk factors",
  "riskScore": <integer 0-100, where 0=low risk, 100=extreme risk>,
  "metrics": [],
  "sections": [
    {
      "title": "Token Overview",
      "items": [
        { "label": "Token Name", "value": "<name or Unknown>", "trend": null },
        { "label": "Token Standard", "value": "<ERC-20 | ERC-777 | BEP-20 | SPL | other>", "trend": null },
        { "label": "Total Supply", "value": "<formatted number>", "trend": null }
      ]
    },
    {
      "title": "Holder Distribution",
      "items": [
        { "label": "Holder Count", "value": "<estimate>", "trend": "<up|down|neutral>" },
        { "label": "Top-10 Wallet Share", "value": "<percentage>%", "trend": "<up|down|neutral>" },
        { "label": "Dev / Team Allocation", "value": "<percentage>%", "trend": null }
      ]
    },
    {
      "title": "Liquidity",
      "items": [
        { "label": "Liquidity Depth", "value": "<USD estimate>", "trend": "<up|down|neutral>" },
        { "label": "LP Lock Duration", "value": "<duration or Unlocked>", "trend": null },
        { "label": "7-Day Volume", "value": "<USD estimate>", "trend": "<up|down|neutral>" }
      ]
    },
    {
      "title": "Market Risk",
      "items": [
        { "label": "Honeypot Risk", "value": "<Low | Medium | High | Likely>", "trend": null },
        { "label": "Mint Function", "value": "<Present | Removed | Renounced>", "trend": null },
        { "label": "Blacklist Function", "value": "<Present | Absent>", "trend": null }
      ]
    }
  ],
  "insights": [
    "<specific, actionable intelligence bullet>",
    "<specific, actionable intelligence bullet>",
    "<specific, actionable intelligence bullet>",
    "<specific, actionable intelligence bullet>",
    "<specific, actionable intelligence bullet>"
  ]
}

Risk scoring guide:
- 0–25: strong fundamentals, well-distributed, audited
- 26–50: moderate concerns (LP partially unlocked, some concentration)
- 51–75: notable risk (unaudited, high concentration, unusual volume)
- 76–100: high rug risk (no LP lock, single owner, honeypot patterns)

Insights: 4-5 specific bullets covering holder concentration risk, LP unlock events, contract function risks, trading anomalies, and positive signals.
Use hedged language since you lack live data. Be analytical and specific.`;
  },

  userMessage(input: AnalyzerInput): string {
    const chain = input.chain ? ` on ${input.chain}` : "";
    return `Analyze this token contract address${chain}: ${input.target}

Produce a realistic market intelligence and risk assessment. Be specific and professional.`;
  },
};
