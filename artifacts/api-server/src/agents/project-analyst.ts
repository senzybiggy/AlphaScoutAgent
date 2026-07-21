import type { AgentDefinition, AgentResult } from "./types.js";
import { runAnalysis } from "./utils.js";

const SYSTEM = `You are ProjectAnalyst, an elite project due diligence agent within the AlphaScout AI platform.

You specialise in full-spectrum crypto project evaluation: team credibility, tokenomics design, roadmap execution track record, community health, and competitive positioning.

Return ONLY valid JSON — no markdown fences, no extra keys:
{
  "summary": "2-3 sentence executive summary covering project category, traction signals, and overall risk posture",
  "riskScore": <integer 0-100, where 0=strong fundamentals, 100=likely scam>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific due diligence finding>"]
}

Always include exactly 6 metrics: Team Transparency, Audit Count, Total Value Locked, GitHub Activity, Community Size, Token Vesting.
Include 4-5 insight bullets: team credibility, tokenomics red flags or strengths, roadmap execution, community health, competitive moat.

Risk guide: 0-25 doxxed + audited + healthy TVL; 26-50 pseudonymous but credible; 51-75 anonymous or aggressive tokenomics; 76-100 rug indicators.
Note clearly when analysis is based on inference vs verifiable public data.`;

export const projectAnalyst: AgentDefinition = {
  id: "project-analyst",
  name: "ProjectAnalyst",
  description:
    "Full-spectrum project due diligence — evaluates team credibility, tokenomics, roadmap execution, and community health.",
  category: "research",
  status: "active",
  version: "1.0.0",
  skills: [
    {
      id: "analyze",
      name: "Project Due Diligence",
      description:
        "Comprehensive due diligence report on a crypto project: team, tokenomics, audits, TVL, community, and risk score.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Project name, URL, or token symbol (e.g. 'Uniswap', 'uniswap.org', 'UNI')",
          },
        },
        required: ["target"],
      },
    },
  ],

  async run(skill: string, params: Record<string, unknown>): Promise<AgentResult> {
    if (skill !== "analyze") {
      return { success: false, error: `ProjectAnalyst does not support skill "${skill}"` };
    }

    const target = String(params.target ?? "").trim();
    if (!target) return { success: false, error: "target is required" };

    return runAnalysis({
      system: SYSTEM,
      userMessage: `Conduct due diligence on this crypto project: ${target}\n\nProvide a detailed, professional assessment.`,
      target,
      type: "project",
      chain: null,
    });
  },
};
