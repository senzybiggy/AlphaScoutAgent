import { useState, useCallback, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, Activity, AlertCircle,
  Loader2, RefreshCw, PieChartIcon, LineChart as LineChartIcon, ArrowUpRight,
  ImageOff, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";
import { useAppKitAccount } from "@reown/appkit/react";
import type { RichAnalyzeResult, WalletToken } from "@/lib/scan-types";
import { fmtUsd } from "@/lib/scan-types";
import { cn } from "@/lib/utils";
import { portfolioHistoryStore } from "@/lib/portfolio-history-store";

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627EEA", base: "#0052FF", arbitrum: "#28A0F0",
  optimism: "#FF0420", polygon: "#8247E5", bsc: "#F3BA2F",
  solana: "#9945FF", bitcoin: "#F7931A", other: "#6B7280",
};
const TOKEN_COLORS = [
  "#00d4ff", "#627EEA", "#8247E5", "#F3BA2F", "#FF0420",
  "#28A0F0", "#9945FF", "#F7931A", "#10B981", "#6B7280",
];

/** Small provider source badge */
function SourceBadge({ source }: { source: string | undefined }) {
  if (!source) return null;
  return (
    <span className="ml-1 text-[9px] font-mono px-1 py-0.5 rounded bg-primary/10 text-primary/60 border border-primary/15 uppercase tracking-wide">
      {source}
    </span>
  );
}

function StatCard({
  label, value, sub, color = "text-foreground", source,
}: {
  label: string; value: string; sub?: string; color?: string; source?: string;
}) {
  return (
    <Card className="bg-card/50 border-border/40">
      <CardContent className="p-4">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
          {label}<SourceBadge source={source} />
        </p>
        <p className={cn("text-xl font-bold font-mono", color)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground font-mono mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/** Radial ring chart for wallet health score */
function HealthRing({ score }: { score: number }) {
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#FBBF24" : "#EF4444";
  const label = score >= 70 ? "Excellent" : score >= 40 ? "Moderate" : "Poor";
  const data = [{ name: "Health", value: score, fill: color }];
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="65%" outerRadius="100%"
            startAngle={90} endAngle={-270}
            data={data}
          >
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--muted)/0.2)" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold font-mono" style={{ color }}>{score}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-mono text-muted-foreground">Wallet Health</p>
        <p className="text-sm font-bold font-mono" style={{ color }}>{label}</p>
        <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">0–100 composite score</p>
      </div>
    </div>
  );
}

interface GainerLoser { symbol: string; name: string; change: number; value: string }

function getTopMovers(tokens: WalletToken[]): { gainers: GainerLoser[]; losers: GainerLoser[] } {
  const withChange = tokens.filter((t) => t.change24h != null && t.usdValue != null && t.usdValue > 0);
  const sorted = [...withChange].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  const map = (t: WalletToken): GainerLoser => ({ symbol: t.symbol, name: t.name, change: t.change24h ?? 0, value: fmtUsd(t.usdValue) });
  return { gainers: sorted.slice(0, 5).map(map), losers: sorted.slice(-5).reverse().map(map) };
}

