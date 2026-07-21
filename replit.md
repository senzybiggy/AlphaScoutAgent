# AlphaScout AI

An AI Agent Service Provider built for the OKX AI Genesis Hackathon. A command center for serious crypto operators — analyze wallets, tokens, contracts, and projects using Claude-powered intelligence, chat with an AI assistant, and browse the agent registry.

## Run & Operate

- `pnpm --filter @workspace/alphascout-ai run dev` — run the React frontend (port 20005)
- `pnpm --filter @workspace/api-server run dev` — run the Express API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `ANTHROPIC_API_KEY` — Anthropic API key for AI features
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui + wouter + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (conversations + messages tables)
- AI: Anthropic Claude (claude-sonnet-4-6) via user's own API key
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/alphascout-ai/src/` — React frontend
  - `pages/` — home, analyze, chat, agents, not-found
  - `components/` — navbar, chat, analyze, agents sub-components
  - `index.css` — dark theme (HSL vars), Inter font
- `artifacts/api-server/src/routes/` — Express route handlers
  - `anthropic/conversations.ts` — chat CRUD + SSE streaming
  - `analyze.ts` — AI-powered blockchain analyzer
  - `agents.ts` — static agent registry
- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — conversations + messages Drizzle tables
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks
- `lib/integrations-anthropic-ai/` — Anthropic SDK client wrapper

## Architecture decisions

- Using user-provided `ANTHROPIC_API_KEY` directly (Replit AI Integrations requires phone verification); client wrapper supports both ANTHROPIC_API_KEY and AI_INTEGRATIONS_* vars
- SSE streaming for chat responses — Orval cannot generate typed hooks for SSE, so the chat page calls `fetch()` + `ReadableStream` manually
- Static agent registry in the route handler (no DB) — agents are hard-coded; a DB-backed registry can be added later
- No auth yet — all endpoints are public
- Always-dark UI — dark class forced on `<html>`, no light mode toggle

## Product

- **Landing page** — hero, feature grid, agent preview, OKX hackathon branding
- **Analyzer** — submit wallet/token/contract/project address, get Claude-powered risk score + metrics + insights
- **Chat** — multi-conversation AI chat with SSE streaming and persistent DB storage
- **Agent Registry** — browse 9 specialized AI agents by category (analysis, trading, monitoring, research, security)

## User preferences

_None recorded yet._

## Gotchas

- Always run codegen after editing `lib/api-spec/openapi.yaml`
- The Anthropic client checks for `ANTHROPIC_API_KEY` (or the Replit AI Integration vars as fallback)
- SSE endpoint (`POST /api/anthropic/conversations/:id/messages`) must NOT be consumed via the generated Orval hook — use raw fetch + ReadableStream

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
