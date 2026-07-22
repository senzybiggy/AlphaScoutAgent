import { useState, useEffect, useCallback } from "react";
import { Star, Wallet, Coins, FileCode2, Globe, Trash2, RefreshCw, Plus, X, ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { watchlistStore, type WatchlistItem, type WatchlistItemType } from "@/lib/watchlist-store";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const TYPE_ICONS: Record<WatchlistItemType, React.ElementType> = {
  wallet: Wallet, token: Coins, contract: FileCode2, project: Globe,
};
const TYPE_COLORS: Record<WatchlistItemType, string> = {
  wallet: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  token: "text-purple-400 border-purple-400/30 bg-purple-400/5",
  contract: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  project: "text-green-400 border-green-400/30 bg-green-400/5",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function riskBadge(score: number | null): React.ReactNode {
  if (score == null) return <span className="text-[10px] font-mono text-muted-foreground/40">not scanned</span>;
  const color =
    score >= 70
      ? "text-destructive border-destructive/30 bg-destructive/5"
      : score >= 40
        ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/5"
        : "text-success border-success/30 bg-success/5";
  const label = score >= 70 ? "HIGH" : score >= 40 ? "MED" : "LOW";
  return (
    <Badge variant="outline" className={cn("text-xs font-mono gap-1", color)}>
      {label} {score}/100
    </Badge>
  );
}

/** Very loose validation: EVM hex address, Solana base58, or a URL */
function validateTarget(target: string): string | null {
  const t = target.trim();
  if (!t) return "Target is required.";
  // EVM address: 0x followed by 40 hex chars
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) return null;
  // Solana address: base58, 32–44 chars
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) return null;
  // Bitcoin address
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(t)) return null;
  // Contract address or token: same as EVM
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) return null;
  // URL for project scans
  if (/^https?:\/\/.+/.test(t)) return null;
  // Token symbol or short name is also OK (not an address)
  if (t.length >= 2 && t.length <= 10 && /^[A-Z0-9]+$/i.test(t)) return null;
  return "Enter a valid wallet address (0x…), Solana address, Bitcoin address, or project URL.";
}

interface ScanResult {
  riskScore: number;
  tokenScan?: { priceUsd: number | null; priceChange24h: number | null } | null;
}

async function quickScan(target: string, type: WatchlistItemType, chain: string | null): Promise<ScanResult> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, type, chain: chain ?? undefined }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Scan failed");
  }
  return r.json() as Promise<ScanResult>;
}

