import type { AgentDefinition, AgentResult } from "./types.js";
import { runAnalysis } from "./utils.js";

const SYSTEM_ANALYZE = `You are TokenSentinel, an elite token intelligence agent within the AlphaScout AI platform.

You specialise in real-time token analysis: market structure, liquidity health, holder concentration, rug-pull risk, and on-chain trading signals.

Return ONLY valid JSON — no markdown fences, no extra keys:
{
  "summary": "2-3 sentence executive summary of token health and key risk factors",
  "riskScore": <integer 0-100>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific intelligence bullet>"]
}

Always include exactly 6 metrics: Estimated Market Cap, Liquidity Depth, Holder Count, 7-Day Volume, Top-10 Supply %, LP Lock Duration.
Include 4-5 insight bullets: holder concentration, LP unlock events, hidden mint/blacklist risk, volume anomalies, and positive signals.

Risk guide: 0-25 strong; 26-50 moderate concerns; 51-75 notable risk; 76-100 high rug risk.`;

const SYSTEM_HONEYPOT = `You are TokenSentinel running a focused honeypot and exit-liquidity scan.

Analyse the given token/contract for: sell restrictions, hidden blacklist functions, LP ownership concentration, abnormal buy/sell tax delta, and absence of verifiable LP lock.

Return ONLY valid JSON:
{
  "summary": "1-2 sentence verdict on honeypot risk",
  "riskScore": <integer 0-100>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific finding>"]
}

Metrics (exactly 4): Sell Restriction, Max Tax Delta, LP Lock Status, Owner Privileges.
Insights: 3-4 specific findings. Be direct about risk.`;

export const tokenSentinel: AgentDefinition = {
  id: "token-sentinel",
  name: "TokenSentinel",
  description:
    "Real-time token intelligence — monitors liquidity, holder concentration, rugpull signals, and market momentum.",
  category: "analysis",
  status: "active",
  version: "1.0.0",
  skills: [
    {
      id: "analyze",
      name: "Token Analysis",
      description: "Full token intelligence report: market metrics, holder distribution, liquidity, and risk score.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Token contract address" },
          chain: {
            type: "string",
            description: "Blockchain network",
            enum: ["ethereum", "solana", "base", "arbitrum", "okx-xlayer"],
          },
        },
        required: ["target"],
      },
    },
    {
      id: "honeypot-check",
      name: "Honeypot Check",
      description: "Focused honeypot and exit-liquidity scan for a token contract.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Token contract address" },
          chain: { type: "string", description: "Blockchain network" },
        },
        required: ["target"],
      },
    },
  ],

  async run(skill: string, params: Record<string, unknown>): Promise<AgentResult> {
    const target = String(params.target ?? "").trim();
    if (!target) return { success: false, error: "target is required" };

    const chain = params.chain ? String(params.chain) : null;
    const chainStr = chain ? ` on ${chain}` : "";

    if (skill === "analyze") {
      return runAnalysis({
        system: SYSTEM_ANALYZE,
        userMessage: `Analyze this token contract${chainStr}: ${target}`,
        target,
        type: "token",
        chain,
      });
    }

    if (skill === "honeypot-check") {
      return runAnalysis({
        system: SYSTEM_HONEYPOT,
        userMessage: `Run a honeypot and exit-liquidity scan on this token${chainStr}: ${target}`,
        target,
        type: "token",
        chain,
      });
    }

    return { success: false, error: `TokenSentinel does not support skill "${skill}"` };
  },
};
