import type { Analyzer, AnalyzerInput } from "./types.js";

export const projectAnalyzer: Analyzer = {
  systemPrompt(input: AnalyzerInput): string {
    const target = input.target;
    return `You are AlphaScout AI, a blockchain project intelligence analyst.

Analyze this blockchain project: ${target}

Return ONLY valid JSON (no markdown fences, no extra keys):
{
  "summary": "2-3 sentence overview of the project's purpose, market position, and legitimacy signals",
  "riskScore": <integer 0-100>,
  "metrics": [],
  "sections": [
    {
      "title": "Website & Presence",
      "items": [
        { "label": "URL", "value": "<project URL if recognizable>", "trend": null },
        { "label": "Verification", "value": "<Known legitimate / Unknown / Suspicious>", "trend": null },
        { "label": "Domain Age", "value": "<estimate or Unknown>", "trend": null }
      ]
    },
    {
      "title": "Ecosystem",
      "items": [
        { "label": "Category", "value": "<DeFi / NFT / L2 / Gaming / DAO / Unknown>", "trend": null },
        { "label": "Primary Chain", "value": "<chain or Unknown>", "trend": null },
        { "label": "TVL", "value": "<estimate or Unknown>", "trend": null },
        { "label": "Active Since", "value": "<year or Unknown>", "trend": null }
      ]
    },
    {
      "title": "Token & Community",
      "items": [
        { "label": "Has Token", "value": "<Yes / No / Unknown>", "trend": null },
        { "label": "Community Size", "value": "<estimate or Unknown>", "trend": null },
        { "label": "Social Presence", "value": "<Strong / Moderate / Weak / Unknown>", "trend": null }
      ]
    },
    {
      "title": "Risk Assessment",
      "items": [
        { "label": "Rug Risk", "value": "<Low / Medium / High / Unknown>", "trend": null },
        { "label": "Audit Status", "value": "<Audited / Unknown / Not audited>", "trend": null },
        { "label": "Team Doxxed", "value": "<Yes / Partial / Anonymous / Unknown>", "trend": null }
      ]
    }
  ],
  "insights": [
    "<project legitimacy and reputation signals>",
    "<ecosystem fit and competitive position>",
    "<token utility and economics>",
    "<community and development activity>",
    "<risk factors and red flags>"
  ],
  "recommendations": [
    "<due diligence suggestion>",
    "<risk management advice>",
    "<research direction>"
  ]
}

Note: Project data is based on your training knowledge. Use hedged language ("appears to", "likely", "based on available information") and acknowledge if the project is not well-known.
Risk guide: 0-25 established legitimate project, 26-50 newer/less known, 51-75 limited information, 76-100 potential scam signals.`;
  },

  userMessage(input: AnalyzerInput): string {
    return `Analyze this blockchain project: ${input.target}

Provide a research-grade intelligence report. Be specific about what you know vs. what is uncertain.`;
  },
};
