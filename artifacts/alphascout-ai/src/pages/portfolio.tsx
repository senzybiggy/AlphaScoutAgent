import { useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Wallet, BarChart3, Activity, AlertCircle, Loader2, RefreshCw, PieChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { useAppKitAccount } from "@reown/appkit/react";
import type { RichAnalyzeResult, WalletToken } from "@/lib/scan-types";
import { fmtUsd } from "@/lib/scan-types";
import { cn } from "@/lib/utils";

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627EEA",
  base: "#0052FF",
  arbitrum: "#28A0F0",
  optimism: "#FF0420",
  polygon: "#8247E5",
  bsc: "#F3BA2F",
  solana: "#9945FF",
  bitcoin: "#F7931A",
  other: "#6B7280",
};

const TOKEN_COLORS = ["#00d4ff", "#627EEA", "#8247E5", "#F3BA2F", "#FF0420", "#28A0F0", "#9945FF", "#F7931A", "#10B981", "#6B7280"];

function StatCard({ label, value, sub, color = "text-foreground" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card className="bg-card/50 border-border/40">
      <CardContent className="p-4">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className={cn("text-xl font-bold font-mono", color)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground font-mono mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-success" : score >= 40 ? "bg-yellow-400" : "bg-destructive";
  const label = score >= 70 ? "Excellent" : score >= 40 ? "Moderate" : "Poor";
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono text-muted-foreground">Wallet Health</span>
        <span className={cn("text-sm font-bold font-mono", score >= 70 ? "text-success" : score >= 40 ? "text-yellow-400" : "text-destructive")}>
          {score}/100 · {label}
        </span>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

interface GainerLoser {
  symbol: string;
  name: string;
  change: number;
  value: string;
}

function getTopMovers(tokens: WalletToken[]): { gainers: GainerLoser[]; losers: GainerLoser[] } {
  const withChange = tokens.filter((t) => t.change24h != null && t.usdValue != null && t.usdValue > 0);
  const sorted = [...withChange].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  const map = (t: WalletToken): GainerLoser => ({
    symbol: t.symbol,
    name: t.name,
    change: t.change24h ?? 0,
    value: fmtUsd(t.usdValue),
  });
  return {
    gainers: sorted.slice(0, 5).map(map),
    losers: sorted.slice(-5).reverse().map(map),
  };
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

export function Portfolio() {
  const { address, isConnected } = useAppKitAccount();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RichAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loadWalletData(target.trim());
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, []);

  const wallet = data?.walletScan;
  const { gainers, losers } = wallet ? getTopMovers(wallet.tokens) : { gainers: [], losers: [] };

  // Chain allocation data
  const chainData = wallet?.multiChainBalances
    ? wallet.multiChainBalances.map((c) => ({
        name: c.chain.charAt(0).toUpperCase() + c.chain.slice(1),
        value: parseFloat(c.formatted) || 0,
        color: CHAIN_COLORS[c.chain] ?? CHAIN_COLORS.other,
      })).filter((c) => c.value > 0)
    : [];

  // Token allocation data (top 8 by USD value + "Other")
  const tokensSorted = wallet
    ? [...wallet.tokens].sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))
    : [];
  const top8 = tokensSorted.slice(0, 8);
  const otherUsd = tokensSorted.slice(8).reduce((sum, t) => sum + (t.usdValue ?? 0), 0);
  const tokenPieData = [
    ...top8.map((t, i) => ({
      name: t.symbol,
      value: t.usdValue ?? 0,
      color: TOKEN_COLORS[i] ?? "#6B7280",
      pct: wallet?.totalNetWorthUsd ? ((t.usdValue ?? 0) / wallet.totalNetWorthUsd * 100).toFixed(1) : "0",
    })),
    ...(otherUsd > 0 ? [{ name: "Other", value: otherUsd, color: "#6B7280", pct: wallet?.totalNetWorthUsd ? (otherUsd / wallet.totalNetWorthUsd * 100).toFixed(1) : "0" }] : []),
  ].filter((d) => d.value > 0);

  // Token bar chart (top 10 by USD)
  const barData = tokensSorted.slice(0, 10).map((t) => ({
    name: t.symbol,
    value: t.usdValue ?? 0,
  }));

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          PORTFOLIO DASHBOARD
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
          <Button
            variant="outline"
            onClick={() => { setInput(address); scan(address); }}
            className="gap-2 font-mono text-xs border-primary/20 hover:border-primary/60"
          >
            <Wallet className="h-4 w-4" />
            My Wallet
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-card/40 rounded-xl border border-border/20" />
            ))}
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
            />
            <StatCard
              label="Native Balance"
              value={wallet.nativeBalance}
              sub={wallet.nativeSymbol}
            />
            <StatCard
              label="Transactions"
              value={wallet.txCount.toLocaleString()}
              sub={wallet.walletAgeDays != null ? `${wallet.walletAgeDays}d old` : undefined}
            />
            <StatCard
              label="Smart Money Score"
              value={wallet.smartMoneyScore != null ? `${wallet.smartMoneyScore}/100` : "N/A"}
              color={wallet.smartMoneyScore != null && wallet.smartMoneyScore >= 70 ? "text-success" : "text-foreground"}
            />
          </div>

          {/* Wallet health + risk */}
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-6 space-y-4">
              {wallet.walletHealthScore != null && <HealthBar score={wallet.walletHealthScore} />}
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
                    <Badge key={l} variant="outline" className="text-xs font-mono border-primary/20 text-primary/80">
                      {l}
                    </Badge>
                  ))}
                </div>
              )}
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
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={chainData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chainData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} opacity={0.85} />
                        ))}
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
                  <span>Single-chain wallet · {wallet.chain.toUpperCase()}</span>
                </CardContent>
              </Card>
            )}

            {/* Token allocation */}
            {tokenPieData.length > 0 ? (
              <Card className="bg-card/50 border-border/40">
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-primary" />TOKEN ALLOCATION
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={tokenPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {tokenPieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} opacity={0.85} />
                        ))}
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

          {/* Multi-chain badges */}
          {wallet.chainsUsed.length > 0 && (
            <Card className="bg-card/30 border-border/20">
              <CardContent className="p-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">Active chains:</span>
                {wallet.chainsUsed.map((c) => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="text-xs font-mono capitalize"
                    style={{ borderColor: CHAIN_COLORS[c] + "60", color: CHAIN_COLORS[c] }}
                  >
                    {c}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 opacity-40">
          <BarChart3 className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">
            ENTER A WALLET ADDRESS TO VIEW PORTFOLIO DASHBOARD
          </p>
        </div>
      )}
    </div>
  );
}
