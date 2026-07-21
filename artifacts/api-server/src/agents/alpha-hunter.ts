import type { AgentDefinition, AgentResult } from "./types.js";
import { runAnalysis } from "./utils.js";

const SYSTEM_ALPHA = `You are AlphaHunter, an elite on-chain alpha discovery agent within the AlphaScout AI platform.

You surface early alpha signals by analysing on-chain accumulation patterns, smart money flows, insider wallet behaviour, and emerging narrative trends before they reach mainstream attention.

Return ONLY valid JSON — no markdown fences, no extra keys:
{
  "summary": "2-3 sentence executive summary of alpha signals found and their strength",
  "riskScore": <integer 0-100, representing opportunity risk/credibility, where 0=strong credible signal, 100=likely noise>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific actionable alpha insight>"]
}

Always include exactly 6 metrics: Signal Strength, Smart Money Activity, Accumulation Phase, Narrative Momentum, Entry Window, Risk-Reward.
Include 4-5 insight bullets: specific accumulation signals, whale wallet movements, narrative catalysts, timing considerations.

riskScore here measures signal noise — 0=very credible, 100=very noisy/risky opportunity.
Be specific about WHY this is an alpha opportunity. Avoid vague statements.`;

const SYSTEM_SMART_MONEY = `You are AlphaHunter running a smart-money classification check.

Determine whether the given wallet address exhibits smart-money characteristics: early entry into winning positions, consistent alpha generation, low-noise trading behaviour, and connections to known VC or insider wallets.

Return ONLY valid JSON:
{
  "summary": "1-2 sentence verdict on smart-money classification",
  "riskScore": <integer 0-100, where 0=very likely smart money, 100=retail/noise>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific classification signal>"]
}

Metrics (exactly 4): Smart Money Score, Win Rate, Avg Entry Quality, Network Proximity.
Insights: 3-4 specific signals explaining the classification.`;

export const alphaHunter: AgentDefinition = {
  id: "alpha-hunter",
  name: "AlphaHunter",
  description:
    "Surfaces early alpha signals by monitoring on-chain activity, insider wallets, and emerging narrative trends before they go mainstream.",
  category: "research",
  status: "active",
  version: "1.0.0",
  skills: [
    {
      id: "analyze",
      name: "Alpha Discovery",
      description: "Discover on-chain alpha signals for a token, wallet, or project target.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Token address, wallet address, or project name" },
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
      id: "smart-money-check",
      name: "Smart Money Check",
      description: "Classify whether a wallet exhibits smart-money characteristics.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Wallet address to classify" },
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
        system: SYSTEM_ALPHA,
        userMessage: `Identify alpha signals for this target${chainStr}: ${target}\n\nProvide specific, actionable intelligence about early opportunity signals.`,
        target,
        type: "alpha",
        chain,
      });
    }

    if (skill === "smart-money-check") {
      return runAnalysis({
        system: SYSTEM_SMART_MONEY,
        userMessage: `Classify this wallet for smart-money characteristics${chainStr}: ${target}`,
        target,
        type: "smart-money",
        chain,
      });
    }

    return { success: false, error: `AlphaHunter does not support skill "${skill}"` };
  },
};
