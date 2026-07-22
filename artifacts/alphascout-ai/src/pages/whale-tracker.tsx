import { useState, useCallback, useMemo } from "react";
import {
  Fish, Loader2, AlertCircle, RefreshCw, Activity, Users,
  ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, ChevronRight, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";
import type { RichAnalyzeResult } from "@/lib/scan-types";
import { fmtUsd, shortAddr } from "@/lib/scan-types";
import { Link } from "wouter";

type SortKey = "rank" | "pct";
type SortDir = "asc" | "desc";

const WHALE_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#84cc16",
  "#f97316", "#a855f7",
];

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="ml-1 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono border border-primary/15 text-primary/50 bg-primary/5 leading-4">
      {source}
    </span>
  );
}

/** Compute whale concentration risk from top-holder percentages */
function whaleConcentrationRisk(topHolders: { address: string; pct: number; isLocked: boolean }[]): {
  top10Pct: number;
  top3Pct: number;
  level: "low" | "medium" | "high" | "critical";
  label: string;
  colorClass: string;
} {
  const unlocked = topHolders.filter((h) => !h.isLocked);
  const top10Pct = unlocked.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  const top3Pct = unlocked.slice(0, 3).reduce((s, h) => s + h.pct, 0);
  let level: "low" | "medium" | "high" | "critical" = "low";
  if (top10Pct >= 80 || top3Pct >= 50) level = "critical";
  else if (top10Pct >= 60 || top3Pct >= 35) level = "high";
  else if (top10Pct >= 40 || top3Pct >= 20) level = "medium";
  const labels = { low: "LOW", medium: "MODERATE", high: "HIGH", critical: "CRITICAL" };
  const colors = {
    low: "text-success border-success/30 bg-success/5",
    medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    high: "text-orange-400 border-orange-400/30 bg-orange-400/5",
    critical: "text-destructive border-destructive/30 bg-destructive/5",
  };
  return { top10Pct, top3Pct, level, label: labels[level], colorClass: colors[level] };
}

async function analyzeToken(address: string, chain: string): Promise<RichAnalyzeResult> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: address, type: "token", chain }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Analysis failed");
  }
  return r.json() as Promise<RichAnalyzeResult>;
}