async function loadWalletData(address: string): Promise<RichAnalyzeResult> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: address, type: "wallet" }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Analysis failed");
  }
  return r.json() as Promise<RichAnalyzeResult>;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function Portfolio() {
  const { address, isConnected } = useAppKitAccount();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RichAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{ timestamp: string; value: number }[]>([]);

  const scan = useCallback(async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loadWalletData(target.trim());
      setData(result);
      // Record snapshot for sparkline
      const worth = result.walletScan?.totalNetWorthUsd;
      if (worth != null && worth > 0) {
        portfolioHistoryStore.record(target.trim(), worth, result.walletScan?.txCount ?? null);
      }
      // Load updated history
      setHistoryData(portfolioHistoryStore.getForAddress(target.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load history when input changes (for address already in store)
  useEffect(() => {
    if (input.trim()) {
      setHistoryData(portfolioHistoryStore.getForAddress(input.trim()));
    }
  }, [input]);

  const wallet = data?.walletScan;
  const fieldSources = data?.fieldSources ?? {};
  const { gainers, losers } = wallet ? getTopMovers(wallet.tokens) : { gainers: [], losers: [] };

  const chainData = wallet?.multiChainBalances
    ? wallet.multiChainBalances
        .map((c) => ({ name: c.chain.charAt(0).toUpperCase() + c.chain.slice(1), value: parseFloat(c.formatted) || 0, color: CHAIN_COLORS[c.chain] ?? CHAIN_COLORS.other }))
        .filter((c) => c.value > 0)
    : [];

  const tokensSorted = wallet ? [...wallet.tokens].sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0)) : [];
  const top8 = tokensSorted.slice(0, 8);
  const otherUsd = tokensSorted.slice(8).reduce((sum, t) => sum + (t.usdValue ?? 0), 0);
  const tokenPieData = [
    ...top8.map((t, i) => ({
      name: t.symbol, value: t.usdValue ?? 0, color: TOKEN_COLORS[i] ?? "#6B7280",
      pct: wallet?.totalNetWorthUsd ? ((t.usdValue ?? 0) / wallet.totalNetWorthUsd * 100).toFixed(1) : "0",
    })),
    ...(otherUsd > 0 ? [{ name: "Other", value: otherUsd, color: "#6B7280", pct: wallet?.totalNetWorthUsd ? (otherUsd / wallet.totalNetWorthUsd * 100).toFixed(1) : "0" }] : []),
  ].filter((d) => d.value > 0);

  const barData = tokensSorted.slice(0, 10).map((t) => ({ name: t.symbol, value: t.usdValue ?? 0 }));

  // Sparkline: format for AreaChart
  const sparkData = historyData.map((h) => ({ time: fmtDate(h.timestamp), value: h.value }));
  const sparkChange = sparkData.length >= 2
    ? ((sparkData[sparkData.length - 1]!.value - sparkData[0]!.value) / sparkData[0]!.value) * 100
    : null;

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
          <BarChart3 className="h-8 w-8 text-primary" />PORTFOLIO ANALYTICS
        </h1>
        <p className="text-muted-foreground">Live multi-chain portfolio intelligence. Enter a wallet address to begin.</p>
      </div>

      {/* Scan input */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scan(input)}
          placeholder="Enter wallet address (0x… or Solana)…"
          className="flex-1 bg-card/50 border border-border/50 rounded-lg px-4 py-3 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
        />
        {isConnected && address && (
          <Button variant="outline" onClick={() => { setInput(address); scan(address); }} className="gap-2 font-mono text-xs border-primary/20 hover:border-primary/60">
            <Wallet className="h-4 w-4" />My Wallet
          </Button>
        )}
        <Button onClick={() => scan(input)} disabled={loading || !input.trim()} className="gap-2 font-mono">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {loading ? "Scanning…" : "Scan Portfolio"}
        </Button>
        {data && (
          <Button variant="ghost" size="icon" onClick={() => scan(data.target)} disabled={loading} title="Refresh">
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
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-card/40 rounded-xl border border-border/20" />)}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-64 bg-card/40 rounded-xl border border-border/20" />
            <div className="h-64 bg-card/40 rounded-xl border border-border/20" />
          </div>
        </div>
      )}

      {!loading && wallet && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Portfolio"
              value={fmtUsd(wallet.totalNetWorthUsd)}
              sub={`${wallet.tokens.length} tokens · ${wallet.nfts.length} NFTs`}
              source={fieldSources.totalNetWorthUsd ?? fieldSources.tokenBalances}
            />
            <StatCard
              label="Native Balance"
              value={wallet.nativeBalance}
              sub={wallet.nativeSymbol}
              source={fieldSources.nativeBalance}
            />
            <StatCard
              label="Transactions"
              value={wallet.txCount.toLocaleString()}
              sub={wallet.walletAgeDays != null ? `${wallet.walletAgeDays}d old` : undefined}
              source={fieldSources.txCount}
            />
            <StatCard
              label="Smart Money Score"
              value={wallet.smartMoneyScore != null ? `${wallet.smartMoneyScore}/100` : "N/A"}
              color={wallet.smartMoneyScore != null && wallet.smartMoneyScore >= 70 ? "text-success" : "text-foreground"}
              source={fieldSources.smartMoneyScore ?? fieldSources.nativeBalance}
            />
          </div>

          {/* Portfolio value history sparkline */}
          {sparkData.length >= 2 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4 text-primary" />PORTFOLIO VALUE HISTORY
                  {sparkChange != null && (
                    <span className={cn("ml-auto text-xs font-mono flex items-center gap-1", sparkChange >= 0 ? "text-success" : "text-destructive")}>
                      <ArrowUpRight className={cn("h-3 w-3", sparkChange < 0 && "rotate-180")} />
                      {sparkChange >= 0 ? "+" : ""}{sparkChange.toFixed(1)}% since first scan
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={sparkData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                    <defs>
                      <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 10, fontFamily: "monospace", fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(v: number) => fmtUsd(v, true)} tick={{ fontSize: 10, fontFamily: "monospace", fill: "hsl(var(--muted-foreground))" }} width={64} />
                    <Tooltip
                      formatter={(v: number) => [fmtUsd(v), "Portfolio Value"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", fontFamily: "monospace" }}
                    />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#portfolioGradient)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-[10px] font-mono text-muted-foreground/40 text-right mt-1">
                  {sparkData.length} scan{sparkData.length !== 1 ? "s" : ""} recorded · stored locally
                </p>
              </CardContent>
            </Card>
          )}

          {/* Wallet health ring + risk labels */}
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-6">
                {wallet.walletHealthScore != null && <HealthRing score={wallet.walletHealthScore} />}
                <div className="flex-1 space-y-3">
                  {wallet.addressRiskLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-mono text-muted-foreground">Risk flags:</span>
                      {wallet.addressRiskLabels.map((l) => (
                        <Badge key={l} variant="outline" className="text-xs font-mono text-destructive border-destructive/30 bg-destructive/5">
                          ⚠ {l}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {wallet.walletLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-mono text-muted-foreground">Labels:</span>
                      {wallet.walletLabels.map((l) => (
                        <Badge key={l} variant="outline" className="text-xs font-mono border-primary/20 text-primary/80">{l}</Badge>
                      ))}
                    </div>
                  )}
                  {wallet.addressRiskLabels.length === 0 && wallet.walletLabels.length === 0 && (
                    <p className="text-xs font-mono text-muted-foreground/40">No risk flags or labels detected.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Chain allocation */}
            {chainData.length > 0 ? (
              <Card className="bg-card/50 border-border/40">
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-primary" />CHAIN ALLOCATION
                    <SourceBadge source={fieldSources.chainActivity} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={chainData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {chainData.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.85} />)}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [value.toFixed(4), "Balance"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace" }}
                      />
                      <Legend formatter={(v) => <span className="text-xs font-mono text-muted-foreground">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card/50 border-border/40">
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-primary" />CHAIN ALLOCATION
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex items-center justify-center h-40 text-muted-foreground text-xs font-mono">
                  Single-chain wallet · {wallet.chain.toUpperCase()}
                </CardContent>
              </Card>
            )}

            {/* Token allocation */}
            {tokenPieData.length > 0 ? (
              <Card className="bg-card/50 border-border/40">
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-primary" />TOKEN ALLOCATION
                    <SourceBadge source={fieldSources.tokenBalances} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={tokenPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                        {tokenPieData.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.85} />)}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [fmtUsd(value), "Value"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace" }}
                      />
                      <Legend formatter={(v) => <span className="text-xs font-mono text-muted-foreground">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card/50 border-border/40">
                <CardContent className="p-4 flex items-center justify-center h-40 text-muted-foreground text-xs font-mono">
                  No token holdings found
                </CardContent>
              </Card>
            )}
          </div>

          {/* Token bar chart */}
          {barData.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />TOKEN HOLDINGS BY VALUE (USD)
                  <SourceBadge source={fieldSources.tokenBalances} />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "monospace", fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickFormatter={(v: number) => fmtUsd(v, true)} tick={{ fontSize: 10, fontFamily: "monospace", fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      formatter={(v: number) => [fmtUsd(v), "USD Value"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace" }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" opacity={0.8} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Gainers & Losers */}
          {(gainers.length > 0 || losers.length > 0) && (
            <div className="grid md:grid-cols-2 gap-6">
              {gainers.length > 0 && (
                <Card className="bg-card/50 border-border/40">
                  <CardHeader className="pb-2 border-b border-border/20">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" />TOP GAINERS (24H)
                      <SourceBadge source={fieldSources.tokenBalances} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {gainers.map((t, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border/20 last:border-0 hover:bg-muted/5">
                        <div>
                          <p className="text-sm font-mono font-bold">{t.symbol}</p>
                          <p className="text-xs text-muted-foreground font-mono">{t.value}</p>
                        </div>
                        <span className="text-sm font-bold font-mono text-success">+{t.change.toFixed(2)}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {losers.length > 0 && (
                <Card className="bg-card/50 border-border/40">
                  <CardHeader className="pb-2 border-b border-border/20">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />TOP LOSERS (24H)
                      <SourceBadge source={fieldSources.tokenBalances} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {losers.map((t, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border/20 last:border-0 hover:bg-muted/5">
                        <div>
                          <p className="text-sm font-mono font-bold">{t.symbol}</p>
                          <p className="text-xs text-muted-foreground font-mono">{t.value}</p>
                        </div>
                        <span className="text-sm font-bold font-mono text-destructive">{t.change.toFixed(2)}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* DeFi positions summary */}
          {wallet.defiPositions.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />DEFI POSITIONS
                  <SourceBadge source={fieldSources.defiPositions} />
                  <Badge variant="outline" className="ml-auto font-mono text-xs">{wallet.defiPositions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {wallet.defiPositions.map((pos, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border/20 last:border-0">
                    <div>
                      <p className="text-sm font-mono font-bold">{pos.protocol}</p>
                      <p className="text-xs font-mono text-muted-foreground capitalize">{pos.type} · {pos.tokens.join(", ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold">{pos.valueUsd != null ? fmtUsd(pos.valueUsd) : "—"}</p>
                      {pos.apy && <p className="text-xs font-mono text-success">{pos.apy} APY</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Protocol exposure breakdown */}
          {wallet.defiPositions.length > 0 && (() => {
            const byProtocol: Record<string, number> = {};
            for (const p of wallet.defiPositions) {
              if (p.valueUsd != null) {
                byProtocol[p.protocol] = (byProtocol[p.protocol] ?? 0) + p.valueUsd;
              }
            }
            const entries = Object.entries(byProtocol)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8);
            const max = entries[0]?.[1] ?? 1;
            if (entries.length === 0) return null;
            return (
              <Card className="bg-card/50 border-border/40">
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />PROTOCOL EXPOSURE
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2.5">
                  {entries.map(([protocol, value]) => (
                    <div key={protocol} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold">{protocol}</span>
                        <span className="text-muted-foreground">{fmtUsd(value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full transition-all duration-500"
                          style={{ width: `${(value / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {/* NFT gallery */}
          {wallet.nfts.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <ImageOff className="h-4 w-4 text-primary" />NFT HOLDINGS
                  <Badge variant="outline" className="ml-auto font-mono text-xs">{wallet.nfts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {wallet.nfts.slice(0, 20).map((nft, i) => (
                    <div
                      key={i}
                      className="group rounded-xl overflow-hidden border border-border/30 bg-card/30 hover:border-primary/30 transition-colors"
                    >
                      <div className="aspect-square bg-muted/20 relative overflow-hidden">
                        {nft.image ? (
                          <img
                            src={nft.image}
                            alt={nft.name || `NFT ${nft.tokenId}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                              (e.currentTarget.nextSibling as HTMLElement | null)?.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <div className={cn("w-full h-full flex items-center justify-center", nft.image ? "hidden" : "")}>
                          <ImageOff className="h-6 w-6 text-muted-foreground/20" />
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] font-mono font-bold truncate text-foreground/80">
                          {nft.name || `#${nft.tokenId}`}
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground/50 truncate">{nft.collection}</p>
                        {nft.floorPriceUsd != null && (
                          <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
                            Floor {fmtUsd(nft.floorPriceUsd)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {wallet.nfts.length > 20 && (
                  <p className="text-xs font-mono text-muted-foreground/40 text-center mt-4">
                    +{wallet.nfts.length - 20} more NFTs not shown
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Active chains */}
          {wallet.chainsUsed.length > 0 && (
            <Card className="bg-card/30 border-border/20">
              <CardContent className="p-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">Active chains:</span>
                {wallet.chainsUsed.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs font-mono capitalize"
                    style={{ borderColor: CHAIN_COLORS[c] + "60", color: CHAIN_COLORS[c] }}>
                    {c}
                  </Badge>
                ))}
                <SourceBadge source={fieldSources.chainActivity} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 opacity-40">
          <BarChart3 className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">ENTER A WALLET ADDRESS TO VIEW PORTFOLIO ANALYTICS</p>
        </div>
      )}
    </div>
  );
}
