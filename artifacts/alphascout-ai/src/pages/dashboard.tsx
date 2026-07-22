import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard, Clock, Star, Wallet, Coins, FileCode2, Globe,
  ChevronRight, Loader2, TrendingUp, Shield, Zap, TerminalSquare,
  BarChart3, AlertTriangle, Activity, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { watchlistStore } from "@/lib/watchlist-store";
import type { WatchlistItem } from "@/lib/watchlist-store";
import { useAppKitAccount } from "@reown/appkit/react";

interface HistoryEntry {
  id: number; target: string; type: string; chain: string | null; scannedAt: string;
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

function shortAddr(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function StatCard({
  icon: Icon, label, value, sub, color = "text-primary",
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="bg-card/50 border-border/40">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
            <p className={cn("text-2xl font-bold font-mono truncate", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
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
  return r.json() as Promise<HistoryEntry[]>;
}

export function Dashboard() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { address, isConnected } = useAppKitAccount();

  useEffect(() => {
    setWatchlist(watchlistStore.getAll());
    fetchRecentHistory()
      .then(setHistory)
      .finally(() => setLoading(false));
  }, []);

  // Stats
  const totalScans = history.length;
  const today = new Date().toDateString();
  const scansToday = history.filter((h) => new Date(h.scannedAt).toDateString() === today).length;
  const watchlistWithScore = watchlist.filter((w) => w.lastRiskScore != null);
  const avgRisk = watchlistWithScore.length > 0
    ? Math.round(watchlistWithScore.reduce((s, w) => s + (w.lastRiskScore ?? 0), 0) / watchlistWithScore.length)
    : null;
  const highRiskItems = watchlist.filter((w) => (w.lastRiskScore ?? 0) >= 70);

  // Split recent activity by type
  const recentWallets = history.filter((h) => h.type === "wallet").slice(0, 5);
  const recentTokens = history.filter((h) => h.type === "token").slice(0, 5);

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-1">
            <LayoutDashboard className="h-8 w-8 text-primary" />DASHBOARD
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {isConnected && address && (
              <span className="ml-3 text-primary/60">
                · <Wallet className="h-3 w-3 inline-block mr-1" />{shortAddr(address)}
              </span>
            )}
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
        <StatCard
          icon={Activity}
          label="Total Scans"
          value={totalScans}
          sub={`${scansToday} today`}
        />
        <StatCard
          icon={Star}
          label="Watchlist"
          value={watchlist.length}
          sub={`${watchlistWithScore.length} scanned`}
        />
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
          value={highRiskItems.length}
          sub="risk score ≥ 70"
          color={highRiskItems.length > 0 ? "text-destructive" : "text-success"}
        />
      </div>

      {/* Security alerts */}
      {highRiskItems.length > 0 && (
        <Card className="bg-destructive/5 border-destructive/20 mb-6">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-mono flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />SECURITY ALERTS
              <Badge variant="outline" className="ml-auto text-xs font-mono border-destructive/30 text-destructive bg-destructive/5">
                {highRiskItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {highRiskItems.slice(0, 4).map((item) => {
              const Icon = TYPE_ICONS[item.type] ?? Globe;
              return (
                <Link
                  key={item.id}
                  href={`/analyze?target=${encodeURIComponent(item.target)}&type=${item.type}${item.chain ? `&chain=${item.chain}` : ""}`}
                >
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer">
                    <div className={cn("p-1.5 rounded-md border flex-shrink-0", TYPE_COLORS[item.type])}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-bold truncate">
                        {item.label ?? shortAddr(item.target)}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/60 truncate">{item.target}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono border-destructive/40 text-destructive flex-shrink-0">
                      {item.lastRiskScore}/100
                    </Badge>
                  </div>
                </Link>
              );
            })}
            {highRiskItems.length > 4 && (
              <Link href="/watchlist">
                <p className="text-xs font-mono text-muted-foreground/50 text-center py-1 hover:text-destructive/60 transition-colors cursor-pointer">
                  +{highRiskItems.length - 4} more high-risk items
                </p>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent activity — left 3 cols */}
        <div className="lg:col-span-3 space-y-5">

          {/* Recent wallets */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Wallet className="h-4 w-4" />RECENT WALLETS
              </h2>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="text-xs font-mono text-muted-foreground gap-1">
                  All <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : recentWallets.length === 0 ? (
              <Card className="bg-card/30 border-border/20">
                <CardContent className="p-6 text-center">
                  <p className="text-xs font-mono text-muted-foreground">No wallet scans yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentWallets.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/analyze?target=${encodeURIComponent(entry.target)}&type=${entry.type}${entry.chain ? `&chain=${entry.chain}` : ""}`}
                  >
                    <Card className="bg-card/50 border-border/40 hover:border-primary/30 hover:bg-card/70 transition-all cursor-pointer group">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-md border border-blue-400/30 bg-blue-400/5 flex-shrink-0">
                            <Wallet className="h-3.5 w-3.5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono font-bold truncate">{shortAddr(entry.target)}</p>
                            {entry.chain && <p className="text-[10px] font-mono text-muted-foreground/50 capitalize">{entry.chain}</p>}
                          </div>
                          <p className="text-xs font-mono text-muted-foreground/50 flex-shrink-0">{timeAgo(entry.scannedAt)}</p>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent tokens */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Coins className="h-4 w-4" />RECENT TOKENS
              </h2>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="text-xs font-mono text-muted-foreground gap-1">
                  All <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            {loading ? null : recentTokens.length === 0 ? (
              <Card className="bg-card/30 border-border/20">
                <CardContent className="p-6 text-center">
                  <p className="text-xs font-mono text-muted-foreground">No token scans yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentTokens.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/analyze?target=${encodeURIComponent(entry.target)}&type=${entry.type}${entry.chain ? `&chain=${entry.chain}` : ""}`}
                  >
                    <Card className="bg-card/50 border-border/40 hover:border-primary/30 hover:bg-card/70 transition-all cursor-pointer group">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-md border border-purple-400/30 bg-purple-400/5 flex-shrink-0">
                            <Coins className="h-3.5 w-3.5 text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono font-bold truncate">{entry.target}</p>
                            {entry.chain && <p className="text-[10px] font-mono text-muted-foreground/50 capitalize">{entry.chain}</p>}
                          </div>
                          <p className="text-xs font-mono text-muted-foreground/50 flex-shrink-0">{timeAgo(entry.scannedAt)}</p>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
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
                  <Button variant="outline" size="sm" className="mt-4 font-mono text-xs">Add Items</Button>
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
                              {item.label ?? shortAddr(item.target)}
                            </p>
                            {item.lastScannedAt && (
                              <p className="text-[10px] font-mono text-muted-foreground/50">
                                {timeAgo(item.lastScannedAt)}
                              </p>
                            )}
                          </div>
                          {item.lastRiskScore != null && (
                            <Badge variant="outline" className={cn("text-[10px] font-mono flex-shrink-0", riskColor(item.lastRiskScore))}>
                              {item.lastRiskScore}
                            </Badge>
                          )}
                          {item.lastRiskScore == null && (
                            <span className="text-[10px] font-mono text-muted-foreground/30 flex-shrink-0">—</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
              {watchlist.length > 8 && (
                <Link href="/watchlist">
                  <p className="text-xs font-mono text-muted-foreground/40 text-center py-1 hover:text-primary/60 transition-colors cursor-pointer">
                    +{watchlist.length - 8} more
                  </p>
                </Link>
              )}
            </div>
          )}

          {/* Quick actions */}
          <Card className="bg-card/30 border-border/20 mt-2">
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
              <Link href="/smart-money">
                <Button variant="outline" size="sm" className="w-full gap-1.5 font-mono text-xs border-border/40 hover:border-primary/40">
                  <TrendingUp className="h-3.5 w-3.5" />Smart Money
                </Button>
              </Link>
              <Link href="/rug-pull">
                <Button variant="outline" size="sm" className="w-full gap-1.5 font-mono text-xs border-border/40 hover:border-primary/40">
                  <Shield className="h-3.5 w-3.5" />Rug Detector
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Watchlist risk summary */}
          {watchlist.length > 0 && (
            <Card className="bg-card/30 border-border/20">
              <CardContent className="p-4">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />RISK BREAKDOWN
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold font-mono text-success">
                      {watchlist.filter((i) => i.lastRiskScore != null && i.lastRiskScore < 40).length}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">Low</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono text-yellow-400">
                      {watchlist.filter((i) => i.lastRiskScore != null && i.lastRiskScore >= 40 && i.lastRiskScore < 70).length}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">Medium</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono text-destructive">
                      {highRiskItems.length}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">High</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
