---
name: AlphaScout AI Stack
description: Core decisions for the AlphaScout AI blockchain intelligence platform (OKX hackathon).
---

## AI Provider
OpenRouter detected by `sk-or-v1-` key prefix in `lib/integrations-anthropic-ai/src/client.ts`. Uses `fetch` + `/chat/completions` (OpenAI format). Model: `nvidia/nemotron-3-super-120b-a12b:free`.

**Why:** Anthropic SDK doesn't support OpenRouter; the key prefix detection allows both providers to coexist.

## Real Data Layer (no hallucination principle)
All analyzers fetch real data FIRST, then pass it to AI as context. AI only generates scores, insights, and recommendations — never invents portfolio values or transaction counts.

**Services:**
- `artifacts/api-server/src/services/goplus.ts` — free, no key. Token security + wallet risk labels.
- `artifacts/api-server/src/services/dexscreener.ts` — free, no key. Token market data (price, MCap, FDV, liquidity, volume, holders).
- `artifacts/api-server/src/services/moralis.ts` — requires `MORALIS_API_KEY`. EVM wallet tokens/NFTs/history/DeFi/net-worth.
- `artifacts/api-server/src/services/blockstream.ts` — free, no key. Bitcoin wallet data.
- `artifacts/api-server/src/services/cache.ts` — in-memory TTL cache (5min default).
- `artifacts/api-server/src/services/wallet-scanner.ts` — orchestrator for wallet scans.
- `artifacts/api-server/src/services/token-scanner.ts` — orchestrator for token scans.

**Why:** Prevents hallucination. AI receives ground-truth on-chain data and can only analyze what's real.

**How to apply:** When adding new data sources, always pass data through the system prompt context before AI call. Mark "Unknown" for unavailable fields rather than guessing.

## API Routes
- `POST /api/analyze` — main analysis endpoint (wallet/token/contract/project)
- `GET /api/analyze/history` — list last 50 scans (newest first)
- `GET /api/analyze/history/:id` — full scan result by ID
- `POST /api/analyze/chat` — AI copilot with scan context

## DB Schema
`lib/db/src/schema/scan-history.ts` — `scan_history` table (id, target, type, chain, result JSONB, scanned_at). Migrated.

## Response Shape (enriched)
```json
{
  "target", "type", "chain", "summary", "riskScore", "metrics", "sections", "insights", "analyzedAt",
  "walletScan": WalletScanData | null,
  "tokenScan": TokenScanData | null,
  "contractScan": ContractScanData | null,
  "recommendations": string[],
  "smartMoneyScore": number | null,
  "walletHealthScore": number | null
}
```

## Frontend Type Strategy
Generated types don't include new fields. Cast result to `RichAnalyzeResult` from `@/lib/scan-types`. Never run codegen for these — maintain types manually in `scan-types.ts`.

**Why:** Codegen would overwrite `scan-types.ts` and is slow to run in dev.

## Wallet Connect
`@reown/appkit` + `wagmi@3.7.3`. Multiple-React-instance bug fixed by aliasing react/react-dom to monorepo root in vite.config.ts. Provider order: WagmiProvider → QueryClientProvider → rest. `VITE_WALLETCONNECT_PROJECT_ID` needed from cloud.reown.com for modal to open.

## Moralis Graceful Degradation
When `MORALIS_API_KEY` is absent, wallet scan sets `dataSource: "limited"`. Frontend shows a yellow banner suggesting adding the key. GoPlus security + AI analysis still work.
