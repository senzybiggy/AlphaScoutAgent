/**
 * Solscan API — Solana blockchain explorer.
 * - Public API: no key, rate limited (~10 RPM)
 * - Pro API: requires SOLSCAN_API_KEY (free tier: 100K credits/month)
 * https://pro-api.solscan.io/pro-api-docs/
 */

import { cachedFetch } from "./cache.js";

const PRO_BASE  = "https://pro-api.solscan.io/v2.0";
const PUB_BASE  = "https://public-api.solscan.io";
const TIMEOUT = 10_000;

function getKey(): string | null {
  return process.env.SOLSCAN_API_KEY ?? null;
}

// ── Account info ──────────────────────────────────────────────────────────

export interface SolscanAccount {
  lamports: number;
  solBalance: string;
  txCount: number | null;
  owner: string | null;
  accountType: string; // "account" | "token_account" | "program" | "system_program"
  executable: boolean;
}

export async function getAccountInfo(address: string): Promise<SolscanAccount | null> {
  const key = getKey();
  const cacheKey = `solscan:account:${address}`;

  return cachedFetch(cacheKey, async () => {
    if (key) {
      // Try Pro API first
      try {
        const r = await fetch(`${PRO_BASE}/account/detail?address=${address}`, {
          headers: { token: key, Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT),
        });
        if (r.ok) {
          const body = await r.json() as Record<string, unknown>;
          const d = (body.data as Record<string, unknown>) ?? body;
          const lamports = parseInt(String(d.lamports ?? d.sol_balance ?? "0"), 10);
          return {
            lamports,
            solBalance: (lamports / 1e9).toFixed(6),
            txCount: d.tx_count != null ? parseInt(String(d.tx_count), 10) : null,
            owner: d.owner ? String(d.owner) : null,
            accountType: String(d.account_type ?? d.type ?? "account"),
            executable: Boolean(d.executable),
          };
        }
      } catch { /* fall through to public API */ }
    }

    // Public API fallback
    const r = await fetch(`${PUB_BASE}/account/${address}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) throw new Error(`Solscan public ${r.status}`);
    const data = await r.json() as Record<string, unknown>;
    const lamports = parseInt(String(data.lamports ?? "0"), 10);
    return {
      lamports,
      solBalance: (lamports / 1e9).toFixed(6),
      txCount: null, // Public API doesn't give tx count
      owner: data.owner ? String(data.owner) : null,
      accountType: String(data.type ?? data.account_type ?? "account"),
      executable: Boolean(data.executable),
    };
  }, 120_000);
}

// ── Token holdings ────────────────────────────────────────────────────────

export interface SolscanToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  usdValue: number | null;
}

export async function getTokenAccounts(address: string): Promise<SolscanToken[] | null> {
  const key = getKey();
  if (!key) return null;

  const cacheKey = `solscan:tokens:${address}`;
  return cachedFetch(cacheKey, async () => {
    const r = await fetch(`${PRO_BASE}/account/token-accounts?address=${address}&type=token&page=1&page_size=20`, {
      headers: { token: key, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) throw new Error(`Solscan tokens ${r.status}`);
    const body = await r.json() as Record<string, unknown>;
    const items = Array.isArray(body.data) ? body.data : (body.data as Record<string, unknown>)?.items;
    if (!Array.isArray(items) || items.length === 0) return null;

    return (items as Record<string, unknown>[])
      .filter((t) => (t.amount as number) > 0)
      .map((t): SolscanToken => ({
        mint: String(t.token_address ?? t.mint ?? ""),
        symbol: String(t.token_symbol ?? t.symbol ?? ""),
        name: String(t.token_name ?? t.name ?? ""),
        decimals: parseInt(String(t.token_decimals ?? t.decimals ?? "0"), 10),
        balance: parseInt(String(t.amount ?? "0"), 10),
        usdValue: t.value != null ? parseFloat(String(t.value)) : null,
      }));
  }, 120_000);
}
