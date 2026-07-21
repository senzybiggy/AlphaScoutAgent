import type { AgentDefinition, AgentResult } from "./types.js";
import { runAnalysis } from "./utils.js";

const SYSTEM = `You are WalletScout, an elite blockchain wallet intelligence agent within the AlphaScout AI platform.

You specialise in deep wallet profiling: transaction behaviour, asset composition, DeFi interactions, risk exposure, and smart-money pattern recognition.

Return ONLY valid JSON — no markdown fences, no extra keys:
{
  "summary": "2-3 sentence executive summary of wallet behaviour and risk posture",
  "riskScore": <integer 0-100>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific intelligence bullet>"]
}

Always include exactly 6 metrics: Total Transactions, Estimated Portfolio Value, Active Since, Unique Protocols, Avg Gas Spend, Last Active.
Include 4-5 insight bullets covering behavioural patterns, smart-money signals, mixer proximity, and anomalous activity.

Risk guide: 0-25 clean; 26-50 minor flags; 51-75 moderate risk; 76-100 high risk / mixer-adjacent.
Use hedged language — you are inferring from patterns, not reading live chain data.`;

export const walletScout: AgentDefinition = {
  id: "wallet-scout",
  name: "WalletScout",
  description:
    "Deep wallet profiling — tracks transaction history, behavioural patterns, whale movements, and risk exposure across chains.",
  category: "analysis",
  status: "active",
  version: "1.0.0",
  skills: [
    {
      id: "analyze",
      name: "Wallet Analysis",
      description:
        "Full intelligence report on a wallet address: activity patterns, risk score, portfolio metrics, and AI insights.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Wallet address (EVM, Solana, or Bitcoin)" },
          chain: {
            type: "string",
            description: "Blockchain network",
            enum: ["ethereum", "solana", "bitcoin", "base", "arbitrum", "okx-xlayer"],
          },
        },
        required: ["target"],
      },
    },
  ],

  async run(skill: string, params: Record<string, unknown>): Promise<AgentResult> {
    if (skill !== "analyze") {
      return { success: false, error: `WalletScout does not support skill "${skill}"` };
    }

    const target = String(params.target ?? "").trim();
    if (!target) return { success: false, error: "target is required" };

    const chain = params.chain ? String(params.chain) : null;
    const chainStr = chain ? ` on ${chain}` : "";

    return runAnalysis({
      system: SYSTEM,
      userMessage: `Analyze this wallet address${chainStr}: ${target}\n\nProduce a detailed intelligence report.`,
      target,
      type: "wallet",
      chain,
    });
  },
};
