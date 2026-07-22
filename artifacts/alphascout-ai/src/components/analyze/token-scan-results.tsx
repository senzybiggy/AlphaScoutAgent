import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskGauge } from "./risk-gauge";
import { Shield, AlertTriangle, CheckCircle, XCircle, HelpCircle, TrendingUp, TrendingDown, Globe, ExternalLink, Coins, Users, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokenScanData, TokenSecurity } from "@/lib/scan-types";
import { fmtUsd, shortAddr, riskColor } from "@/lib/scan-types";

interface Props {
  data: TokenScanData;
  riskScore: number | null;
  summary: string;
  insights: string[];
  risks: string[];
  opportunities: string[];
  confidenceScore: number | null;
  recommendations: string[];
  target: string;
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

function PriceChange({ pct, label }: { pct: number | null; label: string }) {
  if (pct == null) return <div className="text-center"><p className="text-xs text-muted-foreground font-mono">{label}</p><p className="text-sm font-mono text-muted-foreground">—</p></div>;
  const pos = pct >= 0;
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground font-mono">{label}</p>
      <p className={cn("text-sm font-bold font-mono flex items-center justify-center gap-1", pos ? "text-success" : "text-destructive")}>
        {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {pos ? "+" : ""}{pct.toFixed(2)}%
      </p>
    </div>
  );
}

function SecurityFlag({ label, value, dangerous }: { label: string; value: boolean | null; dangerous?: boolean }) {
  const isUnknown = value == null;
  const isBad = dangerous ? value === true : value === false;
  const isGood = dangerous ? value === false : value === true;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {isUnknown ? (
          <><HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" /><span className="text-xs font-mono text-muted-foreground/50">Unknown</span></>
        ) : isBad ? (
          <><XCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-xs font-mono text-destructive font-bold">{dangerous ? "YES ⚠" : "No"}</span></>
        ) : (
          <><CheckCircle className="h-3.5 w-3.5 text-success" /><span className="text-xs font-mono text-success">{dangerous ? "No" : "Yes"}</span></>
        )}
      </div>
    </div>
  );
}

function TaxBadge({ label, value }: { label: string; value: string | null }) {
  const pct = value ? parseFloat(value) : null;
  const warn = pct != null && pct > 5;
  const critical = pct != null && pct > 20;
  return (
    <div className="flex flex-col items-center p-3 rounded-lg border border-border/30 bg-muted/10">
      <p className="text-xs font-mono text-muted-foreground uppercase">{label}</p>
      <p className={cn("text-2xl font-bold font-mono mt-1", critical ? "text-destructive" : warn ? "text-yellow-400" : "text-success")}>
        {value ?? "?"}%
      </p>
    </div>
  );
}

