import type { AgentDefinition, AgentResult } from "./types.js";
import { runAnalysis } from "./utils.js";

const SYSTEM_ANALYZE = `You are OKX ChainScout, an elite OKX ecosystem intelligence agent within the AlphaScout AI platform.

You specialise in the OKX ecosystem: OKX X Layer (formerly OKC), OKX DEX, OKB token dynamics, OKX CEX on-chain flows, and cross-chain bridge activity between OKX and other networks.

Return ONLY valid JSON — no markdown fences, no extra keys:
{
  "summary": "2-3 sentence executive summary focused on OKX ecosystem relevance and opportunity",
  "riskScore": <integer 0-100>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific OKX-ecosystem intelligence bullet>"]
}

Always include exactly 6 metrics: OKX Ecosystem Presence, X Layer Activity, OKX DEX Volume, OKB Correlation, Bridge Flow, Liquidity Rating.
Include 4-5 insight bullets specifically about OKX ecosystem dynamics, X Layer deployment status, OKX DEX listing/liquidity, and cross-chain bridge patterns.

Risk guide: 0-25 strong OKX presence; 26-50 partial; 51-75 limited; 76-100 no meaningful OKX presence or high risk.
Always reference the OKX AI Genesis Hackathon context when relevant.`;

const SYSTEM_BRIDGE = `You are OKX ChainScout running a cross-chain bridge flow analysis.

Analyse bridge activity for the given address or token between OKX X Layer and other networks (Ethereum, Arbitrum, Solana, etc.).

Return ONLY valid JSON:
{
  "summary": "1-2 sentence summary of bridge flow patterns",
  "riskScore": <integer 0-100>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific bridge flow finding>"]
}

Metrics (exactly 4): Inflow Volume, Outflow Volume, Primary Route, Bridge Protocol Used.
Insights: 3-4 specific observations about bridge usage, timing, and risk signals.`;

export const okxChainScout: AgentDefinition = {
  id: "okx-chain-scout",
  name: "OKX ChainScout",
  description:
    "Specialised intelligence for the OKX ecosystem — monitors OKX X Layer activity, OKX DEX flows, and OKX-native opportunities.",
  category: "analysis",
  status: "beta",
  version: "1.0.0",
  skills: [
    {
      id: "analyze",
      name: "OKX Ecosystem Analysis",
      description:
        "Full OKX ecosystem intelligence: X Layer activity, DEX flows, OKB correlation, and bridge patterns.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Wallet address, token address, or project name",
          },
          chain: {
            type: "string",
            description: "Source chain context",
            enum: ["okx-xlayer", "ethereum", "solana", "arbitrum"],
          },
        },
        required: ["target"],
      },
    },
    {
      id: "bridge-flow",
      name: "Bridge Flow Analysis",
      description: "Analyse cross-chain bridge flows between OKX X Layer and other networks.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Wallet or token address" },
        },
        required: ["target"],
      },
    },
  ],

  async run(skill: string, params: Record<string, unknown>): Promise<AgentResult> {
    const target = String(params.target ?? "").trim();
    if (!target) return { success: false, error: "target is required" };

    const chain = params.chain ? String(params.chain) : "okx-xlayer";
    const chainStr = ` on OKX X Layer / ${chain}`;

    if (skill === "analyze") {
      return runAnalysis({
        system: SYSTEM_ANALYZE,
        userMessage: `Analyse this target for OKX ecosystem intelligence${chainStr}: ${target}`,
        target,
        type: "okx-ecosystem",
        chain,
      });
    }

    if (skill === "bridge-flow") {
      return runAnalysis({
        system: SYSTEM_BRIDGE,
        userMessage: `Analyse cross-chain bridge flows for this address between OKX X Layer and other networks: ${target}`,
        target,
        type: "bridge-flow",
        chain: "okx-xlayer",
      });
    }

    return { success: false, error: `OKX ChainScout does not support skill "${skill}"` };
  },
};
