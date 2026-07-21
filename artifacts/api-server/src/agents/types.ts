/** Describes a single capability an agent exposes to callers */
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  /** JSON-Schema-style parameter spec (subset) */
  parameters: {
    type: "object";
    properties: Record<
      string,
      { type: string; description: string; enum?: string[] }
    >;
    required: string[];
  };
}

/** One registered agent with all its metadata and execution logic */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  category: "analysis" | "trading" | "monitoring" | "research" | "security";
  status: "active" | "beta" | "coming_soon";
  version: string;
  skills: AgentSkill[];
  /** Execute a named skill with caller-supplied parameters */
  run(
    skill: string,
    params: Record<string, unknown>,
  ): Promise<AgentResult>;
}

export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Inbound request to POST /api/agent/run */
export interface AgentRequest {
  agentId: string;
  skill: string;
  parameters: Record<string, unknown>;
  requestId?: string;
}

/** Full response from POST /api/agent/run */
export interface AgentResponse {
  requestId: string;
  agentId: string;
  skill: string;
  status: "success" | "error";
  result?: unknown;
  error?: string;
  executedAt: string;
  latencyMs: number;
}
