---
name: AlphaScout Feature Set
description: Canonical list of all implemented pages, components, and lib modules — what exists and what was built when.
---

## Pages (all routed in App.tsx)
- `/` — landing hero
- `/dashboard` — enhanced: stat cards (total scans all-time, scans today, avg risk, high-risk count), security alerts section (watchlist items ≥70 risk), separate Recent Wallets / Recent Tokens panels, watchlist preview, quick actions, risk breakdown
- `/analyze` — SmartInput + deterministic ScanProgress (6 stages, progress bar, dot indicators)
- `/portfolio` — wallet scan → charts; NFT gallery grid (wallet.nfts[]); protocol exposure bar chart (defiPositions grouped by protocol)
- `/watchlist` — add/remove/scan items; bulk scan; stores `lastPriceUsd` + `lastPriceChange24h` for token items; price badge shown inline
- `/history` — reopen saved scans
- `/chat` — dual-mode: scan context vs persistent Anthropic conversation
- `/alerts` — alerts store page
- `/smart-money`, `/whale-tracker`, `/rug-pull` — intelligence pages
- `/token/:address` — deep dive token research
- `/share/:token` — shareable report

## Key components
- `src/components/layout/floating-copilot.tsx` — global floating AI Copilot (bottom-right); reads `scanContextStore`; quick-prompts change based on whether scan context is loaded; POST /api/analyze/chat
- `src/components/analyze/wallet-intelligence.tsx` — detection cards: Whale ($1M+), Smart Money (score≥70), Exchange Deposit (label match), Fresh Wallet (<30d), Dormant (>365d), Suspicious (sanctions/mixer/scammer)
- `src/components/analyze/analysis-results.tsx` — calls `scanContextStore.set()` on every new result render (keeps copilot in sync)
- `src/components/analyze/wallet-scan-results.tsx` — includes WalletIntelligence section
- `src/components/analyze/token-scan-results.tsx` — honeypot SecurityFlag fixed: `value={sec.isHoneypot} dangerous`
- `src/components/analyze/export-panel.tsx` — PDF/JSON/Markdown/Share

## Lib modules
- `src/lib/scan-context-store.ts` — module singleton; `scanContextStore.{set, get, clear, subscribe}`; localStorage key `alphascout_copilot_ctx`; 30-min TTL; compatible with chat.tsx
- `src/lib/scan-cache.ts` — `scanCache.{get, set, has, clear}`; 5-min TTL; max 20 entries; keyed `target::type::chain`
- `src/lib/watchlist-store.ts` — `WatchlistItem` has optional `lastPriceUsd` + `lastPriceChange24h` for token items
- `src/lib/scan-types.ts` — all TypeScript interfaces
- `src/lib/portfolio-history-store.ts` — sparkline snapshots

## Known pre-existing issues (excluded from fixes)
- `src/lib/wallet-config.ts` and `src/components/analyze/analyzer-form.tsx` — pre-existing TS errors (Task #6)

## API
- POST /api/analyze — `{ target, type, chain }` → RichAnalyzeResult
- GET /api/analyze/history — recent scan list
- GET /api/analyze/history/:id — full result
- POST /api/analyze/chat — stateless copilot with `{ message, context?, history }` → `{ reply }`

**Why:** Kept as reference to avoid rebuilding or duplicating existing features.
**How to apply:** Read before planning new features to check what already exists.
