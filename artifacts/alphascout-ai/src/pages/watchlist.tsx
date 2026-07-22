import { useState, useEffect, useCallback } from "react";
import { Star, Wallet, Coins, FileCode2, Globe, Trash2, RefreshCw, Plus, X, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { watchlistStore, type WatchlistItem, type WatchlistItemType } from "@/lib/watchlist-store";
import { Link } from "wouter";

const TYPE_ICONS: Record<WatchlistItemType, React.ElementType> = {
  wallet: Wallet,
  token: Coins,
  contract: FileCode2,
  project: Globe,
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
  if (score == null) return null;
  const color = score >= 70 ? "text-destructive border-destructive/30" : score >= 40 ? "text-yellow-400 border-yellow-400/30" : "text-success border-success/30";
  return (
    <Badge variant="outline" className={cn("text-xs font-mono", color)}>
      Risk {score}/100
    </Badge>
  );
}

async function quickScan(target: string, type: WatchlistItemType, chain: string | null): Promise<{ riskScore: number }> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, type, chain: chain ?? undefined }),
  });
  if (!r.ok) throw new Error("Scan failed");
  return r.json();
}

function AddItemForm({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [type, setType] = useState<WatchlistItemType>("wallet");
  const [chain, setChain] = useState("");
  const [label, setLabel] = useState("");

  const handleAdd = () => {
    if (!target.trim()) return;
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
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Wallet address, token contract, or URL…"
          className="w-full bg-card/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
        />
        <div className="flex gap-2 flex-wrap">
          {(["wallet", "token", "contract", "project"] as WatchlistItemType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn("text-xs font-mono px-3 py-1.5 rounded-full border transition-colors capitalize",
                type === t
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border/40 text-muted-foreground hover:border-primary/40"
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
            placeholder="Chain (optional, e.g. ethereum)"
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

  const refresh = useCallback(() => {
    setItems(watchlistStore.getAll());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRemove = (id: string) => {
    watchlistStore.remove(id);
    refresh();
  };

  const handleScan = async (item: WatchlistItem) => {
    setScanning(item.id);
    try {
      const result = await quickScan(item.target, item.type, item.chain);
      watchlistStore.update(item.id, {
        lastRiskScore: result.riskScore,
        lastScannedAt: new Date().toISOString(),
      });
      refresh();
    } catch {
      // silently fail
    } finally {
      setScanning(null);
    }
  };

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
            <Star className="h-8 w-8 text-primary" />
            WATCHLIST
          </h1>
          <p className="text-muted-foreground">Track wallets, tokens, and contracts. Saved locally in your browser.</p>
        </div>
        <AddItemForm onAdd={refresh} />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 opacity-40">
          <Star className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">
            YOUR WATCHLIST IS EMPTY
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            Add items from the analyze page or using the button above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            const isScanning = scanning === item.id;
            return (
              <Card key={item.id} className="bg-card/50 border-border/40 hover:border-border/60 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Icon + Type badge */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn("p-2 rounded-lg border flex-shrink-0", TYPE_COLORS[item.type])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-mono font-bold truncate max-w-[200px] sm:max-w-xs">
                            {item.label ?? item.target.slice(0, 20) + (item.target.length > 20 ? "…" : "")}
                          </p>
                          <Badge variant="outline" className={cn("text-xs font-mono capitalize", TYPE_COLORS[item.type])}>
                            {item.type}
                          </Badge>
                          {item.chain && (
                            <Badge variant="outline" className="text-xs font-mono border-border/30 text-muted-foreground capitalize">
                              {item.chain}
                            </Badge>
                          )}
                          {riskBadge(item.lastRiskScore)}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5 truncate">
                          {item.target}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">
                          Added {timeAgo(item.addedAt)}
                          {item.lastScannedAt && ` · Last scan ${timeAgo(item.lastScannedAt)}`}
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
                        disabled={isScanning}
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
