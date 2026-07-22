import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "./risk-gauge";
import {
  Wallet, Coins, Shield, AlertTriangle, Activity, Clock,
  ArrowUpRight, ArrowDownLeft, Layers, Cpu, TrendingUp,
  TrendingDown, Minus, ExternalLink, Zap, Globe, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WalletScanData, WalletToken } from "@/lib/scan-types";
import { fmtUsd, shortAddr, timeAgo, riskColor } from "@/lib/scan-types";
import { WalletIntelligence } from "./wallet-intelligence";

const PIE_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b",
  "#ef4444","#ec4899","#84cc16","#f97316","#a855f7",
];

interface Props {
  data: WalletScanData;
  riskScore: number | null;
  smartMoneyScore: number | null;
  walletHealthScore: number | null;
  summary: string;
  insights: string[];
  risks: string[];
  opportunities: string[];
  confidenceScore: number | null;
  recommendations: string[];
  fieldSources?: Record<string, string>;
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="ml-1 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono border border-primary/15 text-primary/50 bg-primary/5 leading-4">
      {source}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <Card className="bg-card/50 border-border/40">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn("p-2 rounded-lg", accent ? "bg-primary/10" : "bg-muted/30")}>
          <Icon className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold font-mono truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRing({ score, label, color }: { score: number | null; label: string; color: string }) {
  if (score == null) return null;
  const r = 28; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-border/30" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="text-xl font-bold font-mono -mt-12" style={{ color }}>{score}</span>
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider text-center mt-6">{label}</p>
    </div>
  );
}

