/**
 * Short-lived scan result cache (5-minute TTL, max 20 entries).
 * Avoids re-scanning the same target within the TTL window.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
const STORAGE_KEY = "alphascout:scan-cache";
const MAX_ENTRIES = 20;

interface CacheEntry { result: unknown; cachedAt: number }
type CacheMap = Record<string, CacheEntry>;

function load(): CacheMap {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as CacheMap; }
  catch { return {}; }
}
function save(map: CacheMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}
function key(target: string, type: string, chain?: string | null) {
  return `${target.toLowerCase()}::${type}::${chain ?? ""}`;
}

export const scanCache = {
  get<T>(target: string, type: string, chain?: string | null): T | null {
    const map = load();
    const entry = map[key(target, type, chain)];
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      delete map[key(target, type, chain)];
      save(map);
      return null;
    }
    return entry.result as T;
  },

  set(target: string, type: string, chain: string | null | undefined, result: unknown): void {
    const map = load();
    const k = key(target, type, chain);
    const entries = Object.entries(map);
    if (entries.length >= MAX_ENTRIES) {
      const oldest = entries.sort(([, a], [, b]) => a.cachedAt - b.cachedAt)[0]![0];
      delete map[oldest];
    }
    map[k] = { result, cachedAt: Date.now() };
    save(map);
  },

  has(target: string, type: string, chain?: string | null): boolean {
    return this.get(target, type, chain) !== null;
  },

  clear() { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } },
};
