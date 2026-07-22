/** LocalStorage-backed portfolio value history. Records a value snapshot each time a wallet is scanned. */

const KEY = "alphascout:portfolio-history";
const MAX_ENTRIES_PER_WALLET = 30;

export interface PortfolioSnapshot {
  timestamp: string; // ISO
  address: string;
  value: number; // totalNetWorthUsd
  txCount: number | null;
}

function load(): PortfolioSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PortfolioSnapshot[];
  } catch {
    return [];
  }
}

function save(entries: PortfolioSnapshot[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export const portfolioHistoryStore = {
  record(address: string, value: number, txCount: number | null = null): void {
    const all = load();
    const normalized = address.toLowerCase();
    const entry: PortfolioSnapshot = {
      timestamp: new Date().toISOString(),
      address: normalized,
      value,
      txCount,
    };
    // Prepend and keep only the last MAX_ENTRIES_PER_WALLET for this address
    const others = all.filter((e) => e.address !== normalized);
    const forWallet = all
      .filter((e) => e.address === normalized)
      .slice(0, MAX_ENTRIES_PER_WALLET - 1);
    save([entry, ...forWallet, ...others]);
  },

  getForAddress(address: string): PortfolioSnapshot[] {
    const normalized = address.toLowerCase();
    return load()
      .filter((e) => e.address === normalized)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  clearForAddress(address: string): void {
    const normalized = address.toLowerCase();
    save(load().filter((e) => e.address !== normalized));
  },
};
