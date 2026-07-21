import type { AgentDefinition } from "./types.js";
import { walletScout } from "./wallet-scout.js";
import { tokenSentinel } from "./token-sentinel.js";
import { contractAuditor } from "./contract-auditor.js";
import { alphaHunter } from "./alpha-hunter.js";
import { projectAnalyst } from "./project-analyst.js";
import { okxChainScout } from "./okx-chain-scout.js";

/** All registered agents, keyed by id for O(1) dispatch */
const REGISTRY = new Map<string, AgentDefinition>([
  [walletScout.id,     walletScout],
  [tokenSentinel.id,   tokenSentinel],
  [contractAuditor.id, contractAuditor],
  [alphaHunter.id,     alphaHunter],
  [projectAnalyst.id,  projectAnalyst],
  [okxChainScout.id,   okxChainScout],
]);

/** Return every registered agent (excluding coming_soon) for the directory */
export function listAgents(): AgentDefinition[] {
  return Array.from(REGISTRY.values());
}

/** Look up a single agent by id — returns undefined if not found */
export function getAgent(id: string): AgentDefinition | undefined {
  return REGISTRY.get(id);
}

/** Execute an agent skill and return the raw AgentResult */
export async function runAgent(
  agentId: string,
  skill: string,
  params: Record<string, unknown>,
) {
  const agent = REGISTRY.get(agentId);
  if (!agent) {
    return { success: false, error: `Unknown agent: "${agentId}"` };
  }
  if (agent.status === "coming_soon") {
    return { success: false, error: `Agent "${agentId}" is not yet available` };
  }
  return agent.run(skill, params);
}
