/**
 * OKX AI Agent Service Provider — public API surface
 *
 * GET  /api/agent/health        Enhanced liveness + readiness probe
 * GET  /api/agent/manifest      OKX registration manifest (static + runtime fields)
 * GET  /api/agent/card          Agent Card (A2A / OKX AI discovery format)
 * GET  /api/agent/agents        Full agent directory with skills
 * GET  /api/agent/agents/:id    Single agent detail
 * POST /api/agent/run           Unified skill execution endpoint
 */

import { randomUUID } from "crypto";
import { Router } from "express";
import { listAgents, getAgent, runAgent } from "../agents/index.js";
import type { AgentRequest, AgentResponse } from "../agents/types.js";
import { CLAUDE_MODEL } from "@workspace/integrations-anthropic-ai";
import { agentRunLimiter } from "../middlewares/rate-limit.js";

const router = Router();
const SERVER_START = Date.now();
const SERVICE_VERSION = "1.0.0";
const API_VERSION = "v1";

function resolveBaseUrl(req: Parameters<typeof router.get>[1]): string {
  if (process.env["PUBLIC_URL"]) return `${process.env["PUBLIC_URL"]}/api/agent`;
  const host = req.get("host") ?? "localhost:8080";
  const proto = req.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/api/agent`;
}

// ─── GET /api/agent/health ────────────────────────────────────────────────────

router.get("/health", (_req, res) => {
  const agents = listAgents();
  res.json({
    status:        "ok",
    service:       "alphascout-ai-agent",
    version:       SERVICE_VERSION,
    apiVersion:    API_VERSION,
    model:         CLAUDE_MODEL,
    uptimeSeconds: Math.floor((Date.now() - SERVER_START) / 1000),
    agents: {
      total:  agents.length,
      active: agents.filter((a) => a.status === "active").length,
      beta:   agents.filter((a) => a.status === "beta").length,
    },
    authentication: {
      mode: process.env["API_KEYS"] ? "enforced" : "open",
    },
    rateLimit: {
      agentRun:  `${process.env["RATE_LIMIT_AGENT"]    ?? 15}  req/min`,
      analysis:  `${process.env["RATE_LIMIT_ANALYSIS"] ?? 10}  req/min`,
      global:    `${process.env["RATE_LIMIT_GLOBAL"]   ?? 200} req/15min`,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/agent/manifest ──────────────────────────────────────────────────

router.get("/manifest", (req, res) => {
  const agents = listAgents().map((a) => ({
    id:          a.id,
    name:        a.name,
    description: a.description,
    category:    a.category,
    status:      a.status,
    version:     a.version,
    skills:      a.skills,
  }));

  const base = resolveBaseUrl(req);
  const pubUrl = process.env["PUBLIC_URL"] ?? "";

  res.json({
    manifestVersion: "1.0",
    id:              "alphascout-ai",
    name:            "AlphaScout AI",
    tagline:         "The ultimate intelligence edge for blockchain operators",
    description:
      "AlphaScout AI is an AI Agent Service Provider delivering deep on-chain intelligence. " +
      "It provides AI-powered analysis of wallets, tokens, smart contracts, and projects through a " +
      "modular multi-agent architecture, combining real blockchain data (GoPlus, DexScreener, Moralis, " +
      "Blockstream) with large-language-model reasoning.",
    version:       SERVICE_VERSION,
    apiVersion:    API_VERSION,
    category:      "blockchain-intelligence",
    tags: [
      "blockchain", "defi", "crypto-intelligence", "smart-contract-audit",
      "wallet-analysis", "alpha-discovery", "okx-ecosystem", "on-chain-data",
    ],
    author: {
      name: "AlphaScout AI",
      url:  pubUrl || "https://alphascout.ai",
    },
    homepage:    pubUrl ? `${pubUrl}/alphascout-ai` : undefined,
    docsUrl:     pubUrl ? `${pubUrl}/api/docs/ui`   : "/api/docs/ui",
    openApiUrl:  pubUrl ? `${pubUrl}/api/docs`      : "/api/docs",
    license: "proprietary",
    authentication: {
      type: process.env["API_KEYS"] ? "apiKey" : "none",
      note: process.env["API_KEYS"]
        ? "Pass your key via X-API-Key header or Authorization: Bearer <key>."
        : "No authentication required for evaluation. Set API_KEYS env var to enforce.",
      schemes: ["X-API-Key header", "Authorization: Bearer <key>"],
    },
    endpoints: {
      health:   `GET  ${base}/health`,
      manifest: `GET  ${base}/manifest`,
      card:     `GET  ${base}/card`,
      agents:   `GET  ${base}/agents`,
      agent:    `GET  ${base}/agents/:id`,
      run:      `POST ${base}/run`,
    },
    analysisEndpoints: {
      wallet:   `POST ${pubUrl || ""}/api/v1/analyze/wallet`,
      token:    `POST ${pubUrl || ""}/api/v1/analyze/token`,
      contract: `POST ${pubUrl || ""}/api/v1/analyze/contract`,
      project:  `POST ${pubUrl || ""}/api/v1/analyze/project`,
    },
    rateLimit: {
      agentRun:          parseInt(process.env["RATE_LIMIT_AGENT"]    ?? "15",  10),
      analysisPerMinute: parseInt(process.env["RATE_LIMIT_ANALYSIS"] ?? "10",  10),
      globalPer15Min:    parseInt(process.env["RATE_LIMIT_GLOBAL"]   ?? "200", 10),
    },
    supportedChains: ["ethereum", "solana", "bitcoin", "base", "arbitrum", "okx-xlayer"],
    dataSources: [
      { name: "GoPlus Security", type: "security",    requiresKey: false, description: "Honeypot detection, tax analysis, blacklist/whitelist flags" },
      { name: "DexScreener",     type: "market-data", requiresKey: false, description: "Real-time price, volume, liquidity, and DEX pairs" },
      { name: "Blockstream",     type: "bitcoin",     requiresKey: false, description: "Bitcoin address balances and transactions" },
      { name: "Moralis",         type: "portfolio",   requiresKey: true,  description: "EVM wallet tokens, NFTs, DeFi positions, transaction history" },
    ],
    agents,
  });
});

// ─── GET /api/agent/card ─────────────────────────────────────────────────────
// OKX AI / A2A agent discovery card format

router.get("/card", (req, res) => {
  const agents = listAgents();
  const base   = resolveBaseUrl(req);
  const pubUrl = process.env["PUBLIC_URL"] ?? "";

  const allSkills = agents.flatMap((a) =>
    a.skills.map((s) => ({
      id:          `${a.id}/${s.id}`,
      name:        s.name,
      description: s.description,
      agent:       a.id,
      category:    a.category,
    })),
  );

  res.json({
    // A2A / OKX AI discovery fields
    schema_version:  "1.0",
    kind:            "agent-card",
    id:              "alphascout-ai",
    name:            "AlphaScout AI",
    description:     "Real-time blockchain intelligence agent — wallet profiling, token security, smart contract auditing, alpha signal discovery, and OKX ecosystem analysis.",
    version:         SERVICE_VERSION,
    url:             pubUrl || base.replace("/api/agent", ""),
    api_base:        pubUrl || base.replace("/agent", ""),
    docs_url:        pubUrl ? `${pubUrl}/api/docs/ui` : "/api/docs/ui",
    provider: {
      name:    "AlphaScout AI",
      website: pubUrl || "https://alphascout.ai",
    },
    capabilities: {
      streaming:        false,
      push_events:      false,
      file_upload:      false,
      structured_output: true,
      multi_turn:        true,
      on_chain_data:     true,
    },
    input_modes:  ["text", "structured-json"],
    output_modes: ["structured-json"],
    authentication: {
      schemes:  ["apiKey"],
      optional: !process.env["API_KEYS"],
      header:   "X-API-Key",
    },
    rate_limits: {
      agent_run:      `${process.env["RATE_LIMIT_AGENT"]    ?? 15} req/min`,
      analysis:       `${process.env["RATE_LIMIT_ANALYSIS"] ?? 10} req/min`,
      global:         `${process.env["RATE_LIMIT_GLOBAL"]   ?? 200} req/15min`,
    },
    endpoints: {
      run:      `POST ${base}/run`,
      agents:   `GET  ${base}/agents`,
      manifest: `GET  ${base}/manifest`,
      health:   `GET  ${base}/health`,
    },
    skills: allSkills,
    tags: ["blockchain", "defi", "security", "alpha", "okx", "wallet", "token", "nft", "smart-contract"],
    created_at:  "2025-07-01T00:00:00Z",
    updated_at:  new Date().toISOString(),
  });
});

// ─── GET /api/agent/agents ────────────────────────────────────────────────────

router.get("/agents", (_req, res) => {
  const agents = listAgents().map((a) => ({
    id:          a.id,
    name:        a.name,
    description: a.description,
    category:    a.category,
    status:      a.status,
    version:     a.version,
    skills:      a.skills,
  }));
  res.json(agents);
});

// ─── GET /api/agent/agents/:id ───────────────────────────────────────────────

router.get("/agents/:id", (req, res) => {
  const agent = getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: `Agent "${req.params.id}" not found`, available: listAgents().map((a) => a.id) });
    return;
  }
  res.json({
    id:          agent.id,
    name:        agent.name,
    description: agent.description,
    category:    agent.category,
    status:      agent.status,
    version:     agent.version,
    skills:      agent.skills,
  });
});

// ─── POST /api/agent/run ──────────────────────────────────────────────────────

router.post("/run", agentRunLimiter, async (req, res) => {
  const body = req.body as Partial<AgentRequest>;
  const { agentId, skill, parameters = {}, requestId } = body;

  if (!agentId?.trim()) { res.status(400).json({ error: "agentId is required", availableAgents: listAgents().map((a) => a.id) }); return; }
  if (!skill?.trim())   { res.status(400).json({ error: "skill is required" }); return; }

  const resolvedRequestId = requestId?.trim() || randomUUID();
  const startMs = Date.now();

  try {
    const result   = await runAgent(agentId.trim(), skill.trim(), parameters);
    const latencyMs = Date.now() - startMs;

    const response: AgentResponse = {
      requestId:  resolvedRequestId,
      agentId:    agentId.trim(),
      skill:      skill.trim(),
      status:     result.success ? "success" : "error",
      ...(result.success ? { result: result.data } : { error: result.error }),
      executedAt: new Date().toISOString(),
      latencyMs,
    };

    res.status(result.success ? 200 : 400).json(response);
  } catch (err: unknown) {
    const latencyMs = Date.now() - startMs;
    const message   = err instanceof Error ? err.message : String(err);
    req.log.error({ err, agentId, skill }, "Agent run error");

    const response: AgentResponse = {
      requestId:  resolvedRequestId,
      agentId:    agentId.trim(),
      skill:      skill.trim(),
      status:     "error",
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