export function WhaleTracker() {
  const [input, setInput] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RichAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAll, setShowAll] = useState(false);

  const scan = useCallback(async (address: string, c = chain) => {
    if (!address.trim()) return;
    setLoading(true); setError(null); setShowAll(false);
    try {
      const result = await analyzeToken(address.trim(), c);
      setData(result);
      setInput(address.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze token");
    } finally {
      setLoading(false);
    }
  }, [chain]);

  const token = data?.tokenScan;
  const fieldSources = data?.fieldSources ?? {};
  const holders = token?.topHolders ?? [];

  const sortedHolders = useMemo(() => {
    const arr = [...holders];
    if (sortKey === "pct") {
      arr.sort((a, b) => sortDir === "asc" ? a.pct - b.pct : b.pct - a.pct);
    } else {
      if (sortDir === "desc") arr.reverse();
    }
    return arr;
  }, [holders, sortKey, sortDir]);

  const displayedHolders = showAll ? sortedHolders : sortedHolders.slice(0, 10);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  // Pie chart data: top 10 vs rest
  const pieData = useMemo(() => {
    if (!holders.length) return [];
    const top10 = holders.slice(0, 10);
    const restPct = 100 - top10.reduce((s, h) => s + h.pct, 0);
    return [
      ...top10.map((h, i) => ({
        name: h.tag ?? shortAddr(h.address),
        value: parseFloat(h.pct.toFixed(2)),
        color: WHALE_COLORS[i] ?? "#6B7280",
        isLocked: h.isLocked,
      })),
      ...(restPct > 0.5 ? [{ name: "Other Holders", value: parseFloat(restPct.toFixed(2)), color: "#374151", isLocked: false }] : []),
    ];
  }, [holders]);

  const concentration = holders.length ? whaleConcentrationRisk(holders) : null;

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
          <Fish className="h-8 w-8 text-primary" />WHALE TRACKER
        </h1>
        <p className="text-muted-foreground">
          Analyze token holder concentration. Identify whale wallets and assess distribution risk.
        </p>
      </div>

      {/* Scan input */}
      <div className="flex flex-col sm:flex-row gap-2 mb-8">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scan(input)}
          placeholder="Token contract address (0x…)…"
          className="flex-1 bg-card/50 border border-border/50 rounded-lg px-4 py-3 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
        />
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          className="bg-card/50 border border-border/50 rounded-lg px-3 py-3 text-sm font-mono text-muted-foreground focus:outline-none focus:border-primary/50"
        >
          {["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc"].map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <Button onClick={() => scan(input)} disabled={loading || !input.trim()} className="gap-2 font-mono">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {loading ? "Scanning…" : "Track Whales"}
        </Button>
        {data && (
          <Button variant="ghost" size="icon" onClick={() => scan(input)} disabled={loading} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-mono text-muted-foreground">Fetching holder data…</p>
          </div>
        </div>
      )}

      {!loading && token && data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Token header */}
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              {token.imageUrl && (
                <img src={token.imageUrl} alt={token.symbol} className="h-10 w-10 rounded-full border border-border/30 flex-shrink-0"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold font-mono">{token.name} <span className="text-primary">({token.symbol})</span></h2>
                <div className="flex flex-wrap gap-2 mt-1">
                  {token.chainId && <Badge variant="outline" className="text-xs font-mono capitalize">{token.chainId}</Badge>}
                  {token.holderCount && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {token.holderCount.toLocaleString()} holders
                      <SourceBadge source={fieldSources.holderCount} />
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {token.priceUsd != null && (
                  <div className="text-right">
                    <p className="text-xs font-mono text-muted-foreground">Price</p>
                    <p className="text-sm font-bold font-mono">${token.priceUsd}</p>
                  </div>
                )}
                <Link href={`/analyze?target=${encodeURIComponent(data.target)}&type=token&chain=${token.chainId ?? chain}`}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono h-8 border-border/40 hover:border-primary/40">
                    <ChevronRight className="h-3.5 w-3.5" />Full Analysis
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Concentration risk + pie */}
          <div className="grid md:grid-cols-5 gap-6">
            {/* Concentration risk card */}
            {concentration && (
              <div className="md:col-span-2 space-y-4">
                <Card className="bg-card/50 border-border/40">
                  <CardHeader className="pb-2 border-b border-border/20">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <Fish className="h-4 w-4 text-primary" />WHALE CONCENTRATION RISK
                      <SourceBadge source={fieldSources.topHolders} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="text-center">
                      <Badge variant="outline" className={cn("text-sm font-mono px-4 py-1.5 border", concentration.colorClass)}>
                        {concentration.label} RISK
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border border-border/30 bg-muted/10 text-center">
                        <p className="text-xs font-mono text-muted-foreground uppercase">Top 3 Hold</p>
                        <p className={cn("text-2xl font-bold font-mono mt-1",
                          concentration.top3Pct >= 50 ? "text-destructive" : concentration.top3Pct >= 35 ? "text-orange-400" : "text-yellow-400")}>
                          {concentration.top3Pct.toFixed(1)}%
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-border/30 bg-muted/10 text-center">
                        <p className="text-xs font-mono text-muted-foreground uppercase">Top 10 Hold</p>
                        <p className={cn("text-2xl font-bold font-mono mt-1",
                          concentration.top10Pct >= 80 ? "text-destructive" : concentration.top10Pct >= 60 ? "text-orange-400" : "text-yellow-400")}>
                          {concentration.top10Pct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/5 border border-border/20 text-xs font-mono text-muted-foreground space-y-1.5">
                      <p className="text-success">🟢 Low: Top 10 &lt; 40%</p>
                      <p className="text-yellow-400">🟡 Medium: Top 10 40–60%</p>
                      <p className="text-orange-400">🟠 High: Top 10 60–80%</p>
                      <p className="text-destructive">🔴 Critical: Top 10 ≥ 80%</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Market stats */}
                <Card className="bg-card/50 border-border/40">
                  <CardContent className="p-4 space-y-2">
                    {[
                      { label: "Market Cap", value: fmtUsd(token.marketCapUsd, true), source: fieldSources.marketCap },
                      { label: "Liquidity", value: fmtUsd(token.liquidityUsd, true), source: fieldSources.liquidityUsd },
                      { label: "24h Volume", value: fmtUsd(token.volumeH24, true), source: fieldSources.volumeH24 },
                    ].map(({ label, value, source }) => (
                      <div key={label} className="flex items-center justify-between">
                        <p className="text-xs font-mono text-muted-foreground flex items-center">
                          {label}<SourceBadge source={source} />
                        </p>
                        <p className="text-sm font-bold font-mono">{value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Pie chart */}
            {pieData.length > 0 && (
              <Card className={cn("bg-card/50 border-border/40", concentration ? "md:col-span-3" : "md:col-span-5")}>
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />HOLDER DISTRIBUTION
                    <SourceBadge source={fieldSources.topHolders} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} opacity={entry.isLocked ? 0.4 : 0.85} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", fontFamily: "monospace" }}
                      />
                      <Legend
                        formatter={(v) => <span className="text-xs font-mono text-muted-foreground">{v}</span>}
                        wrapperStyle={{ paddingTop: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sortable holder table */}
          {holders.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />TOP HOLDERS
                  <SourceBadge source={fieldSources.topHolders} />
                  <Badge variant="outline" className="ml-auto font-mono text-xs">{holders.length} shown</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/20 bg-muted/10">
                        <th className="px-4 py-2 text-left text-xs font-mono text-muted-foreground">#</th>
                        <th className="px-4 py-2 text-left text-xs font-mono text-muted-foreground">ADDRESS</th>
                        <th className="px-4 py-2 text-left text-xs font-mono text-muted-foreground">TAG</th>
                        <th
                          className="px-4 py-2 text-right text-xs font-mono text-muted-foreground cursor-pointer hover:text-primary select-none"
                          onClick={() => toggleSort("pct")}
                        >
                          <span className="flex items-center justify-end">SHARE <SortIcon k="pct" /></span>
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-mono text-muted-foreground">BAR</th>
                        <th className="px-4 py-2 text-center text-xs font-mono text-muted-foreground">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedHolders.map((h, i) => {
                        const originalRank = holders.indexOf(h) + 1;
                        return (
                          <tr key={h.address} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className={cn(
                                "text-xs font-mono font-bold",
                                originalRank === 1 ? "text-yellow-400" : originalRank <= 3 ? "text-primary" : "text-muted-foreground/50"
                              )}>
                                {originalRank}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono">{shortAddr(h.address)}</span>
                                <a href={`https://etherscan.io/address/${h.address}`} target="_blank" rel="noopener noreferrer"
                                  className="text-muted-foreground/30 hover:text-primary transition-colors">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {h.tag ? (
                                <Badge variant="outline" className="text-xs font-mono">{h.tag}</Badge>
                              ) : (
                                <span className="text-xs font-mono text-muted-foreground/30">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={cn(
                                "text-xs font-bold font-mono",
                                h.pct >= 20 ? "text-destructive" : h.pct >= 10 ? "text-orange-400" : h.pct >= 5 ? "text-yellow-400" : "text-muted-foreground",
                              )}>
                                {h.pct.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-center">
                                <div className="w-20 bg-muted/30 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full", h.pct >= 20 ? "bg-destructive" : h.pct >= 10 ? "bg-orange-400" : "bg-primary")}
                                    style={{ width: `${Math.min(100, h.pct)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {h.isLocked ? (
                                <Badge variant="outline" className="text-xs font-mono text-success border-success/30 gap-1">
                                  <Lock className="h-2.5 w-2.5" />Locked
                                </Badge>
                              ) : (
                                <span className="text-xs font-mono text-muted-foreground/30">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {holders.length > 10 && (
                  <div className="p-3 text-center border-t border-border/20">
                    <Button variant="ghost" size="sm" className="text-xs font-mono text-muted-foreground gap-1"
                      onClick={() => setShowAll((v) => !v)}>
                      {showAll ? "Show Less" : `Show All ${holders.length} Holders`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {holders.length === 0 && (
            <Card className="bg-card/30 border-border/20">
              <CardContent className="p-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-mono text-muted-foreground">
                  No holder data available from GoPlus for this token.
                </p>
                <p className="text-xs font-mono text-muted-foreground/50 mt-1">
                  GoPlus supports EVM tokens. Solana/BTC tokens are not covered.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center space-y-3 opacity-40">
          <Fish className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">ENTER A TOKEN CONTRACT ADDRESS TO TRACK WHALE ACTIVITY</p>
        </div>
      )}
    </div>
  );
}
