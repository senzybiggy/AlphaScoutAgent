/**
 * OKX AI Agent Service Provider — public API surface
 *
 * GET  /api/agent/health        Enhanced liveness + readiness probe
 * GET  /api/agent/manifest      OKX registration manifest (static + runtime fields)
 * GET  /api/agent/agents        Full agent directory with skills
 * GET  /api/agent/agents/:id    Single agent detail
 * POST /api/agent/run           Unified skill execution endpoint
 */

import { randomUUID } from "crypto";
import { Router } from "express";
import { listAgents, getAgent, runAgent } from "../agents/index.js";
import type { AgentRequest, AgentResponse } from "../agents/types.js";
import { CLAUDE_MODEL } from "@workspace/integrations-anthropic-ai";

const router = Router();
const SERVER_START = Date.now();
const SERVICE_VERSION = "1.0.0";

// ─── GET /api/agent/health ───────────────────────────────────────────────────

router.get("/health", (_req, res) => {
  const agents = listAgents();
  res.json({
    status: "ok",
    service: "alphascout-ai-agent",
    version: SERVICE_VERSION,
    model: CLAUDE_MODEL,
    uptimeSeconds: Math.floor((Date.now() - SERVER_START) / 1000),
    agents: {
      total: agents.length,
      active: agents.filter((a) => a.status === "active").length,
      beta: agents.filter((a) => a.status === "beta").length,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/agent/manifest ─────────────────────────────────────────────────

router.get("/manifest", (_req, res) => {
  const agents = listAgents().map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    status: a.status,
    version: a.version,
    skills: a.skills,
  }));

  const baseUrl =
    process.env.PUBLIC_URL ??
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/agent`
      : "/api/agent";

  res.json({
    manifestVersion: "1.0",
    id: "alphascout-ai",
    name: "AlphaScout AI",
    tagline: "The ultimate intelligence edge for blockchain operators",
    description:
      "AlphaScout AI is an AI Agent Service Provider delivering deep blockchain intelligence. It provides AI-powered analysis of wallets, token contracts, smart contracts, projects, alpha signals, and OKX-native ecosystem opportunities through a modular multi-agent architecture.",
    version: SERVICE_VERSION,
    category: "blockchain-intelligence",
    tags: [
      "blockchain",
      "defi",
      "crypto-intelligence",
      "smart-contract-audit",
      "wallet-analysis",
      "alpha-discovery",
      "okx-ecosystem",
    ],
    author: {
      name: "AlphaScout AI",
      url: "https://alphascout.ai",
    },
    license: "proprietary",
    authentication: {
      type: "none",
      note: "No authentication required for evaluation. Production deployments should add API key auth.",
    },
    endpoints: {
      health:   `GET  ${baseUrl}/health`,
      manifest: `GET  ${baseUrl}/manifest`,
      agents:   `GET  ${baseUrl}/agents`,
      agent:    `GET  ${baseUrl}/agents/:id`,
      run:      `POST ${baseUrl}/run`,
    },
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerDay: 500,
    },
    supportedChains: [
      "ethereum",
      "solana",
      "bitcoin",
      "base",
      "arbitrum",
      "okx-xlayer",
    ],
    agents,
  });
});

// ─── GET /api/agent/agents ───────────────────────────────────────────────────

router.get("/agents", (_req, res) => {
  const agents = listAgents().map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    status: a.status,
    version: a.version,
    skills: a.skills,
  }));
  res.json(agents);
});

// ─── GET /api/agent/agents/:id ──────────────────────────────────────────────

router.get("/agents/:id", (req, res) => {
  const agent = getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: `Agent "${req.params.id}" not found` });
    return;
  }
  res.json({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    category: agent.category,
    status: agent.status,
    version: agent.version,
    skills: agent.skills,
  });
});

// ─── POST /api/agent/run ────────────────────────────────────────────────────

router.post("/run", async (req, res) => {
  const body = req.body as Partial<AgentRequest>;
  const { agentId, skill, parameters = {}, requestId } = body;

  if (!agentId?.trim()) {
    res.status(400).json({ error: "agentId is required" });
    return;
  }
  if (!skill?.trim()) {
    res.status(400).json({ error: "skill is required" });
    return;
  }

  const resolvedRequestId = requestId?.trim() || randomUUID();
  const startMs = Date.now();

  try {
    const result = await runAgent(agentId.trim(), skill.trim(), parameters);
    const latencyMs = Date.now() - startMs;

    const response: AgentResponse = {
      requestId: resolvedRequestId,
      agentId: agentId.trim(),
      skill: skill.trim(),
      status: result.success ? "success" : "error",
      ...(result.success ? { result: result.data } : { error: result.error }),
      executedAt: new Date().toISOString(),
      latencyMs,
    };

    res.status(result.success ? 200 : 400).json(response);
  } catch (err: unknown) {
    const latencyMs = Date.now() - startMs;
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err, agentId, skill }, "Agent run error");

    const response: AgentResponse = {
      requestId: resolvedRequestId,
      agentId: agentId.trim(),
      skill: skill.trim(),
      status: "error",
      error: message.includes("402") || message.toLowerCase().includes("insufficient credits")
        ? "AI provider has insufficient credits. Please top up your balance."
        : message.includes("429") || message.includes("rate_limit")
        ? "AI rate limit reached. Please retry in a moment."
        : "Agent execution failed. Please try again.",
      executedAt: new Date().toISOString(),
      latencyMs,
    };

    res.status(500).json(response);
  }
});

export default router;
