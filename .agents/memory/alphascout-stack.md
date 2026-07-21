---
name: AlphaScout AI Stack
description: Core decisions for the AlphaScout AI blockchain intelligence platform (OKX hackathon) — including ASP layer.
---

## AI Provider
OpenRouter detected by `sk-or-v1-` key prefix in `lib/integrations-anthropic-ai/src/client.ts`. Uses `fetch` + `/chat/completions` (OpenAI format). Model: `nvidia/nemotron-3-super-120b-a12b:free`.

**Why:** Anthropic SDK doesn't support OpenRouter; the key prefix detection allows both providers to coexist.

## Real Data Layer (no hallucination principle)
All analyzers fetch real data FIRST, then pass it to AI as context. The core logic lives in `services/analyze-service.ts` and is shared by both the legacy route and v1 endpoints.

**Services:**
- `services/analyze-service.ts` — extracted orchestrator: fetchScanData + callAI + parseAiOutput + save to history. Used by both legacy /api/analyze and /api/v1/analyze/*.
- `services/goplus.ts` — free, no key. Token security + wallet risk labels.
- `services/dexscreener.ts` — free, no key. Token market data.
- `services/moralis.ts` — requires MORALIS_API_KEY. EVM wallet data.
- `services/blockstream.ts` — free, no key. Bitcoin wallet data.
- `services/cache.ts` — in-memory TTL cache.
- `services/wallet-scanner.ts` / `services/token-scanner.ts` — orchestrators.

## OKX AI Agent Service Provider (ASP) Layer

### ASP Endpoints (all under /api/agent/)
- `GET  /api/agent/health`    — uptime, agent counts, rate-limit config
- `GET  /api/agent/manifest`  — full OKX registration manifest (agents, skills, data sources, auth mode)
- `GET  /api/agent/card`      — A2A/OKX AI discovery card (10 skills across 6 agents)
- `GET  /api/agent/agents`    — agent directory
- `GET  /api/agent/agents/:id`— single agent detail
- `POST /api/agent/run`       — AI-powered skill execution (fast, no real chain data)

### 6 Agents
wallet-scout (active), token-sentinel (active), contract-auditor (active), alpha-hunter (active), project-analyst (active), okx-chain-scout (beta)

### Versioned Typed Endpoints (/api/v1/)
- `POST /api/v1/analyze/wallet`   — real on-chain data + AI (uses analyze-service.ts)
- `POST /api/v1/analyze/token`    — DexScreener + GoPlus + AI
- `POST /api/v1/analyze/contract` — GoPlus + AI
- `POST /api/v1/analyze/project`  — AI-only
- Response shape: `{ success, apiVersion: "v1", data: AnalysisResult }`

### OpenAPI Docs
- `GET /api/docs`    — OpenAPI 3.1 JSON spec (15 paths, 5 tags)
- `GET /api/docs/ui` — Swagger UI (CDN-hosted, dark-themed)

## Middleware Stack (app.ts)
Order: pinoHttp → headersMiddleware → cors → json/urlencoded → globalLimiter → authMiddleware → router

- `middlewares/auth.ts` — X-API-Key or Bearer token. Open mode when API_KEYS env var unset. Bypass for /healthz, /agent/health, /manifest, /card, /docs.
- `middlewares/rate-limit.ts` — express-rate-limit: global (200/15min), analysis (10/min), agent-run (15/min). Shared singleton imported by both legacy and v1 routes.
- `middlewares/headers.ts` — X-API-Version: 1.0.0, X-Powered-By, Access-Control-Expose-Headers

**Critical:** rate-limit uses singleton instances from rate-limit.ts. Both /api/analyze and /api/v1/analyze/* share the same `analysisLimiter` instance (intentional — same quota).

## Deployment
- `render.yaml` at monorepo root (Render reads from repo root).
- Build: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
- Start: `pnpm --filter @workspace/api-server run start`
- Required env: PORT (auto-set by Render=10000), DATABASE_URL, ANTHROPIC_API_KEY
- Optional: PUBLIC_URL, MORALIS_API_KEY, API_KEYS, RATE_LIMIT_* overrides

## DB Schema
`lib/db/src/schema/scan-history.ts` — `scan_history` table. Migrated.

## Frontend Type Strategy
Cast result to `RichAnalyzeResult` from `@/lib/scan-types`. Never run codegen for these fields.

## Wallet Connect
`@reown/appkit` + `wagmi@3.7.3`. VITE_WALLETCONNECT_PROJECT_ID needed from cloud.reown.com.

## Moralis Graceful Degradation
When MORALIS_API_KEY absent, walletScan.dataSource = "limited". Frontend shows yellow banner.
