/**
 * Provider registry — typed fallback chain for multi-provider data fetching.
 * Each category (nativeBalance, tokens, security, etc.) has an ordered list of
 * providers; runWithFallback tries them in order and records every attempt.
 */

export interface ProviderAttempt {
  provider: string;
  category: string;
  status: "success" | "failed" | "skipped";
  error: string | null;
  latencyMs: number;
  /** True when this attempt was cut short by a timeout rather than returning bad data. */
  isTimeout?: boolean;
}

export interface ProviderResult<T> {
  data: T | null;
  /** Name of the provider that succeeded, or null if all failed. */
  provider: string | null;
  attempts: ProviderAttempt[];
}

export interface ProviderDef<T> {
  name: string;
  /** Set to false to skip (e.g. no API key). Defaults to true. */
  enabled?: boolean;
  /** Human-readable reason shown in the error log when enabled=false. */
  skipReason?: string;
  /**
   * Per-provider timeout in ms. Overrides the category-level default.
   * Use shorter timeouts for cheap lookups (native balance ~5 s),
   * longer for security enrichment (~15 s).
   */
  timeoutMs?: number;
  fn: () => Promise<T | null | undefined>;
}

/**
 * Try providers in priority order. Returns the first non-null result and
 * the full attempt log (successes + failures + skips).
 *
 * - A provider returning `null` or `undefined` counts as "no data" and the
 *   next provider is tried.
 * - A provider throwing counts as "failed"; timeout errors are flagged with
 *   `isTimeout: true` so reliability scoring can weight them differently.
 * - An empty array `[]` counts as a valid (non-null) result so callers can
 *   distinguish "confirmed empty" from "data unavailable".
 */
export async function runWithFallback<T>(
  category: string,
  providers: ProviderDef<T>[],
  defaultTimeoutMs = 10_000,
): Promise<ProviderResult<T>> {
  const attempts: ProviderAttempt[] = [];

  for (const p of providers) {
    if (p.enabled === false) {
      attempts.push({
        provider: p.name, category, status: "skipped",
        error: p.skipReason ?? "No API key configured", latencyMs: 0,
      });
      continue;
    }

    const timeout = p.timeoutMs ?? defaultTimeoutMs;
    const start = Date.now();
    try {
      const result = await Promise.race([
        p.fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout),
        ),
      ]);
      const latencyMs = Date.now() - start;

      if (result !== null && result !== undefined) {
        attempts.push({ provider: p.name, category, status: "success", error: null, latencyMs });
        return { data: result as T, provider: p.name, attempts };
      } else {
        attempts.push({ provider: p.name, category, status: "failed", error: "No data returned", latencyMs });
      }
    } catch (err) {
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
      const isTimeout = msg.startsWith("Timeout after");
      attempts.push({
        provider: p.name, category, status: "failed",
        error: msg, latencyMs, isTimeout,
      });
    }
  }

  return { data: null, provider: null, attempts };
}

/** Flatten multiple attempt logs into a single array. */
export function mergeAttempts(...logs: ProviderAttempt[][]): ProviderAttempt[] {
  return logs.flat();
}
