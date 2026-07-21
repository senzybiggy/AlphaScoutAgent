import type { Analyzer, AnalyzerInput } from "./types.js";

export const walletAnalyzer: Analyzer = {
  systemPrompt(input: AnalyzerInput): string {
    const chain = input.chain ?? "unknown chain";
    return `You are AlphaScout AI, an expert blockchain intelligence engine specialising in wallet analysis.

You are analyzing a ${chain} wallet address. Produce a credible, detailed intelligence report.

Return ONLY valid JSON with this EXACT structure — no markdown fences, no extra keys, no comments:
{
  "summary": "2-3 sentence executive summary covering activity level, asset profile, and risk posture",
  "riskScore": <integer 0-100, where 0=pristine, 100=extreme risk>,
  "metrics": [],
  "sections": [
    {
      "title": "Network",
      "items": [
        { "label": "Chain", "value": "<chain name, e.g. Ethereum Mainnet>", "trend": null },
        { "label": "Address Type", "value": "<EOA | Multi-sig | Contract Wallet>", "trend": null },
        { "label": "Active Since", "value": "<approximate date or block era>", "trend": null }
      ]
    },
    {
      "title": "Portfolio Summary",
      "items": [
        { "label": "Estimated Value", "value": "<USD estimate>", "trend": "<up|down|neutral>" },
        { "label": "Native Balance", "value": "<amount + ticker>", "trend": "<up|down|neutral>" },
        { "label": "Token Positions", "value": "<count> tokens", "trend": null }
      ]
    },
    {
      "title": "Recent Activity",
      "items": [
        { "label": "Last Active", "value": "<relative time>", "trend": null },
        { "label": "Total Transactions", "value": "<count>", "trend": "<up|down|neutral>" },
        { "label": "7-Day Tx Count", "value": "<count>", "trend": "<up|down|neutral>" }
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
- 0–25: clean wallet, no red flags
- 26–50: minor signals (mixers in proximity, dust attacks, low activity)
- 51–75: moderate risk (linked to suspicious contracts, unusual fund flows)
- 76–100: high risk (mixer interactions, sanctioned addresses, rug-adjacent)

Insights: 4-5 specific bullets covering behavioural patterns, notable interactions, risk signals, or smart-money indicators.
Use hedged language ("likely", "appears to") since you lack live chain access. Be realistic and specific.`;
  },

  userMessage(input: AnalyzerInput): string {
    const chain = input.chain ? ` on ${input.chain}` : "";
    return `Analyze this wallet address${chain}: ${input.target}

Produce a realistic, detailed intelligence report as if you have analysed on-chain data for this address. Be specific and professional.`;
  },
};
