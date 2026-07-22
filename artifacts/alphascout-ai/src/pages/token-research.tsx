import { useState, useEffect, useCallback } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import {
  Coins, Loader2, AlertCircle, RefreshCw, Activity, Shield,
  Globe, ExternalLink, MessageSquare, FileText, TrendingUp, TrendingDown,
  Users, CheckCircle, XCircle, HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import type { RichAnalyzeResult, TokenSecurity } from "@/lib/scan-types";
import { fmtUsd, shortAddr } from "@/lib/scan-types";
import { RiskGauge } from "@/components/analyze/risk-gauge";

// ─── Utilities ───────────────────────────────────────────────────────────────

const HOLDER_COLORS = ["#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#84cc16","#f97316","#a855f7"];

/**
 * Map a token chainId to the DexScreener URL path segment.
 * Falls back to the raw chainId so links remain functional even for unknown chains.
 *
 * SecurityFlag invariant (keeps honeypot logic honest):
 *   - dangerous=true  → value===true triggers the ❌ DETECTED state
 *   - dangerous=false → value===false triggers the ❌ No state
 * Never negate a value before passing it to SecurityFlag; pass the raw boolean.
 */
function dexChainSlug(chainId: string | null): string {
  if (!chainId) return "ethereum";
  const map: Record<string, string> = {
    ethereum: "ethereum",
    eth: "ethereum",
    "1": "ethereum",
    bsc: "bsc",
    "binance-smart-chain": "bsc",
    "56": "bsc",
    polygon: "polygon",
    matic: "polygon",
    "137": "polygon",
    arbitrum: "arbitrum",
    "42161": "arbitrum",
    optimism: "optimism",
    "10": "optimism",
    base: "base",
    "8453": "base",
    avalanche: "avalanche",
    avax: "avalanche",
    "43114": "avalanche",
    solana: "solana",
    sol: "solana",
  };
  return map[chainId.toLowerCase()] ?? chainId.toLowerCase();
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="ml-1 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono border border-primary/15 text-primary/50 bg-primary/5 leading-4">
      {source}
    </span>
  );
}