function AddItemForm({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [type, setType] = useState<WatchlistItemType>("wallet");
  const [chain, setChain] = useState("");
  const [label, setLabel] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAdd = () => {
    const err = validateTarget(target);
    if (err) { setValidationError(err); return; }
    setValidationError(null);
    watchlistStore.add({
      target: target.trim(),
      type,
      chain: chain.trim() || null,
      label: label.trim() || null,
      lastRiskScore: null,
      lastScannedAt: null,
    });
    setTarget(""); setType("wallet"); setChain(""); setLabel("");
    setOpen(false);
    onAdd();
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2 font-mono text-sm" variant="outline">
        <Plus className="h-4 w-4" />Add to Watchlist
      </Button>
    );
  }

  return (
    <Card className="bg-card/60 border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-mono font-bold text-primary">ADD WATCHLIST ITEM</p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setOpen(false); setValidationError(null); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div>
          <input
            value={target}
            onChange={(e) => { setTarget(e.target.value); setValidationError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="0x address, Solana key, or https://…"
            className={cn(
              "w-full bg-card/50 border rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none transition-colors",
              validationError ? "border-destructive/50 focus:border-destructive/70" : "border-border/50 focus:border-primary/50",
            )}
          />
          {validationError && (
            <p className="text-xs font-mono text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />{validationError}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["wallet", "token", "contract", "project"] as WatchlistItemType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "text-xs font-mono px-3 py-1.5 rounded-full border transition-colors capitalize",
                type === t ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground hover:border-primary/40",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            placeholder="Chain (e.g. ethereum)"
            className="flex-1 bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
          />
        </div>
        <Button onClick={handleAdd} disabled={!target.trim()} className="w-full font-mono text-sm">
          <Star className="h-4 w-4 mr-2" />Save to Watchlist
        </Button>
      </CardContent>
    </Card>
  );
}

export function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [scanAllProgress, setScanAllProgress] = useState<{ done: number; total: number } | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(() => { setItems(watchlistStore.getAll()); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleRemove = (id: string) => { watchlistStore.remove(id); refresh(); };

  const handleScan = async (item: WatchlistItem) => {
    setScanning(item.id);
    try {
      const result = await quickScan(item.target, item.type, item.chain);
      watchlistStore.update(item.id, {
        lastRiskScore: result.riskScore,
        lastScannedAt: new Date().toISOString(),
        lastPriceUsd: result.tokenScan?.priceUsd ?? null,
        lastPriceChange24h: result.tokenScan?.priceChange24h ?? null,
      });
      refresh();
      toast({
        description: (
          <span className="font-mono text-xs flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Scan complete — Risk {result.riskScore}/100
          </span>
        ),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      toast({
        variant: "destructive",
        description: (
          <span className="font-mono text-xs flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            {msg}
          </span>
        ),
      });
    } finally {
      setScanning(null);
    }
  };

  const handleScanAll = async () => {
    const toScan = items.filter((i) => i.lastScannedAt == null || Date.now() - new Date(i.lastScannedAt).getTime() > 5 * 60_000);
    if (toScan.length === 0) {
      toast({ description: <span className="font-mono text-xs">All items scanned recently.</span> });
      return;
    }
    setScanningAll(true);
    setScanAllProgress({ done: 0, total: toScan.length });
    let done = 0;
    for (const item of toScan) {
      try {
        const result = await quickScan(item.target, item.type, item.chain);
        watchlistStore.update(item.id, {
          lastRiskScore: result.riskScore,
          lastScannedAt: new Date().toISOString(),
          lastPriceUsd: result.tokenScan?.priceUsd ?? null,
          lastPriceChange24h: result.tokenScan?.priceChange24h ?? null,
        });
        refresh();
      } catch {
        // continue with others; individual failures are not toasted in bulk mode
      }
      done++;
      setScanAllProgress({ done, total: toScan.length });
    }
    setScanningAll(false);
    setScanAllProgress(null);
    toast({
      description: (
        <span className="font-mono text-xs flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          Bulk scan complete — {toScan.length} items refreshed
        </span>
      ),
    });
  };

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
            <Star className="h-8 w-8 text-primary" />WATCHLIST
          </h1>
          <p className="text-muted-foreground">Track wallets, tokens, and contracts. Saved locally in your browser.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-mono text-xs border-border/40 hover:border-primary/40"
              onClick={handleScanAll}
              disabled={scanningAll}
            >
              {scanningAll ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {scanAllProgress ? `${scanAllProgress.done}/${scanAllProgress.total}` : "Scanning…"}
                </>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5" />Scan All</>
              )}
            </Button>
          )}
          <AddItemForm onAdd={refresh} />
        </div>
      </div>

      {/* Summary bar */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl bg-card/30 border border-border/20">
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-primary">{items.length}</p>
            <p className="text-xs font-mono text-muted-foreground">Total Items</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-success">
              {items.filter((i) => (i.lastRiskScore ?? 100) < 40).length}
            </p>
            <p className="text-xs font-mono text-muted-foreground">Low Risk</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-yellow-400">
              {items.filter((i) => i.lastRiskScore != null && i.lastRiskScore >= 40 && i.lastRiskScore < 70).length}
            </p>
            <p className="text-xs font-mono text-muted-foreground">Medium Risk</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-destructive">
              {items.filter((i) => (i.lastRiskScore ?? 0) >= 70).length}
            </p>
            <p className="text-xs font-mono text-muted-foreground">High Risk</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold font-mono text-muted-foreground">
              {items.filter((i) => i.lastRiskScore == null).length}
            </p>
            <p className="text-xs font-mono text-muted-foreground">Unscanned</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 opacity-40">
          <Star className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">YOUR WATCHLIST IS EMPTY</p>
          <p className="text-xs text-muted-foreground font-mono">Add items from the analyze page or using the button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            const isScanning = scanning === item.id;
            const riskScore = item.lastRiskScore;
            // Left border color based on risk
            const borderAccent =
              riskScore == null ? "border-l-border/30"
              : riskScore >= 70 ? "border-l-destructive/60"
              : riskScore >= 40 ? "border-l-yellow-400/60"
              : "border-l-success/60";

            return (
              <Card
                key={item.id}
                className={cn(
                  "bg-card/50 border-border/40 hover:border-border/60 transition-colors border-l-2",
                  borderAccent,
                )}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Icon + details */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn("p-2 rounded-lg border flex-shrink-0", TYPE_COLORS[item.type])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-mono font-bold truncate max-w-[200px] sm:max-w-xs">
                            {item.label ?? (item.target.length > 24 ? item.target.slice(0, 10) + "…" + item.target.slice(-8) : item.target)}
                          </p>
                          <Badge variant="outline" className={cn("text-xs font-mono capitalize", TYPE_COLORS[item.type])}>
                            {item.type}
                          </Badge>
                          {item.chain && (
                            <Badge variant="outline" className="text-xs font-mono border-border/30 text-muted-foreground capitalize">
                              {item.chain}
                            </Badge>
                          )}
                          {riskBadge(riskScore)}
                          {item.type === "token" && item.lastPriceUsd != null && (
                            <Badge variant="outline" className="text-xs font-mono border-border/30 text-muted-foreground">
                              ${item.lastPriceUsd < 0.01
                                ? item.lastPriceUsd.toExponential(2)
                                : item.lastPriceUsd.toFixed(item.lastPriceUsd < 1 ? 4 : 2)}
                              {item.lastPriceChange24h != null && (
                                <span className={cn("ml-1", item.lastPriceChange24h >= 0 ? "text-success" : "text-destructive")}>
                                  {item.lastPriceChange24h >= 0 ? "+" : ""}{item.lastPriceChange24h.toFixed(1)}%
                                </span>
                              )}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5 truncate">{item.target}</p>
                        <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">
                          Added {timeAgo(item.addedAt)}
                          {item.lastScannedAt
                            ? <> · <span className="text-muted-foreground/60">Scanned {timeAgo(item.lastScannedAt)}</span></>
                            : <> · <span className="text-muted-foreground/30">Never scanned</span></>
                          }
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs font-mono h-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleScan(item)}
                        disabled={isScanning || scanningAll}
                        title="Refresh risk score"
                      >
                        {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Scan</span>
                      </Button>
                      <Link href={`/analyze?target=${encodeURIComponent(item.target)}&type=${item.type}${item.chain ? `&chain=${item.chain}` : ""}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs font-mono h-8 border-border/40 hover:border-primary/40"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Analyze</span>
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(item.id)}
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-mono text-muted-foreground/50 hover:text-destructive"
            onClick={() => { watchlistStore.clear(); refresh(); }}
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}
