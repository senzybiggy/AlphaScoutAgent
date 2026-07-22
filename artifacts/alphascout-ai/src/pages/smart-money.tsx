import { useState, useCallback } from "react";
import {
  TrendingUp, Wallet, Activity, Loader2, AlertCircle, RefreshCw,
  Star, Shield, Zap, ExternalLink, Clock, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { RichAnalyzeResult } from "@/lib/scan-types";
import { fmtUsd, shortAddr, timeAgo } from "@/lib/scan-types";
import { Link } from "wouter";

/** Static curated list of notable on-chain addresses */
const CURATED: { label: string; address: string; tag: string; chain: string }[] = [
  { label: "Vitalik Buterin", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", tag: "ETH Co-founder", chain: "ethereum" },
  { label: "Ethereum Foundation", address: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe", tag: "Protocol Treasury", chain: "ethereum" },
  { label: "Uniswap Labs", address: "0x1a9C8182C09F50C8318d769245beA52c32BE35BC", tag: "DEX Protocol", chain: "ethereum" },
  { label: "Binance Hot Wallet", address: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", tag: "CEX", chain: "ethereum" },
  { label: "Coinbase Cold", address: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3", tag: "CEX", chain: "ethereum" },
  { label: "Jump Crypto", address: "0x8EB8a3b98659Cce290402893d0123abb75E3ab28", tag: "Market Maker", chain: "ethereum" },
  { label: "Wintermute", address: "0x4f3a120E72C76c22ae802D129F599BFDbc31cb81", tag: "Market Maker", chain: "ethereum" },
  { label: "Polygon Ecosystem", address: "0xFa7D2a996aC6350f4b56C043112Da0366a59b74c", tag: "L2 Protocol", chain: "ethereum" },
  { label: "Paradigm", address: "0xA8a1D25B0a4E0E87fc42b1Ea25E4C0f2b14e5bB9", tag: "Venture Fund", chain: "ethereum" },
];

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="ml-1 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono border border-primary/15 text-primary/50 bg-primary/5 leading-4">
      {source}
    </span>
  );
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 32; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-border/30" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="text-xl font-bold font-mono -mt-14" style={{ color }}>{score}</span>
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mt-7">{label}</p>
    </div>
  );
}

async function analyzeWallet(address: string, chain: string): Promise<RichAnalyzeResult> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: address, type: "wallet", chain }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Analysis failed");
  }
  return r.json() as Promise<RichAnalyzeResult>;
}