function SecurityFlag({ label, value, dangerous }: { label: string; value: boolean | null; dangerous?: boolean }) {
  const isUnknown = value == null;
  const triggered = dangerous ? value === true : value === false;
  const safe = dangerous ? value === false : value === true;
  return (
    <div className={cn("flex items-center justify-between py-2.5 border-b border-border/20 last:border-0 px-1", triggered && "bg-destructive/5 rounded")}>
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {isUnknown ? (
          <><HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40" /><span className="text-xs font-mono text-muted-foreground/40">Unknown</span></>
        ) : triggered ? (
          <><XCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-xs font-mono text-destructive font-bold">{dangerous ? "DETECTED" : "No"}</span></>
        ) : (
          <><CheckCircle className="h-3.5 w-3.5 text-success" /><span className="text-xs font-mono text-success">{dangerous ? "Clear" : "Yes"}</span></>
        )}
      </div>
    </div>
  );
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

function buildCopilotContext(r: RichAnalyzeResult): string {
  const t = r.tokenScan;
  return JSON.stringify({
    target: r.target, type: r.type, chain: r.chain,
    summary: r.summary, riskScore: r.riskScore,
    confidenceScore: r.confidenceScore,
    insights: r.insights, risks: r.risks,
    opportunities: r.opportunities, recommendations: r.recommendations,
    analyzedAt: r.analyzedAt,
    fieldSources: r.fieldSources,
    providerAttempts: r.providerAttempts?.map(a => ({ provider: a.provider, status: a.status, latencyMs: a.latencyMs })),
    tokenScan: t ? {
      symbol: t.symbol, name: t.name, chainId: t.chainId,
      contractAddress: t.contractAddress,
      priceUsd: t.priceUsd, priceChange24h: t.priceChange24h,
      marketCapUsd: t.marketCapUsd, fdvUsd: t.fdvUsd,
      liquidityUsd: t.liquidityUsd, volumeH24: t.volumeH24,
      buys24h: t.buys24h, sells24h: t.sells24h, holderCount: t.holderCount,
      security: t.security,
      cgDescription: t.cgDescription, cgCategories: t.cgCategories,
      cgAthUsd: t.cgAthUsd, cgAthChangePercent: t.cgAthChangePercent,
      cgGenesisDate: t.cgGenesisDate,
      topHolders: t.topHolders.slice(0, 10),
      dexPairs: t.dexPairs,
    } : null,
  }, null, 2);
}

// ─── Research Notes ───────────────────────────────────────────────────────────

function ResearchNotes({ address }: { address: string }) {
  const key = `token_notes_${address.toLowerCase()}`;
  const [notes, setNotes] = useState(() => localStorage.getItem(key) ?? "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem(key, notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Card className="bg-card/50 border-border/40">
      <CardHeader className="pb-2 border-b border-border/20">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />RESEARCH NOTES
          <span className="ml-auto text-[10px] font-mono text-muted-foreground/50">Saved locally · private to this browser</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`Add your research notes for ${address.slice(0, 10)}…\n\nE.g. team background, tokenomics concerns, audit findings, price targets…`}
          rows={5}
          className="w-full bg-card/30 border border-border/30 rounded-lg px-4 py-3 text-sm font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 resize-none leading-relaxed"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={save} className="text-xs font-mono h-7 gap-1.5">
            {saved ? <CheckCircle className="h-3 w-3 text-success" /> : <FileText className="h-3 w-3" />}
            {saved ? "Saved!" : "Save Notes"}
          </Button>
          {notes && (
            <Button size="sm" variant="ghost" onClick={() => { setNotes(""); localStorage.removeItem(key); }}
              className="text-xs font-mono h-7 text-muted-foreground hover:text-destructive">
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TokenResearch() {
  const params = useParams<{ address: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const address = params.address ?? "";
  const chainParam = new URLSearchParams(search).get("chain") ?? "ethereum";

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RichAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    if (!address) return;
    setLoading(true); setError(null);
    try {
      const result = await analyzeToken(address, chainParam);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [address, chainParam]);

  useEffect(() => { void scan(); }, [scan]);

  const openInChat = () => {
    if (!data) return;
    const ctx = buildCopilotContext(data);
    localStorage.setItem("alphascout_copilot_ctx", JSON.stringify({
      context: ctx,
      target: data.target,
      type: data.type,
      timestamp: Date.now(),
    }));
    navigate("/chat");
  };

  const token = data?.tokenScan;
  const fieldSources = data?.fieldSources ?? {};
  const sec: TokenSecurity | null = token?.security ?? null;

  // Pie data for holders
  const pieData = token?.topHolders.length
    ? [
        ...token.topHolders.slice(0, 10).map((h, i) => ({
          name: h.tag ?? shortAddr(h.address),
          value: parseFloat(h.pct.toFixed(2)),
          color: HOLDER_COLORS[i],
        })),
        ...(100 - token.topHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0) > 0.5
          ? [{ name: "Other", value: parseFloat((100 - token.topHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0)).toFixed(2)), color: "#374151" }]
          : [])
      ]
    : [];

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-mono bg-primary/5 text-primary border-primary/20">TOKEN RESEARCH</Badge>
            <Badge variant="outline" className="text-xs font-mono capitalize">{chainParam}</Badge>
          </div>
          <h1 className="text-2xl font-bold font-mono glow-text">
            {token?.name ? `${token.name} (${token.symbol})` : shortAddr(address)}
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1 break-all">{address}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {token && (
            <Button variant="outline" size="sm" className="gap-2 text-xs font-mono h-8" onClick={openInChat}>
              <MessageSquare className="h-3.5 w-3.5" />Open in Chat
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={scan} disabled={loading} className="gap-2 text-xs font-mono h-8">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Refresh
          </Button>
          <a href={`https://dexscreener.com/search?q=${address}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="gap-2 text-xs font-mono h-8 text-muted-foreground">
              <ExternalLink className="h-3.5 w-3.5" />DexScreener
            </Button>
          </a>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-mono text-muted-foreground">Scanning token…</p>
          </div>
        </div>
      )}

      {!loading && token && data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Token header card */}
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              {token.imageUrl && (
                <img src={token.imageUrl} alt={token.symbol} className="h-12 w-12 rounded-full border border-border/30"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2 className="text-xl font-bold font-mono">{token.name} <span className="text-primary">({token.symbol})</span></h2>
                  {data.riskScore != null && (
                    <span className={cn("text-xs font-mono font-bold px-2 py-0.5 rounded border",
                      data.riskScore >= 70 ? "text-destructive border-destructive/30 bg-destructive/5"
                        : data.riskScore >= 40 ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/5"
                        : "text-success border-success/30 bg-success/5")}>
                      Risk {data.riskScore}/100
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {token.chainId && <Badge variant="outline" className="text-xs font-mono capitalize">{token.chainId}</Badge>}
                  {token.cgCategories.slice(0, 3).map((c) => (
                    <Badge key={c} variant="outline" className="text-xs font-mono text-muted-foreground">{c}</Badge>
                  ))}
                  {token.pairCreatedAt && (
                    <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                      Listed {new Date(token.pairCreatedAt).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>
              {(token.websites.length > 0 || token.socials.length > 0) && (
                <div className="flex gap-2">
                  {token.websites.slice(0, 1).map((w) => (
                    <a key={w} href={w} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg border border-border/30 hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors">
                      <Globe className="h-4 w-4" />
                    </a>
                  ))}
                  {token.socials.slice(0, 2).map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg border border-border/30 hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors text-xs font-mono capitalize">
                      {s.type}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Honeypot alert */}
          {token.security.isHoneypot === true && (
            <Card className="border-destructive/60 bg-destructive/10">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
                <div>
                  <p className="font-bold text-destructive font-mono">🚨 HONEYPOT DETECTED</p>
                  <p className="text-sm text-destructive/80 mt-0.5">This token cannot be sold once purchased. DO NOT BUY.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Market metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { label: "Price", value: token.priceUsd != null ? `$${token.priceUsd}` : "—", sourceKey: "priceUsd" },
              { label: "Market Cap", value: fmtUsd(token.marketCapUsd, true), sourceKey: "marketCap" },
              { label: "FDV", value: fmtUsd(token.fdvUsd, true), sourceKey: "fdvUsd" },
              { label: "Liquidity", value: fmtUsd(token.liquidityUsd, true), sourceKey: "liquidityUsd" },
              { label: "24h Volume", value: fmtUsd(token.volumeH24, true), sourceKey: "volumeH24" },
              { label: "Holders", value: token.holderCount?.toLocaleString() ?? "—", sourceKey: "holderCount" },
              { label: "ATH", value: fmtUsd(token.cgAthUsd, true), sourceKey: "cgMetadata" },
              { label: "ATH Change", value: token.cgAthChangePercent != null ? `${token.cgAthChangePercent.toFixed(1)}%` : "—", sourceKey: "cgMetadata" },
            ].map(({ label, value, sourceKey }) => (
              <Card key={label} className="bg-card/50 border-border/40">
                <CardContent className="p-3">
                  <p className="text-xs font-mono text-muted-foreground uppercase flex items-center">
                    {label}<SourceBadge source={fieldSources[sourceKey]} />
                  </p>
                  <p className="text-base font-bold font-mono mt-0.5">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Price changes */}
          {(token.priceChange1h != null || token.priceChange6h != null || token.priceChange24h != null) && (
            <Card className="bg-card/50 border-border/40">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                  {[
                    { label: "1H", pct: token.priceChange1h },
                    { label: "6H", pct: token.priceChange6h },
                    { label: "24H", pct: token.priceChange24h },
                    ...(token.buys24h != null ? [{ label: "24H Buys", pct: null, value: token.buys24h.toLocaleString(), positive: true }] : []),
                    ...(token.sells24h != null ? [{ label: "24H Sells", pct: null, value: token.sells24h.toLocaleString(), positive: false }] : []),
                  ].map((item, i) => {
                    if ("value" in item && item.value) {
                      return (
                        <div key={i} className="text-center">
                          <p className="text-xs text-muted-foreground font-mono">{item.label}</p>
                          <p className={cn("text-sm font-bold font-mono", item.positive ? "text-success" : "text-destructive")}>{item.value}</p>
                        </div>
                      );
                    }
                    if (item.pct == null) return null;
                    const pos = item.pct >= 0;
                    return (
                      <div key={i} className="text-center">
                        <p className="text-xs text-muted-foreground font-mono">{item.label}</p>
                        <p className={cn("text-sm font-bold font-mono flex items-center justify-center gap-1", pos ? "text-success" : "text-destructive")}>
                          {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {pos ? "+" : ""}{item.pct.toFixed(2)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CoinGecko description */}
          {token.cgDescription && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />PROJECT OVERVIEW
                  <SourceBadge source={fieldSources.cgMetadata} />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <p className="text-sm leading-relaxed text-muted-foreground">{token.cgDescription.slice(0, 600)}{token.cgDescription.length > 600 ? "…" : ""}</p>
              </CardContent>
            </Card>
          )}

          {/* Security + Risk */}
          <div className="grid md:grid-cols-5 gap-6">
            {/* Security flags */}
            {sec && (
              <Card className={cn("bg-card/50 border-border/40", data.riskScore != null ? "md:col-span-3" : "md:col-span-5")}>
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />SECURITY CHECKLIST
                    <SourceBadge source={fieldSources.honeypotCheck} />
                    <Badge variant="outline" className={cn("ml-auto text-xs font-mono border",
                      sec.overallRisk === "critical" ? "text-destructive border-destructive/30"
                        : sec.overallRisk === "high" ? "text-orange-400 border-orange-400/30"
                        : sec.overallRisk === "medium" ? "text-yellow-400 border-yellow-400/30"
                        : "text-success border-success/30")}>
                      {sec.overallRisk.toUpperCase()} RISK
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <SecurityFlag label="Honeypot" value={sec.isHoneypot} dangerous />
                  <SecurityFlag label="Open Source / Verified" value={sec.isOpenSource} />
                  <SecurityFlag label="Mintable" value={sec.isMintable} dangerous />
                  <SecurityFlag label="Hidden Owner" value={sec.hasHiddenOwner} dangerous />
                  <SecurityFlag label="Blacklist Function" value={sec.hasBlacklist} dangerous />
                  <SecurityFlag label="Owner Can Reclaim" value={sec.ownerCanTakeBack} dangerous />
                  <SecurityFlag label="Cannot Sell All" value={sec.cannotSellAll} dangerous />
                  <SecurityFlag label="Transfer Pausable" value={sec.transferPausable} dangerous />
                  <SecurityFlag label="Self-Destruct" value={sec.hasSelfDestruct} dangerous />
                  {(sec.buyTax != null || sec.sellTax != null) && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/20">
                      {["Buy Tax", "Sell Tax"].map((label, i) => {
                        const raw = i === 0 ? sec.buyTax : sec.sellTax;
                        const pct = raw != null ? parseFloat(raw) : null;
                        return (
                          <div key={label} className="text-center p-2 rounded-lg bg-muted/10 border border-border/20">
                            <p className="text-[10px] font-mono text-muted-foreground uppercase">{label}</p>
                            <p className={cn("text-xl font-bold font-mono", pct != null && pct > 20 ? "text-destructive" : pct != null && pct > 5 ? "text-yellow-400" : "text-success")}>
                              {raw != null ? `${parseFloat(raw).toFixed(1)}%` : "?"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Risk gauge */}
            {data.riskScore != null && (
              <Card className="md:col-span-2 bg-card/50 border-border/40 flex flex-col items-center justify-center p-6">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Overall Risk Score</p>
                <RiskGauge score={data.riskScore} />
                {data.confidenceScore != null && (
                  <p className="text-xs font-mono text-muted-foreground mt-3">
                    {data.confidenceScore}% AI confidence
                  </p>
                )}
              </Card>
            )}
          </div>

          {/* Holders pie + table */}
          {token.topHolders.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pie chart */}
              <Card className="bg-card/50 border-border/40">
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />HOLDER DISTRIBUTION
                    <SourceBadge source={fieldSources.topHolders} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                    {pieData.slice(0, 6).map((d) => (
                      <div key={d.name} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Holder table */}
              <Card className="bg-card/50 border-border/40">
                <CardHeader className="pb-2 border-b border-border/20">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />TOP HOLDERS
                    <SourceBadge source={fieldSources.topHolders} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {token.topHolders.slice(0, 10).map((h, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3 border-b border-border/20 last:border-0">
                      <span className="text-xs text-muted-foreground/50 font-mono w-4">{i + 1}</span>
                      <span className="text-xs font-mono flex-1 truncate">{shortAddr(h.address)}</span>
                      {h.tag && <Badge variant="outline" className="text-xs font-mono">{h.tag}</Badge>}
                      {h.isLocked && <span className="text-[10px] font-mono text-success">🔒</span>}
                      <div className="w-16 bg-muted/30 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, h.pct)}%` }} />
                      </div>
                      <span className="text-xs font-bold font-mono w-10 text-right">{h.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* DEX pairs */}
          {token.dexPairs.length > 0 && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />DEX PAIRS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {token.dexPairs.map((p, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between border-b border-border/20 last:border-0">
                    <span className="text-xs font-mono">{p.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">Liq: {p.liquidity}</span>
                      <a href={`https://dexscreener.com/${dexChainSlug(token.chainId)}/${p.pair}`} target="_blank" rel="noopener noreferrer"
                        className="text-primary/60 hover:text-primary">
                        <ExternalLink className="h-3 w-3" />
                      </a>
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
                  <Activity className="h-4 w-4 text-primary" />AI RESEARCH SUMMARY
                  {data.confidenceScore != null && (
                    <span className="ml-auto text-xs font-mono text-muted-foreground border border-border/30 rounded px-2 py-0.5 bg-muted/20">
                      {data.confidenceScore}% confidence
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <p className="text-sm leading-relaxed">{data.summary}</p>
                {data.insights.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Key Findings</p>
                    <ul className="space-y-1.5">
                      {data.insights.map((ins, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-primary opacity-70 flex-shrink-0 mt-0.5">▹</span>
                          <span className="leading-relaxed">{ins}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.risks && data.risks.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-destructive/70 uppercase tracking-wider mb-2">Risks</p>
                    <ul className="space-y-1.5">
                      {data.risks.map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-destructive opacity-70 flex-shrink-0 mt-0.5">✕</span>
                          <span className="leading-relaxed">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.opportunities && data.opportunities.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-success/70 uppercase tracking-wider mb-2">Opportunities</p>
                    <ul className="space-y-1.5">
                      {data.opportunities.map((o, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-success opacity-70 flex-shrink-0 mt-0.5">✓</span>
                          <span className="leading-relaxed">{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Research Notes */}
          <ResearchNotes address={address} />
        </div>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-3 opacity-40">
          <Coins className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">LOADING TOKEN DATA…</p>
        </div>
      )}
    </div>
  );
}
