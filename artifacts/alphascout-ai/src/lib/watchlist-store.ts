/** LocalStorage-backed watchlist store. No backend required. */

export type WatchlistItemType = "wallet" | "token" | "contract" | "project";

export interface WatchlistItem {
  id: string;
  target: string;
  type: WatchlistItemType;
  chain: string | null;
  label: string | null;
  addedAt: string;
  lastRiskScore: number | null;
  lastScannedAt: string | null;
}

const KEY = "alphascout:watchlist";

function load(): WatchlistItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as WatchlistItem[];
  } catch {
    return [];
  }
}

function save(items: WatchlistItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export const watchlistStore = {
  getAll(): WatchlistItem[] {
    return load();
  },
  add(item: Omit<WatchlistItem, "id" | "addedAt">): WatchlistItem {
    const items = load();
    // Deduplicate by target + type
    const existing = items.find(
      (i) => i.target.toLowerCase() === item.target.toLowerCase() && i.type === item.type
    );
    if (existing) return existing;
    const newItem: WatchlistItem = {
      ...item,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    save([newItem, ...items]);
    return newItem;
  },
  remove(id: string): void {
    save(load().filter((i) => i.id !== id));
  },
  update(id: string, patch: Partial<WatchlistItem>): void {
    save(load().map((i) => (i.id === id ? { ...i, ...patch } : i)));
  },
  has(target: string, type: WatchlistItemType): boolean {
    return load().some(
      (i) => i.target.toLowerCase() === target.toLowerCase() && i.type === type
    );
  },
  clear(): void {
    save([]);
  },
};
