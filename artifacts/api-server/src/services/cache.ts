/** Simple in-memory TTL cache. */
interface Entry<T> { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { store.delete(key); return undefined; }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs = 5 * 60_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cachedFetch<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 5 * 60_000,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return Promise.resolve(cached);
  return fn().then((v) => { cacheSet(key, v, ttlMs); return v; });
}
