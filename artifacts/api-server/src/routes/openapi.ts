/**
 * OpenAPI 3.1 specification + Swagger UI
 *
 * GET /api/docs      → raw OpenAPI JSON spec
 * GET /api/docs/ui   → Swagger UI (CDN-hosted, loads the spec from /api/docs)
 */

import { Router } from "express";

const router = Router();

const BASE_URL = process.env["PUBLIC_URL"] ?? "";

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "AlphaScout AI — Agent Service Provider API",
    version: "1.0.0",
    description:
      "AlphaScout AI is an OKX AI Agent Service Provider delivering deep blockchain intelligence via a multi-agent architecture. " +
      "This API exposes wallet analysis, token security scanning, smart contract auditing, project research, and the OKX AI ASP agent protocol.",
    contact: { name: "AlphaScout AI", url: "https://alphascout.ai" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: BASE_URL || "https://your-app.onrender.com", description: "Production" },
    { url: "http://localhost:8080", description: "Local development" },
  ],
  tags: [
    { name: "Health",    description: "Liveness and readiness probes" },
    { name: "Agent ASP", description: "OKX AI Agent Service Provider protocol endpoints" },
    { name: "v1 Analyze",description: "Versioned typed analysis endpoints (real on-chain data + AI)" },
    { name: "Analyze",   description: "Legacy analysis endpoint (UI compatibility, still supported)" },
    { name: "Docs",      description: "API documentation" },
  ],
  components: {
    securitySchemes: {
      ApiKeyHeader: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "Optional in evaluation mode. Set API_KEYS on the server to enforce.",
      },
      BearerToken: {
        type: "http",
        scheme: "bearer",
        description: "Alternative to X-API-Key — pass the key as a Bearer token.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error:   { type: "string",  example: "INVALID_INPUT" },
          message: { type: "string",  example: "target is required" },
        },
        required: ["error"],
      },
      Metric: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          trend: { type: "string", enum: ["up", "down", "neutral", null], nullable: true },
        },
        required: ["label", "value"],
      },
      AnalysisResult: {
        type: "object",
        description: "Full intelligence report for a blockchain target",
        properties: {
          target:            { type: "string",  example: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
          type:              { type: "string",  enum: ["wallet", "token", "contract", "project"] },
          chain:             { type: "string",  nullable: true, example: "ethereum" },
          summary:           { type: "string" },
          riskScore:         { type: "integer", minimum: 0, maximum: 100, example: 32 },
          metrics:           { type: "array",   items: { $ref: "#/components/schemas/Metric" } },
          insights:          { type: "array",   items: { type: "string" } },
          recommendations:   { type: "array",   items: { type: "string" } },
          analyzedAt:        { type: "string",  format: "date-time" },
          walletScan:        { type: "object",  nullable: true, description: "Extended wallet data (requires MORALIS_API_KEY for full data)" },
          tokenScan:         { type: "object",  nullable: true, description: "Extended token market and security data" },
          contractScan:      { type: "object",  nullable: true, description: "GoPlus contract security scan" },
          smartMoneyScore:   { type: "integer", nullable: true, minimum: 0, maximum: 100 },
          walletHealthScore: { type: "integer", nullable: true, minimum: 0, maximum: 100 },
        },
        required: ["target", "type", "summary", "riskScore", "analyzedAt"],
      },
      V1Response: {
        type: "object",
        properties: {
          success:    { type: "boolean", example: true },
          apiVersion: { type: "string",  example: "v1" },
          data:       { $ref: "#/components/schemas/AnalysisResult" },
        },
        required: ["success", "apiVersion", "data"],
      },
      AgentRunRequest: {
        type: "object",
        properties: {
          agentId:    { type: "string",  example: "wallet-scout" },
          skill:      { type: "string",  example: "analyze" },
          requestId:  { type: "string",  description: "Optional — UUID; auto-generated if omitted" },
          parameters: {
            type: "object",
            properties: {
              target: { type: "string", example: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
              chain:  { type: "string", example: "ethereum" },
            },
          },
        },
        required: ["agentId", "skill", "parameters"],
      },
      AgentRunResponse: {
        type: "object",
        properties: {
          requestId:  { type: "string" },
          agentId:    { type: "string" },
          skill:      { type: "string" },
          status:     { type: "string", enum: ["success", "error"] },
          result:     { type: "object", description: "Present when status is success" },
          error:      { type: "string", description: "Present when status is error" },
          executedAt: { type: "string", format: "date-time" },
          latencyMs:  { type: "integer" },
        },
        required: ["requestId", "agentId", "skill", "status", "executedAt", "latencyMs"],
      },
    },
  },
  security: [{ ApiKeyHeader: [] }, { BearerToken: [] }],
  paths: {
    "/api/healthz": {
      get: {
        tags: ["Health"],
        summary: "Basic liveness probe",
        description: "Simple liveness check. No auth required.",
        security: [],
        responses: {
          "200": { description: "Service is alive", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } } },
        },
      },
    },
    "/api/agent/health": {
      get: {
        tags: ["Health", "Agent ASP"],
        summary: "Enhanced agent health check",
        description: "Returns uptime, agent counts, model, and version. No auth required.",
        security: [],
        responses: {
          "200": {
            description: "Agent service status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status:        { type: "string", example: "ok" },
                    service:       { type: "string", example: "alphascout-ai-agent" },
                    version:       { type: "string", example: "1.0.0" },
                    model:         { type: "string" },
                    uptimeSeconds: { type: "integer" },
                    agents:        { type: "object" },
                    timestamp:     { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/agent/manifest": {
      get: {
        tags: ["Agent ASP"],
        summary: "OKX AI Agent Service Provider manifest",
        description: "Full manifest describing this ASP — agents, skills, authentication, rate limits, and supported chains. Used by OKX AI for agent discovery.",
        security: [],
        responses: {
          "200": { description: "ASP manifest", content: { "application/json": { schema: { type: "object" } } } },
        },
      },
    },
    "/api/agent/card": {
      get: {
        tags: ["Agent ASP"],
        summary: "Agent Card (A2A / OKX AI discovery format)",
        description: "Structured agent card compatible with agent-to-agent discovery protocols. No auth required.",
        security: [],
        responses: {
          "200": { description: "Agent card", content: { "application/json": { schema: { type: "object" } } } },
        },
      },
    },
    "/api/agent/agents": {
      get: {
        tags: ["Agent ASP"],
        summary: "List all agents",
        description: "Returns the full agent directory with skill definitions.",
        responses: {
          "200": { description: "Agent list", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } },
        },
      },
    },
    "/api/agent/agents/{id}": {
      get: {
        tags: ["Agent ASP"],
        summary: "Get agent by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "wallet-scout" }],
        responses: {
          "200": { description: "Agent detail" },
          "404": { description: "Agent not found" },
        },
      },
    },
    "/api/agent/run": {
      post: {
        tags: ["Agent ASP"],
        summary: "Execute an agent skill",
        description:
          "Unified skill execution endpoint. Routes to the named agent and runs the named skill with supplied parameters. " +
          "Agent skills are AI-powered (fast). For real on-chain data, use /api/v1/analyze/* instead.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AgentRunRequest" },
              examples: {
                walletAnalysis: {
                  summary: "Wallet analysis",
                  value: { agentId: "wallet-scout", skill: "analyze", parameters: { target: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "ethereum" } },
                },
                tokenHoneypot: {
                  summary: "Token honeypot check",
                  value: { agentId: "token-sentinel", skill: "honeypot-check", parameters: { target: "0x6B175474E89094C44Da98b954EedeAC495271d0F", chain: "ethereum" } },
                },
                contractAudit: {
                  summary: "Contract vulnerability scan",
                  value: { agentId: "contract-auditor", skill: "vulnerability-scan", parameters: { target: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", chain: "ethereum" } },
                },
                okxEcosystem: {
                  summary: "OKX ecosystem analysis",
                  value: { agentId: "okx-chain-scout", skill: "analyze", parameters: { target: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "okx-xlayer" } },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Agent execution result", content: { "application/json": { schema: { $ref: "#/components/schemas/AgentRunResponse" } } } },
          "400": { description: "Invalid request (missing agentId / skill)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "429": { description: "Rate limit exceeded" },
          "500": { description: "Agent execution failed" },
        },
      },
    },

    // ── v1 typed analyze endpoints ──────────────────────────────────────────

    "/api/v1/analyze/wallet": {
      post: {
        tags: ["v1 Analyze"],
        summary: "Deep wallet analysis (real on-chain data + AI)",
        description:
          "Full wallet intelligence: portfolio composition, DeFi positions, transaction history, risk score, smart money score, and AI insights. " +
          "Fetches real data from Moralis (if API key set), GoPlus, and Blockstream. Falls back to GoPlus + AI if Moralis key absent.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  target: { type: "string", description: "Wallet address (EVM, Solana, or Bitcoin)", example: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
                  chain:  { type: "string", description: "Blockchain network", example: "ethereum", enum: ["ethereum", "solana", "bitcoin", "base", "arbitrum", "okx-xlayer"] },
                },
                required: ["target"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Wallet analysis result", content: { "application/json": { schema: { $ref: "#/components/schemas/V1Response" } } } },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "429": { description: "Rate limit exceeded" },
          "500": { description: "Analysis failed" },
        },
      },
    },
    "/api/v1/analyze/token": {
      post: {
        tags: ["v1 Analyze"],
        summary: "Token security & market analysis (DexScreener + GoPlus + AI)",
        description: "Real-time token intelligence: live price, market cap, liquidity, volume, holder stats, honeypot detection, buy/sell tax, and security checklist from GoPlus.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  target: { type: "string", description: "Token contract address", example: "0x6B175474E89094C44Da98b954EedeAC495271d0F" },
                  chain:  { type: "string", description: "Blockchain network", example: "ethereum" },
                },
                required: ["target"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Token analysis result", content: { "application/json": { schema: { $ref: "#/components/schemas/V1Response" } } } },
          "400": { description: "Invalid input" },
          "429": { description: "Rate limit exceeded" },
          "500": { description: "Analysis failed" },
        },
      },
    },
    "/api/v1/analyze/contract": {
      post: {
        tags: ["v1 Analyze"],
        summary: "Smart contract security audit (GoPlus + AI)",
        description: "Full contract security assessment: honeypot risk, buy/sell tax, hidden mint functions, dangerous permissions, blacklist mechanisms, proxy patterns, and LP lock status.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  target: { type: "string", description: "Smart contract address", example: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" },
                  chain:  { type: "string", description: "Blockchain network", example: "ethereum" },
                },
                required: ["target"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Contract audit result", content: { "application/json": { schema: { $ref: "#/components/schemas/V1Response" } } } },
          "400": { description: "Invalid input" },
          "429": { description: "Rate limit exceeded" },
          "500": { description: "Analysis failed" },
        },
      },
    },
    "/api/v1/analyze/project": {
      post: {
        tags: ["v1 Analyze"],
        summary: "Project research (AI-powered)",
        description: "Deep AI research on a blockchain project, protocol, or DAO by name or URL. Covers team, tokenomics, competitive positioning, risk factors, and investment thesis.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  target: { type: "string", description: "Project name or URL", example: "Aave" },
                  chain:  { type: "string", description: "Primary chain context (optional)", example: "ethereum" },
                },
                required: ["target"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Project research result", content: { "application/json": { schema: { $ref: "#/components/schemas/V1Response" } } } },
          "400": { description: "Invalid input" },
          "429": { description: "Rate limit exceeded" },
          "500": { description: "Analysis failed" },
        },
      },
    },

    // ── Legacy analyze ──────────────────────────────────────────────────────

    "/api/analyze": {
      post: {
        tags: ["Analyze"],
        summary: "Legacy unified analysis endpoint (UI compatibility)",
        description:
          "Original analysis endpoint used by the AlphaScout AI frontend. Accepts type in the request body. " +
          "Prefer /api/v1/analyze/{type} for new integrations — it has cleaner typed schemas.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  target: { type: "string" },
                  type:   { type: "string", enum: ["wallet", "token", "contract", "project"] },
                  chain:  { type: "string" },
                },
                required: ["target", "type"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Analysis result", content: { "application/json": { schema: { $ref: "#/components/schemas/AnalysisResult" } } } },
          "400": { description: "Invalid input" },
          "500": { description: "Analysis failed" },
        },
      },
    },
    "/api/analyze/history": {
      get: {
        tags: ["Analyze"],
        summary: "List recent scan history",
        description: "Returns the last 50 scans, newest first.",
        responses: {
          "200": { description: "Scan history list" },
        },
      },
    },
    "/api/analyze/history/{id}": {
      get: {
        tags: ["Analyze"],
        summary: "Get a specific scan by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": { description: "Full scan record including stored result" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/analyze/chat": {
      post: {
        tags: ["Analyze"],
        summary: "AI Copilot chat about a scan",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", description: "Question about the scan" },
                  context: { type: "string", description: "Scan result JSON as context for the AI" },
                },
                required: ["message"],
              },
            },
          },
        },
        responses: {
          "200": { description: "AI reply", content: { "application/json": { schema: { type: "object", properties: { reply: { type: "string" } } } } } },
        },
      },
    },
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(SPEC);
});

router.get("/ui", (_req, res) => {
  const specUrl = BASE_URL ? `${BASE_URL}/api/docs` : "/api/docs";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AlphaScout AI — API Docs</title>
  <meta name="description" content="AlphaScout AI OpenAPI documentation" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0d0d0d; color: #e8e8e8; }
    .swagger-ui { filter: invert(0.93) hue-rotate(175deg); }
    .swagger-ui .topbar { background: #0a0a0a; border-bottom: 1px solid #1a1a2e; padding: 8px 16px; }
    .swagger-ui .topbar-wrapper .link { display: flex; align-items: center; gap: 10px; }
    .swagger-ui .topbar-wrapper .link::before {
      content: "AlphaScout AI";
      font-family: monospace;
      font-size: 16px;
      font-weight: 700;
      color: #7c3aed;
      letter-spacing: 0.05em;
    }
    .swagger-ui .topbar-wrapper img { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      tryItOutEnabled: true,
      requestInterceptor: (req) => {
        req.headers["X-Request-Source"] = "swagger-ui";
        return req;
      },
    });
  </script>
</body>
</html>`);
});

export default router;