function TokenRow({ token, rank }: { token: WalletToken; rank: number }) {
  const isPos = (token.change24h ?? 0) > 0;
  const isNeg = (token.change24h ?? 0) < 0;
  return (
    <tr className="border-b border-border/20 hover:bg-muted/10 transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/50 font-mono w-4">{rank}</span>
          {token.logo ? (
            <img src={token.logo} alt={token.symbol} className="h-5 w-5 rounded-full flex-shrink-0" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Coins className="h-3 w-3 text-primary" />
            </div>
          )}
          <div>
            <p className="text-xs font-bold font-mono">{token.symbol}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[100px]">{token.name}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">{token.balanceFormatted}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">{token.usdPrice != null ? fmtUsd(token.usdPrice) : "—"}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">{fmtUsd(token.usdValue)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {token.change24h != null ? (
          <span className={cn(isPos ? "text-success" : isNeg ? "text-destructive" : "text-muted-foreground")}>
            {isPos ? "+" : ""}{token.change24h.toFixed(2)}%
          </span>
        ) : "—"}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">{token.portfolioPct != null ? `${token.portfolioPct.toFixed(1)}%` : "—"}</td>
    </tr>
  );
}

export function WalletScanResults({ data, riskScore, smartMoneyScore, walletHealthScore, summary, insights, risks, opportunities, confidenceScore, recommendations, fieldSources = {} }: Props) {
  // Portfolio pie data
  const topTokens = data.tokens.filter((t) => t.usdValue && t.usdValue > 0).slice(0, 9);
  const otherValue = data.tokens.slice(9).reduce((s, t) => s + (t.usdValue ?? 0), 0);
  const pieData = [
    ...topTokens.map((t) => ({ name: t.symbol, value: t.usdValue! })),
    ...(otherValue > 0 ? [{ name: "Other", value: otherValue }] : []),
  ];
  const hasPortfolio = pieData.length > 0;

  const overallRisk = riskScore != null
    ? riskScore >= 76 ? "critical" : riskScore >= 51 ? "high" : riskScore >= 26 ? "medium" : "low"
    : "unknown";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Labels */}
      {data.walletLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.walletLabels.map((l) => (
            <Badge key={l} variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/5 gap-1">
              <Star className="h-2.5 w-2.5" />{l}
            </Badge>
          ))}
        </div>
      )}

      {/* Risk alerts */}
      {(data.isSanctioned || data.isMixer || data.isScammer || data.addressRiskLabels.length > 0) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-destructive font-mono">SECURITY ALERT</p>
              <p className="text-xs text-muted-foreground mt-1">
                {[
                  data.isSanctioned && "Sanctioned address",
                  data.isMixer && "Mixer activity detected",
                  data.isScammer && "Scammer/phishing history",
                  ...data.addressRiskLabels,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet Intelligence detection */}
      <WalletIntelligence data={data} />

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50 border-border/40">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Wallet className="h-4 w-4 text-primary" /></div>
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                Portfolio Value<SourceBadge source={fieldSources.totalNetWorth} />
              </p>
              <p className="text-lg font-bold font-mono truncate">{fmtUsd(data.totalNetWorthUsd, true)}</p>
              <p className="text-xs text-muted-foreground">{data.nativeBalance} {data.nativeSymbol}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/40">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted/30"><Coins className="h-4 w-4 text-muted-foreground" /></div>
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                Native Balance<SourceBadge source={fieldSources.nativeBalance} />
              </p>
              <p className="text-lg font-bold font-mono truncate">{data.nativeBalance} {data.nativeSymbol}</p>
              <p className="text-xs text-muted-foreground">{fmtUsd(data.nativeBalanceUsd)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/40">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted/30"><Clock className="h-4 w-4 text-muted-foreground" /></div>
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                Wallet Age<SourceBadge source={fieldSources.walletAge} />
              </p>
              <p className="text-lg font-bold font-mono truncate">{data.walletAgeDays != null ? `${data.walletAgeDays}d` : "—"}</p>
              {data.firstTxDate && <p className="text-xs text-muted-foreground">Since {new Date(data.firstTxDate).getFullYear()}</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/40">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted/30"><Activity className="h-4 w-4 text-muted-foreground" /></div>
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                Transactions<SourceBadge source={fieldSources.txCount} />
              </p>
              <p className="text-lg font-bold font-mono truncate">{data.txCount > 0 ? data.txCount.toLocaleString() : "—"}</p>
              {data.lastTxDate && <p className="text-xs text-muted-foreground">Last: {timeAgo(data.lastTxDate)}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score row */}
      {(riskScore != null || smartMoneyScore != null || walletHealthScore != null) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {riskScore != null && (
            <Card className="bg-card/50 border-border/40 p-4 flex flex-col items-center">
              <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">Risk Score</p>
              <RiskGauge score={riskScore} />
            </Card>
          )}
          {smartMoneyScore != null && (
            <Card className="bg-card/50 border-border/40 p-4 flex flex-col items-center justify-center gap-3">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Smart Money Score</p>
              <ScoreRing score={smartMoneyScore} label="Smart Money" color="#3b82f6" />
            </Card>
          )}
          {walletHealthScore != null && (
            <Card className="bg-card/50 border-border/40 p-4 flex flex-col items-center justify-center gap-3">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Wallet Health</p>
              <ScoreRing score={walletHealthScore} label="Health" color="#10b981" />
            </Card>
          )}
        </div>
      )}

      {/* Portfolio chart + tokens */}
      {(hasPortfolio || data.tokens.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {hasPortfolio && (
            <Card className="lg:col-span-2 bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />TOKEN ALLOCATION
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [fmtUsd(v as number), ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                      <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.tokens.length > 0 && (
            <Card className={cn("bg-card/50 border-border/40", hasPortfolio ? "lg:col-span-3" : "lg:col-span-5")}>
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />TOKEN BALANCES
                  <SourceBadge source={fieldSources.tokenBalances} />
                  <Badge variant="outline" className="ml-auto font-mono text-xs">{data.tokens.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/20 bg-muted/10">
                        {["Token", "Balance", "Price", "Value", "24h", "Alloc"].map((h) => (
                          <th key={h} className="px-3 py-2 text-right first:text-left text-xs font-mono text-muted-foreground uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.tokens.slice(0, 15).map((t, i) => <TokenRow key={t.address || i} token={t} rank={i + 1} />)}
                    </tbody>
                  </table>
                  {data.tokens.length > 15 && (
                    <p className="text-center text-xs text-muted-foreground py-2 font-mono">+{data.tokens.length - 15} more tokens</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* DeFi positions */}
      {data.defiPositions.length > 0 && (
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-2 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />DEFI POSITIONS
              <SourceBadge source={fieldSources.defiPositions} />
              <Badge variant="outline" className="ml-auto font-mono text-xs">{data.defiPositions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/10">
                    {["Protocol", "Type", "Tokens", "Value", "Status"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-mono text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.defiPositions.map((p, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-mono text-sm font-bold text-primary">{p.protocol}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground capitalize">{p.type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{p.tokens.join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-sm">{fmtUsd(p.valueUsd)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={cn("text-xs font-mono", p.status === "active" ? "border-success/30 text-success" : "border-border/30 text-muted-foreground")}>{p.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NFTs */}
      {data.nfts.length > 0 && (
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-2 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />NFT HOLDINGS
              <SourceBadge source={fieldSources.nfts} />
              <Badge variant="outline" className="ml-auto font-mono text-xs">{data.nfts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {data.nfts.slice(0, 10).map((n, i) => (
                <div key={i} className="rounded-lg border border-border/30 overflow-hidden bg-muted/10">
                  {n.image ? (
                    <img src={n.image} alt={n.name} className="w-full aspect-square object-cover" onError={(e) => ((e.target as HTMLImageElement).src = "")} />
                  ) : (
                    <div className="w-full aspect-square bg-muted/30 flex items-center justify-center">
                      <Star className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-mono font-bold truncate">{n.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.collection}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent transactions */}
      {data.recentTransactions.length > 0 && (
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-2 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />RECENT TRANSACTIONS
              <SourceBadge source={fieldSources.txCount} />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/20">
              {data.recentTransactions.slice(0, 10).map((tx, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/10">
                  <div className={cn("p-1.5 rounded-lg flex-shrink-0 mt-0.5", tx.category === "receive" ? "bg-success/10" : "bg-primary/10")}>
                    {tx.category === "receive" ? <ArrowDownLeft className="h-3 w-3 text-success" /> : <ArrowUpRight className="h-3 w-3 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-foreground truncate">{tx.summary}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{timeAgo(tx.timestamp)}</span>
                      {tx.gasFeeNative && <span className="text-xs text-muted-foreground/60">· gas: {tx.gasFeeNative}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono font-bold">{tx.valueFormatted}</p>
                    {tx.valueUsd && <p className="text-xs text-muted-foreground">${tx.valueUsd}</p>}
                    <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-3 w-3 inline-block" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top contracts + counterparties */}
      {(data.topContracts.length > 0 || data.topCounterparties.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.topContracts.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />TOP CONTRACTS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.topContracts.slice(0, 8).map((c, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between border-b border-border/20 hover:bg-muted/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground/50 font-mono w-4">{i + 1}</span>
                      <span className="text-xs font-mono text-foreground">{shortAddr(c.address)}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">{c.txCount}×</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {data.topCounterparties.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />TOP COUNTERPARTIES
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.topCounterparties.slice(0, 8).map((c, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between border-b border-border/20 hover:bg-muted/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground/50 font-mono w-4">{i + 1}</span>
                      <span className="text-xs font-mono text-foreground">{shortAddr(c.address)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-mono", c.direction === "in" ? "text-success" : c.direction === "out" ? "text-primary" : "text-yellow-400")}>
                        {c.direction === "in" ? "↓ IN" : c.direction === "out" ? "↑ OUT" : "↕ BOTH"}
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">{c.txCount}×</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Gas spending */}
      {(data.totalGasSpentNative || data.chainsUsed.length > 0) && (
        <Card className="bg-card/50 border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-400/10 rounded-lg"><Zap className="h-4 w-4 text-yellow-400" /></div>
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase flex items-center">
                {data.totalGasSpentNative ? "Gas Spending (recent txs)" : "Chain Activity"}
                <SourceBadge source={fieldSources.chainActivity} />
              </p>
              {data.totalGasSpentNative && <p className="text-sm font-bold font-mono">{data.totalGasSpentNative}</p>}
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground font-mono">Chains Active</p>
              <div className="flex gap-1 justify-end mt-1">
                {data.chainsUsed.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs font-mono capitalize">{c}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI section */}
      {summary && (
        <Card className="bg-card/50 border-border/50 scanline">
          <CardHeader className="pb-3 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />AI INTELLIGENCE REPORT
              {confidenceScore != null && (
                <span className="ml-auto text-xs font-mono text-muted-foreground border border-border/30 rounded px-2 py-0.5 bg-muted/20">
                  {confidenceScore}% confidence
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm leading-relaxed">{summary}</p>
            {insights.length > 0 && (
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Key Findings</p>
                <ul className="space-y-2">
                  {insights.map((ins, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary mt-0.5 opacity-70 flex-shrink-0">▹</span>
                      <span className="leading-relaxed">{ins}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {risks.length > 0 && (
              <div>
                <p className="text-xs font-mono text-destructive/70 uppercase tracking-wider mb-2">Risks</p>
                <ul className="space-y-2">
                  {risks.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-destructive mt-0.5 opacity-70 flex-shrink-0">✕</span>
                      <span className="leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {opportunities.length > 0 && (
              <div>
                <p className="text-xs font-mono text-success/70 uppercase tracking-wider mb-2">Opportunities</p>
                <ul className="space-y-2">
                  {opportunities.map((o, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-success mt-0.5 opacity-70 flex-shrink-0">✓</span>
                      <span className="leading-relaxed">{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recommendations.length > 0 && (
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Recommendations</p>
                <ul className="space-y-2">
                  {recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-success mt-0.5 opacity-70 flex-shrink-0">→</span>
                      <span className="leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