function SecuritySummary({ sec, sourceLabel }: { sec: TokenSecurity; sourceLabel?: string }) {
  const RISK_LABELS = {
    low: { label: "LOW RISK", className: "text-success bg-success/10 border-success/30" },
    medium: { label: "MEDIUM RISK", className: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
    high: { label: "HIGH RISK", className: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
    critical: { label: "CRITICAL RISK", className: "text-destructive bg-destructive/10 border-destructive/30" },
    unknown: { label: "UNKNOWN", className: "text-muted-foreground bg-muted/10 border-border/30" },
  };
  const risk = RISK_LABELS[sec.overallRisk];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-card/50 border-border/40">
        <CardHeader className="pb-2 border-b border-border/20">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />SECURITY SCAN
            {sourceLabel && <SourceBadge source={sourceLabel} />}
            <Badge variant="outline" className={cn("ml-auto text-xs font-mono border", risk.className)}>{risk.label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <SecurityFlag label="Honeypot Detection" value={sec.isHoneypot} dangerous />
          <SecurityFlag label="Open Source / Verified" value={sec.isOpenSource} />
          <SecurityFlag label="Mintable" value={sec.isMintable} dangerous />
          <SecurityFlag label="Hidden Owner" value={sec.hasHiddenOwner} dangerous />
          <SecurityFlag label="Blacklist Function" value={sec.hasBlacklist} dangerous />
          <SecurityFlag label="Owner Can Take Back" value={sec.ownerCanTakeBack} dangerous />
          <SecurityFlag label="Cannot Sell All" value={sec.cannotSellAll} dangerous />
          <SecurityFlag label="Transfer Pausable" value={sec.transferPausable} dangerous />
          <SecurityFlag label="Proxy Contract" value={sec.isProxy} />
          <SecurityFlag label="Self-Destruct" value={sec.hasSelfDestruct} dangerous />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TaxBadge label="Buy Tax" value={sec.buyTax} />
          <TaxBadge label="Sell Tax" value={sec.sellTax} />
        </div>
        {(sec.ownerAddress || sec.creatorAddress) && (
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4 space-y-2">
              {sec.ownerAddress && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground">Owner</p>
                  <p className="text-xs font-mono break-all">{sec.ownerAddress}</p>
                </div>
              )}
              {sec.creatorAddress && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground">Creator</p>
                  <p className="text-xs font-mono break-all">{sec.creatorAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function TokenScanResults({ data, riskScore, summary, insights, risks, opportunities, confidenceScore, recommendations, target, fieldSources }: Props) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {data.imageUrl && (
          <img src={data.imageUrl} alt={data.symbol} className="h-10 w-10 rounded-full border border-border/30" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        )}
        <div>
          <h2 className="text-xl font-bold font-mono">{data.name || target} <span className="text-primary">({data.symbol || "?"})</span></h2>
          <div className="flex gap-2 mt-1">
            {data.chainId && <Badge variant="outline" className="text-xs font-mono capitalize">{data.chainId}</Badge>}
            {data.pairCreatedAt && <Badge variant="outline" className="text-xs font-mono text-muted-foreground">Listed {new Date(data.pairCreatedAt).toLocaleDateString()}</Badge>}
          </div>
        </div>
        <div className="flex gap-2 ml-auto flex-wrap items-center">
          {/* Deep-link to dedicated Token Research page */}
          {data.contractAddress && (
            <Link href={`/token/${data.contractAddress}${data.chainId ? `?chain=${data.chainId}` : ""}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs font-mono h-7 border-primary/30 hover:border-primary text-primary/70 hover:text-primary">
                <FlaskConical className="h-3.5 w-3.5" />Deep Research
              </Button>
            </Link>
          )}
          {data.websites.slice(0, 1).map((w) => (
            <a key={w} href={w} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-border/30 hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors">
              <Globe className="h-4 w-4" />
            </a>
          ))}
          {data.socials.slice(0, 2).map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-border/30 hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors text-xs font-mono capitalize">
              {s.type}
            </a>
          ))}
        </div>
      </div>

      {/* Honeypot critical alert */}
      {data.security.isHoneypot === true && (
        <Card className="border-destructive/60 bg-destructive/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div>
              <p className="font-bold text-destructive font-mono">🚨 HONEYPOT DETECTED</p>
              <p className="text-sm text-destructive/80 mt-0.5">This token has been flagged as a honeypot. Tokens cannot be sold once purchased. DO NOT BUY.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market data + risk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Price",      value: data.priceUsd != null ? `$${data.priceUsd}` : "—", sourceKey: "priceUsd" },
            { label: "Market Cap", value: fmtUsd(data.marketCapUsd, true),                   sourceKey: "marketCap" },
            { label: "FDV",        value: fmtUsd(data.fdvUsd, true),                         sourceKey: "fdvUsd" },
            { label: "Liquidity",  value: fmtUsd(data.liquidityUsd, true),                   sourceKey: "liquidityUsd" },
            { label: "24h Volume", value: fmtUsd(data.volumeH24, true),                      sourceKey: "volumeH24" },
            { label: "Holders",    value: data.holderCount?.toLocaleString() ?? "—",         sourceKey: "holderCount" },
          ].map(({ label, value, sourceKey }) => (
            <Card key={label} className="bg-card/50 border-border/40">
              <CardContent className="p-3">
                <p className="text-xs font-mono text-muted-foreground uppercase flex items-center">
                  {label}<SourceBadge source={fieldSources?.[sourceKey]} />
                </p>
                <p className="text-base font-bold font-mono mt-0.5">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {riskScore != null && (
          <Card className="bg-card/50 border-border/40 flex flex-col items-center justify-center p-4">
            <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">Risk Score</p>
            <RiskGauge score={riskScore} />
          </Card>
        )}
      </div>

      {/* Price changes */}
      {(data.priceChange1h != null || data.priceChange6h != null || data.priceChange24h != null) && (
        <Card className="bg-card/50 border-border/40">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
              <PriceChange pct={data.priceChange1h} label="1H" />
              <PriceChange pct={data.priceChange6h} label="6H" />
              <PriceChange pct={data.priceChange24h} label="24H" />
              {data.buys24h != null && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-mono">24H BUYS</p>
                  <p className="text-sm font-bold font-mono text-success">{data.buys24h.toLocaleString()}</p>
                </div>
              )}
              {data.sells24h != null && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-mono">24H SELLS</p>
                  <p className="text-sm font-bold font-mono text-destructive">{data.sells24h.toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security */}
      <SecuritySummary sec={data.security} sourceLabel={fieldSources?.honeypotCheck} />

      {/* Top holders */}
      {data.topHolders.length > 0 && (
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-2 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />TOP HOLDERS
              <SourceBadge source={fieldSources?.topHolders} />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topHolders.map((h, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 border-b border-border/20 last:border-0">
                <span className="text-xs text-muted-foreground/50 font-mono w-4">{i + 1}</span>
                <span className="text-xs font-mono flex-1">{shortAddr(h.address)}</span>
                {h.tag && <Badge variant="outline" className="text-xs font-mono">{h.tag}</Badge>}
                {h.isLocked && <Badge variant="outline" className="text-xs font-mono text-success border-success/30">🔒 Locked</Badge>}
                <div className="w-24 bg-muted/30 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, h.pct)}%` }} />
                </div>
                <span className="text-xs font-bold font-mono text-right w-12">{h.pct.toFixed(2)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* DEX pairs */}
      {data.dexPairs.length > 0 && (
        <Card className="bg-card/50 border-border/40">
          <CardHeader className="pb-2 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />DEX PAIRS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.dexPairs.map((p, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between border-b border-border/20 last:border-0">
                <span className="text-xs font-mono">{p.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">Liquidity: {p.liquidity}</span>
                  <a href={`https://dexscreener.com/ethereum/${p.pair}`} target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI analysis */}
      {summary && (
        <Card className="bg-card/50 border-border/50 scanline">
          <CardHeader className="pb-3 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />AI TOKEN ANALYSIS
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
