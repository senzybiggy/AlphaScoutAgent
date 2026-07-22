---
name: AlphaScout AI Stack
description: Core stack decisions, data sources, UI architecture, and feature map for the AlphaScout AI crypto intelligence platform.
---

## Stack
- **Frontend**: React + Vite + Tailwind + shadcn/ui + recharts, path `/alphascout-ai`
- **Backend**: Express + TypeScript, path `/api-server`, port 8080
- **DB**: Drizzle ORM + PostgreSQL, schema in `lib/db/src/schema/`
- **AI**: OpenRouter via `sk-or-v1-` prefix in ANTHROPIC_API_KEY → `callAI()` from `@workspace/integrations-anthropic-ai`
- **Routing**: wouter (frontend), base path from `import.meta.env.BASE_URL`

## Free Data Sources (no key required)
- **Ankr Advanced API**: `ankr_getAccountBalance`, `ankr_getNFTsByOwner`, `ankr_getTransactionsByAddress` in `services/ankr.ts`
- **Public RPC**: 7 EVM chains in `services/rpc-provider.ts` + Solana in `services/solana-scanner.ts`
- **GoPlus Security**: token + contract + phishing checks in `services/goplus.ts`
- **DexScreener**: token market data in `services/dexscreener.ts`
- **CoinGecko free**: metadata in `services/coingecko.ts`
- **Blockstream**: Bitcoin UTXOs in `services/blockstream.ts`
- **URL fetcher**: live page text for project scans in `services/project-fetcher.ts`

## AI Output Format (all 4 analyzers)
JSON with: `executiveSummary`, `keyFindings[]`, `risks[]`, `opportunities[]`, `recommendations[]`, `confidenceScore`, `riskScore`, `metrics[]`, `sections[]`
Mapped in `postProcess` → legacy `summary`/`insights` fields for UI backward compat.

## Feature Map (pages + routes)
| Route | Page | Notes |
|-------|------|-------|
| `/` | Home/Terminal | entry point |
| `/analyze` | Analyze | scan any address/URL/token |
| `/portfolio` | Portfolio | recharts charts, multi-chain wallet dashboard |
| `/watchlist` | Watchlist | localStorage-backed saved items |
| `/alerts` | Alerts | localStorage + 5min polling via analyze endpoint |
| `/history` | History | DB-backed scan history (scan_history table) |
| `/agents` | Agents | OKX ASP agent listing |
| `/chat` | Chat/Comm Link | conversation AI |
| `/share/:token` | ShareView | read-only public report view |

## Backend API Routes
- `POST /api/analyze` — main analysis (wallet/token/contract/project)
- `POST /api/analyze/chat` — multi-turn AI copilot (passes `history` array)
- `GET /api/analyze/history` + `/:id` — scan history
- `POST /api/share` → `{ token, expiresAt }` — create 30-day shareable link
- `GET /api/share/:token` → `{ result, createdAt }` — retrieve shared report

## DB Schema Tables
- `scan_history` — all analysis results (jsonb result blob)
- `shared_reports` — share tokens with 30-day expiry (token unique index)
- `conversations`, `messages` — AI chat (legacy Comm Link)

## Key Frontend Components
- `analysis-results.tsx` — main result dispatcher, accepts `readOnly` prop for share view
- `confidence-panel.tsx` — shows confidence %, data freshness, sources, timestamp
- `share-button.tsx` — POST /api/share → copy shareable URL
- `watchlist-button.tsx` — toggles localStorage watchlist entry
- `export-panel.tsx` — Markdown/JSON download + PDF (window.print) + Share button
- `ai-copilot-panel.tsx` — multi-turn chat (sends `history[]` to backend)

## Wallet Chain Priority
EVM order: Moralis (if key) → Ankr free API → Public JSON-RPC → limited
Solana: `detectAddressType()` in wallet-scanner.ts → routes base58 to solana-scanner.ts
Bitcoin: Blockstream public API

**Why:** MORALIS_API_KEY not set in env; Ankr provides rich EVM data free; Solana addresses are base58.

## X-API-Version
Hardcoded to `"1.0.0"` in `middlewares/headers.ts` (was reading from npm_package_version which returned "0.0.0").
