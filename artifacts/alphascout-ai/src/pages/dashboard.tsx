import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard, Clock, Star, Wallet, Coins, FileCode2, Globe,
  ChevronRight, Loader2, TrendingUp, Shield, Zap, TerminalSquare,
  BarChart3, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { watchlistStore } from "@/lib/watchlist-store";
import type { WatchlistItem } from "@/lib/watchlist-store";

interface HistoryEntry {
  id: number;
  target: string;
  type: string;
  chain: string | null;
  scannedAt: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  wallet: Wallet, token: Coins, contract: FileCode2, project: Globe,
};
const TYPE_COLORS: Record<string, string> = {
  wallet: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  token: "text-purple-400 border-purple-400/30 bg-purple-400/5",
  contract: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  project: "text-green-400 border-green-400/30 bg-green-400/5",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1_000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function riskColor(score: number | null) {
  if (score == null) return "text-muted-foreground border-border/30";
  if (score >= 70) return "text-destructive border-destructive/30 bg-destructive/5";
  if (score >= 40) return "text-yellow-400 border-yellow-400/30 bg-yellow-400/5";
  return "text-success border-success/30 bg-success/5";
}

function StatCard({
  icon: Icon, label, value, sub, color = "text-primary",
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="bg-card/50 border-border/40">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
            <p className={cn("text-2xl font-bold font-mono", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground font-mono mt-1">{sub}</p>}
          </div>
          <div className={cn("p-2 rounded-lg bg-primary/10 border border-primary/20")}>
            <Icon className={cn("h-4 w-4", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

async function fetchRecentHistory(): Promise<HistoryEntry[]> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze/history`);
  if (!r.ok) return [];
  const all = await r.json() as HistoryEntry[];
  return all.slice(0, 10);
}

export function Dashboard() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWatchlist(watchlistStore.getAll());
    fetchRecentHistory()
      .then(setHistory)
      .finally(() => setLoading(false));
  }, []);

  // Compute quick stats
  const today = new Date().toDateString();
  const scansToday = history.filter(
    (h) => new Date(h.scannedAt).toDateString() === today,
  ).length;
  const watchlistWithScore = watchlist.filter((w) => w.lastRiskScore != null);
  const avgRisk =
    watchlistWithScore.length > 0
      ? Math.round(
          watchlistWithScore.reduce((s, w) => s + (w.lastRiskScore ?? 0), 0) /
            watchlistWithScore.length,
        )
      : null;
  const highRiskCount = watchlist.filter((w) => (w.lastRiskScore ?? 0) >= 70).length;

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            DASHBOARD
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link href="/analyze">
          <Button className="gap-2 font-mono text-sm">
            <TerminalSquare className="h-4 w-4" />NEW SCAN
          </Button>
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Clock} label="Scans Today" value={scansToday} sub="from this device" />
        <StatCard icon={Star} label="Watchlist" value={watchlist.length} sub={`${watchlistWithScore.length} scanned`} />
        <StatCard
          icon={Shield}
          label="Avg Risk Score"
          value={avgRisk != null ? `${avgRisk}/100` : "—"}
          sub="across watchlist"
          color={avgRisk == null ? "text-muted-foreground" : avgRisk >= 70 ? "text-destructive" : avgRisk >= 40 ? "text-yellow-400" : "text-success"}
        />
        <StatCard
          icon={AlertTriangle}
          label="High Risk Items"
          value={highRiskCount}
          sub="risk score ≥ 70"
          color={highRiskCount > 0 ? "text-destructive" : "text-success"}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent scans — left 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4" />RECENT ACTIVITY
            </h2>
            <Link href="/history">
              <Button variant="ghost" size="sm" className="text-xs font-mono text-muted-foreground gap-1">
                View All <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <Card className="bg-card/30 border-border/20">
              <CardContent className="p-8 text-center">
                <TerminalSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-xs font-mono text-muted-foreground">No scan history yet</p>
                <Link href="/analyze">
                  <Button variant="outline" size="sm" className="mt-4 font-mono text-xs">
                    Run First Scan
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => {
                const Icon = TYPE_ICONS[entry.type] ?? Globe;
                const colorClass = TYPE_COLORS[entry.type] ?? "text-muted-foreground border-border/30 bg-muted/5";
                return (
                  <Link
                    key={entry.id}
                    href={`/analyze?target=${encodeURIComponent(entry.target)}&type=${entry.type}${entry.chain ? `&chain=${entry.chain}` : ""}`}
                  >
                    <Card className="bg-card/50 border-border/40 hover:border-primary/30 hover:bg-card/70 transition-all cursor-pointer group">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg border flex-shrink-0", colorClass)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono font-bold truncate">
                              {entry.target.length > 36 ? entry.target.slice(0, 14) + "…" + entry.target.slice(-10) : entry.target}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge variant="outline" className={cn("text-xs font-mono capitalize", colorClass)}>
                                {entry.type}
                              </Badge>
                              {entry.chain && (
                                <span className="text-xs font-mono text-muted-foreground capitalize">{entry.chain}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-mono text-muted-foreground">{timeAgo(entry.scannedAt)}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Watchlist preview — right 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Star className="h-4 w-4" />WATCHLIST
            </h2>
            <Link href="/watchlist">
              <Button variant="ghost" size="sm" className="text-xs font-mono text-muted-foreground gap-1">
                Manage <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {watchlist.length === 0 ? (
            <Card className="bg-card/30 border-border/20">
              <CardContent className="p-8 text-center">
                <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-xs font-mono text-muted-foreground">Watchlist is empty</p>
                <Link href="/watchlist">
                  <Button variant="outline" size="sm" className="mt-4 font-mono text-xs">
                    Add Items
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {watchlist.slice(0, 8).map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? Globe;
                return (
                  <Link
                    key={item.id}
                    href={`/analyze?target=${encodeURIComponent(item.target)}&type=${item.type}${item.chain ? `&chain=${item.chain}` : ""}`}
                  >
                    <Card className="bg-card/50 border-border/40 hover:border-primary/30 transition-all cursor-pointer group">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("p-1.5 rounded-md border flex-shrink-0", TYPE_COLORS[item.type])}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono font-bold truncate">
                              {item.label ?? (item.target.length > 18 ? item.target.slice(0, 8) + "…" + item.target.slice(-6) : item.target)}
                            </p>
                            {item.lastScannedAt && (
                              <p className="text-[10px] font-mono text-muted-foreground/50">
                                {timeAgo(item.lastScannedAt)}
                              </p>
                            )}
                          </div>
                          {item.lastRiskScore != null && (
                            <Badge variant="outline" className={cn("text-xs font-mono flex-shrink-0", riskColor(item.lastRiskScore))}>
                              {item.lastRiskScore}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
              {watchlist.length > 8 && (
                <Link href="/watchlist">
                  <p className="text-xs font-mono text-muted-foreground/50 text-center py-2 hover:text-primary/60 transition-colors cursor-pointer">
                    +{watchlist.length - 8} more items
                  </p>
                </Link>
              )}
            </div>
          )}

          {/* Quick actions */}
          <Card className="bg-card/30 border-border/20 mt-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-3.5 w-3.5" />QUICK ACTIONS
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 grid grid-cols-2 gap-2">
              <Link href="/portfolio">
                <Button variant="outline" size="sm" className="w-full gap-1.5 font-mono text-xs border-border/40 hover:border-primary/40">
                  <BarChart3 className="h-3.5 w-3.5" />Portfolio
                </Button>
              </Link>
              <Link href="/watchlist">
                <Button variant="outline" size="sm" className="w-full gap-1.5 font-mono text-xs border-border/40 hover:border-primary/40">
                  <Star className="h-3.5 w-3.5" />Watchlist
                </Button>
              </Link>
              <Link href="/agents">
                <Button variant="outline" size="sm" className="w-full gap-1.5 font-mono text-xs border-border/40 hover:border-primary/40">
                  <TrendingUp className="h-3.5 w-3.5" />Agents
                </Button>
              </Link>
              <Link href="/alerts">
                <Button variant="outline" size="sm" className="w-full gap-1.5 font-mono text-xs border-border/40 hover:border-primary/40">
                  <Shield className="h-3.5 w-3.5" />Alerts
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
