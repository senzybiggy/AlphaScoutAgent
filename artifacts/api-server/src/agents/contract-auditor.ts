import type { AgentDefinition, AgentResult } from "./types.js";
import { runAnalysis } from "./utils.js";

const SYSTEM_AUDIT = `You are ContractAuditor, an elite smart contract security agent within the AlphaScout AI platform.

You specialise in automated contract security scanning: vulnerability detection, ownership analysis, proxy patterns, and operational risk.

Return ONLY valid JSON — no markdown fences, no extra keys:
{
  "summary": "2-3 sentence executive summary of contract purpose, security posture, and key risk indicators",
  "riskScore": <integer 0-100>,
  "metrics": [
    { "label": "<label>", "value": "<value>", "trend": "up"|"down"|"neutral"|null }
  ],
  "insights": ["<specific security finding>"]
}

Always include exactly 6 metrics: Audit Status, Proxy Pattern, Owner Type, Contract Age, Total Interactions, Unique Users.
Include 4-5 insight bullets: ownership/upgrade risks, reentrancy vectors, oracle manipulation surface, flash-loan exposure, positive signals.

Risk guide: 0-25 audited + multisig; 26-50 partial audit or mitigated single-owner; 51-75 unaudited or notable patterns; 76-100 critical.
Be technical and use precise security terminology.`;

const SYSTEM_VULN = `You are ContractAuditor running a focused vulnerability scan.

Identify the top vulnerability patterns for the given contract: reentrancy, integer overflow/underflow, access control flaws, oracle manipulation, flash-loan attack surface, and selfdestruct/delegatecall misuse.

Return ONLY valid JSON:
{
  "summary": "1-2 sentence triage verdict",
  "riskScore": <integer 0-100>,
  "metrics": [
    { "label": "<vulnerability category>", "value": "Detected|Not Detected|Partial", "trend": null }
  ],
  "insights": ["<specific vulnerability finding with recommended fix>"]
}

Metrics (exactly 5): Reentrancy, Access Control, Oracle Risk, Flash-Loan Surface, Upgrade Risk.
Insights: 4-5 specific findings with actionable mitigations.`;

export const contractAuditor: AgentDefinition = {
  id: "contract-auditor",
  name: "ContractAuditor",
  description:
    "Automated smart contract security scanning — identifies vulnerabilities, backdoors, and malicious patterns without needing source code.",
  category: "security",
  status: "active",
  version: "1.0.0",
  skills: [
    {
      id: "analyze",
      name: "Security Audit",
      description: "Full smart contract security assessment: proxy pattern, ownership, vulnerabilities, and risk score.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Smart contract address" },
          chain: {
            type: "string",
            description: "Blockchain network",
            enum: ["ethereum", "base", "arbitrum", "okx-xlayer"],
          },
        },
        required: ["target"],
      },
    },
    {
      id: "vulnerability-scan",
      name: "Vulnerability Scan",
      description: "Focused scan for the top smart contract vulnerability patterns.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Smart contract address" },
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
        system: SYSTEM_AUDIT,
        userMessage: `Security audit this smart contract${chainStr}: ${target}`,
        target,
        type: "contract",
        chain,
      });
    }

    if (skill === "vulnerability-scan") {
      return runAnalysis({
        system: SYSTEM_VULN,
        userMessage: `Run a focused vulnerability scan on this contract${chainStr}: ${target}`,
        target,
        type: "contract",
        chain,
      });
    }

    return { success: false, error: `ContractAuditor does not support skill "${skill}"` };
  },
};