function SmartMoneyIndexCard({ score, riskScore, healthScore }: { score: number | null; riskScore: number | null; healthScore: number | null }) {
  const smi = score ?? 0;
  const smiColor = smi >= 70 ? "#3b82f6" : smi >= 40 ? "#FBBF24" : "#6B7280";
  const smiLabel = smi >= 70 ? "High Signal" : smi >= 40 ? "Moderate" : "Low Signal";
  return (
    <Card className="bg-card/50 border-border/40">
      <CardHeader className="pb-2 border-b border-border/20">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />SMART MONEY INDEX
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex items-center justify-around flex-wrap gap-4">
          {score != null ? (
            <div className="flex flex-col items-center">
              <ScoreRing score={smi} label="SMI" color={smiColor} />
              <Badge variant="outline" className="mt-2 text-xs font-mono" style={{ borderColor: smiColor + "60", color: smiColor }}>
                {smiLabel}
              </Badge>
            </div>
          ) : (
            <p className="text-xs font-mono text-muted-foreground">SMI not available</p>
          )}
          {riskScore != null && (
            <div className="text-center">
              <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Risk Score</p>
              <p className={cn("text-3xl font-bold font-mono", riskScore >= 70 ? "text-destructive" : riskScore >= 40 ? "text-yellow-400" : "text-success")}>
                {riskScore}
              </p>
              <p className="text-xs font-mono text-muted-foreground">/100</p>
            </div>
          )}
          {healthScore != null && (
            <div className="text-center">
              <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Wallet Health</p>
              <p className={cn("text-3xl font-bold font-mono", healthScore >= 70 ? "text-success" : healthScore >= 40 ? "text-yellow-400" : "text-destructive")}>
                {healthScore}
              </p>
              <p className="text-xs font-mono text-muted-foreground">/100</p>
            </div>
          )}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/15">
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            The <span className="text-primary">Smart Money Index</span> combines wallet age, transaction sophistication, DeFi activity, portfolio diversity, and historical performance signals to identify high-signal on-chain operators.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SmartMoney() {
  const [input, setInput] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RichAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (address: string, c = chain) => {
    if (!address.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await analyzeWallet(address.trim(), c);
      setData(result);
      setInput(address.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze wallet");
    } finally {
      setLoading(false);
    }
  }, [chain]);

  const wallet = data?.walletScan;
  const fieldSources = data?.fieldSources ?? {};

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
          <TrendingUp className="h-8 w-8 text-primary" />SMART MONEY TRACKER
        </h1>
        <p className="text-muted-foreground">
          Follow high-signal on-chain operators. Select a notable wallet or enter any address to reveal its intelligence profile.
        </p>
      </div>

      {/* Scan input */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scan(input)}
          placeholder="Enter wallet address (0x… or Solana)…"
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
          {loading ? "Analyzing…" : "Analyze"}
        </Button>
        {data && (
          <Button variant="ghost" size="icon" onClick={() => scan(input)} disabled={loading} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Curated list */}
      <div className="mb-8">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Star className="h-3.5 w-3.5" />NOTABLE WALLETS — QUICK LOAD
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {CURATED.map((w) => (
            <button
              key={w.address}
              onClick={() => scan(w.address, w.chain)}
              disabled={loading}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:border-primary/40 hover:bg-primary/5",
                input === w.address ? "border-primary/60 bg-primary/10" : "border-border/30 bg-card/30",
              )}
            >
              <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20 flex-shrink-0">
                <Wallet className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono font-bold truncate">{w.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 border-border/30 text-muted-foreground">{w.tag}</Badge>
                  <span className="text-[9px] font-mono text-muted-foreground/40">{w.address.slice(0, 8)}…</span>
                </div>
              </div>
            </button>
          ))}
        </div>
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
            <p className="text-sm font-mono text-muted-foreground">Fetching on-chain intelligence…</p>
          </div>
        </div>
      )}

      {!loading && wallet && data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Address header */}
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-bold break-all">{data.target}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs font-mono capitalize">{wallet.chain}</Badge>
                  {wallet.walletLabels.map((l) => (
                    <Badge key={l} variant="outline" className="text-xs font-mono border-primary/20 text-primary/80">{l}</Badge>
                  ))}
                  {(wallet.isSanctioned || wallet.isScammer || wallet.isMixer) && (
                    <Badge variant="outline" className="text-xs font-mono text-destructive border-destructive/30 bg-destructive/5">
                      ⚠ Risk Flags
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://etherscan.io/address/${data.target}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />Etherscan
                </a>
                <Link href={`/analyze?target=${encodeURIComponent(data.target)}&type=wallet&chain=${wallet.chain}`}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono h-7 border-border/40 hover:border-primary/40">
                    <ChevronRight className="h-3.5 w-3.5" />Full Analysis
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Smart Money Index */}
          <SmartMoneyIndexCard
            score={data.smartMoneyScore ?? wallet.smartMoneyScore}
            riskScore={data.riskScore}
            healthScore={data.walletHealthScore ?? wallet.walletHealthScore}
          />

          {/* Portfolio stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Portfolio Value", value: fmtUsd(wallet.totalNetWorthUsd, true), sub: `${wallet.tokens.length} tokens`, source: fieldSources.totalNetWorth ?? fieldSources.tokenBalances },
              { label: "Native Balance", value: `${wallet.nativeBalance} ${wallet.nativeSymbol}`, sub: fmtUsd(wallet.nativeBalanceUsd), source: fieldSources.nativeBalance },
              { label: "Wallet Age", value: wallet.walletAgeDays != null ? `${wallet.walletAgeDays}d` : "—", sub: wallet.firstTxDate ? `Since ${new Date(wallet.firstTxDate).getFullYear()}` : undefined, source: fieldSources.walletAge },
              { label: "Transactions", value: wallet.txCount > 0 ? wallet.txCount.toLocaleString() : "—", sub: wallet.lastTxDate ? `Last: ${timeAgo(wallet.lastTxDate)}` : undefined, source: fieldSources.txCount },
            ].map(({ label, value, sub, source }) => (
              <Card key={label} className="bg-card/50 border-border/40">
                <CardContent className="p-4">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center">
                    {label}<SourceBadge source={source} />
                  </p>
                  <p className="text-lg font-bold font-mono mt-1">{value}</p>
                  {sub && <p className="text-xs text-muted-foreground font-mono mt-0.5">{sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Top token holdings */}
          {wallet.tokens.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />PORTFOLIO COMPOSITION
                  <SourceBadge source={fieldSources.tokenBalances} />
                  <Badge variant="outline" className="ml-auto font-mono text-xs">{wallet.tokens.length} tokens</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/20 bg-muted/10">
                        {["Token", "Balance", "USD Value", "24H", "Allocation"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left first:text-left text-xs font-mono text-muted-foreground uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {wallet.tokens.slice(0, 12).map((t, i) => (
                        <tr key={t.address || i} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-mono font-bold">{t.symbol}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[100px]">{t.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">{t.balanceFormatted}</td>
                          <td className="px-4 py-3 text-xs font-mono font-bold">{fmtUsd(t.usdValue)}</td>
                          <td className="px-4 py-3 text-xs font-mono">
                            {t.change24h != null ? (
                              <span className={t.change24h >= 0 ? "text-success" : "text-destructive"}>
                                {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(2)}%
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, t.portfolioPct ?? 0)}%` }} />
                              </div>
                              <span className="text-xs font-mono text-muted-foreground">{t.portfolioPct?.toFixed(1) ?? "—"}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent transactions */}
          {wallet.recentTransactions.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />RECENT MOVES
                  <SourceBadge source={fieldSources.txCount} />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {wallet.recentTransactions.slice(0, 8).map((tx, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-border/20 last:border-0 hover:bg-muted/10">
                    <div className={cn("p-1.5 rounded-lg flex-shrink-0", tx.category === "receive" ? "bg-success/10" : "bg-primary/10")}>
                      {tx.category === "receive" ? (
                        <Shield className="h-3 w-3 text-success" />
                      ) : (
                        <Activity className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono truncate">{tx.summary}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/50">{timeAgo(tx.timestamp)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono font-bold">{tx.valueFormatted}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* AI summary */}
          {data.summary && (
            <Card className="bg-card/50 border-primary/10 border scanline">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />AI INTELLIGENCE SUMMARY
                  {data.confidenceScore != null && (
                    <span className="ml-auto text-xs font-mono text-muted-foreground border border-border/30 rounded px-2 py-0.5 bg-muted/20">
                      {data.confidenceScore}% confidence
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <p className="text-sm leading-relaxed">{data.summary}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center space-y-3 opacity-40">
          <TrendingUp className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">SELECT A NOTABLE WALLET OR ENTER AN ADDRESS TO BEGIN</p>
        </div>
      )}
    </div>
  );
}
