/**
 * Global scan context store — lets the floating AI copilot access the most
 * recently completed scan's context from anywhere in the app.
 * Uses the same localStorage key as the chat page context so they stay in sync.
 */

export interface ScanContext {
  context: string;   // JSON-stringified RichAnalyzeResult
  target: string;
  type: string;
  timestamp: number;
}

type Listener = (ctx: ScanContext | null) => void;

const STORAGE_KEY = "alphascout_copilot_ctx";
const CTX_TTL_MS = 30 * 60 * 1000; // 30 minutes

let _ctx: ScanContext | null = null;
const _listeners = new Set<Listener>();

function notify() {
  for (const l of _listeners) l(_ctx);
}

export const scanContextStore = {
  set(ctx: ScanContext) {
    _ctx = ctx;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx)); } catch { /* ignore */ }
    notify();
  },

  get(): ScanContext | null {
    if (_ctx) {
      if (Date.now() - _ctx.timestamp > CTX_TTL_MS) { _ctx = null; notify(); return null; }
      return _ctx;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ScanContext;
      if (Date.now() - parsed.timestamp > CTX_TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      _ctx = parsed;
      return _ctx;
    } catch { return null; }
  },

  clear() {
    _ctx = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    notify();
  },

  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    // Immediately call with current state
    listener(_ctx ?? scanContextStore.get());
    return () => _listeners.delete(listener);
  },
};
