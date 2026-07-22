import { useState, useCallback } from "react";
import {
  AlertTriangle, CheckCircle, XCircle, HelpCircle, Loader2, RefreshCw,
  Activity, Shield, ChevronRight, ExternalLink, AlertOctagon, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { RichAnalyzeResult, TokenSecurity } from "@/lib/scan-types";
import { fmtUsd } from "@/lib/scan-types";
import { Link } from "wouter";

// ─── Rug Risk Scoring ────────────────────────────────────────────────────────

interface RiskFlag {
  key: keyof TokenSecurity;
  label: string;
  weight: number;  // points added to rugScore when flag is triggered
  dangerous: boolean;
  description: string;
}

const FLAGS: RiskFlag[] = [
  { key: "isHoneypot",      label: "Honeypot",                  weight: 40, dangerous: true,  description: "Tokens can be bought but not sold. Funds are permanently trapped." },
  { key: "hasHiddenOwner",  label: "Hidden Owner",              weight: 15, dangerous: true,  description: "Contract ownership is concealed, making it harder to assess control risk." },
  { key: "cannotSellAll",   label: "Cannot Sell All",           weight: 15, dangerous: true,  description: "Holders cannot sell their full balance in a single transaction." },
  { key: "transferPausable",label: "Transfer Pausable",         weight: 10, dangerous: true,  description: "Contract owner can pause all token transfers at any time." },
  { key: "ownerCanTakeBack",label: "Owner Can Reclaim Tokens",  weight: 10, dangerous: true,  description: "The contract owner has the ability to take back tokens from any wallet." },
  { key: "hasSelfDestruct", label: "Self-Destruct Function",    weight: 10, dangerous: true,  description: "Contract contains a self-destruct call that can wipe the contract." },
  { key: "hasBlacklist",    label: "Blacklist Function",        weight: 5,  dangerous: true,  description: "Owner can blacklist addresses and prevent them from trading." },
  { key: "isMintable",      label: "Mintable Supply",           weight: 5,  dangerous: true,  description: "New tokens can be minted at any time, diluting holder value." },
  { key: "isProxy",         label: "Proxy Contract",            weight: 2,  dangerous: false, description: "Logic can be upgraded by the owner. Not inherently risky but worth watching." },
  { key: "isOpenSource",    label: "Open Source / Verified",    weight: 0,  dangerous: false, description: "Source code is publicly verified on-chain." },
];

function computeRugScore(sec: TokenSecurity): number {
  let score = 0;
  for (const flag of FLAGS) {
    if (!flag.dangerous) continue;
    const val = sec[flag.key] as boolean | null;
    if (val === true) score += flag.weight;
  }
  // Tax penalty
  const buy = parseFloat(String(sec.buyTax ?? "0"));
  const sell = parseFloat(String(sec.sellTax ?? "0"));
  if (buy > 20 || sell > 20) score += 10;
  else if (buy > 10 || sell > 10) score += 5;
  return Math.min(100, score);
}

function getVerdict(score: number): { label: string; description: string; colorClass: string; icon: React.ElementType } {
  if (score >= 75) return { label: "CRITICAL", description: "Extremely high probability of a rug pull or scam. Do NOT interact.", colorClass: "text-destructive border-destructive/50 bg-destructive/10", icon: AlertOctagon };
  if (score >= 50) return { label: "HIGH RISK", description: "Serious red flags detected. Proceed only with extreme caution.", colorClass: "text-orange-400 border-orange-400/40 bg-orange-400/10", icon: AlertTriangle };
  if (score >= 25) return { label: "SUSPICIOUS", description: "Multiple risk vectors present. Research thoroughly before investing.", colorClass: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", icon: AlertTriangle };
  return { label: "LIKELY SAFE", description: "No major rug pull indicators detected. Always do your own research.", colorClass: "text-success border-success/40 bg-success/10", icon: CheckCircle };
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="ml-1 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono border border-primary/15 text-primary/50 bg-primary/5 leading-4">
      {source}
    </span>
  );
}

function FlagRow({ flag, sec, source }: { flag: RiskFlag; sec: TokenSecurity; source?: string }) {
  const val = sec[flag.key] as boolean | null;
  const isUnknown = val == null;
  const triggered = flag.dangerous ? val === true : val === false;
  const isSafe = flag.dangerous ? val === false : val === true;
  return (
    <div className={cn(
      "flex items-start gap-4 px-4 py-3 border-b border-border/20 last:border-0 transition-colors",
      triggered && "bg-destructive/5 hover:bg-destructive/8",
      !triggered && !isUnknown && "hover:bg-muted/5",
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {isUnknown
          ? <HelpCircle className="h-4 w-4 text-muted-foreground/40" />
          : triggered
            ? <XCircle className="h-4 w-4 text-destructive" />
            : <CheckCircle className="h-4 w-4 text-success" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn("text-xs font-mono font-bold", triggered ? "text-destructive" : isUnknown ? "text-muted-foreground/60" : "text-success")}>
            {flag.label}
          </p>
          {source && <SourceBadge source={source} />}
          {triggered && flag.weight > 0 && (
            <Badge variant="outline" className="text-[9px] font-mono text-destructive border-destructive/30 px-1 py-0">+{flag.weight}pts</Badge>
          )}
        </div>
        <p className="text-xs font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{flag.description}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        {isUnknown ? (
          <span className="text-xs font-mono text-muted-foreground/40">Unknown</span>
        ) : triggered ? (
          <span className="text-xs font-mono text-destructive font-bold">{flag.dangerous ? "DETECTED" : "NO"}</span>
        ) : (
          <span className="text-xs font-mono text-success">{flag.dangerous ? "CLEAR" : "YES"}</span>
        )}
      </div>
    </div>
  );
}

function TaxDisplay({ label, value, source }: { label: string; value: string | null; source?: string }) {
  const pct = value != null ? parseFloat(value) : null;
  const warn = pct != null && pct > 5;
  const critical = pct != null && pct > 20;
  return (
    <div className="flex flex-col items-center p-4 rounded-xl border border-border/30 bg-card/50">
      <p className="text-xs font-mono text-muted-foreground uppercase flex items-center">
        {label}<SourceBadge source={source} />
      </p>
      <p className={cn("text-3xl font-bold font-mono mt-2", critical ? "text-destructive" : warn ? "text-yellow-400" : "text-success")}>
        {value != null ? `${parseFloat(value).toFixed(1)}%` : "?"}
      </p>
      {pct != null && (
        <p className={cn("text-xs font-mono mt-1", critical ? "text-destructive/70" : warn ? "text-yellow-400/70" : "text-success/70")}>
          {critical ? "CRITICAL" : warn ? "HIGH" : "NORMAL"}
        </p>
      )}
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

export function RugPullDetector() {
  const [input, setInput] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RichAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (address: string, c = chain) => {
    if (!address.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await analyzeToken(address.trim(), c);
      setData(result);
      setInput(address.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [chain]);

  const token = data?.tokenScan;
  const fieldSources = data?.fieldSources ?? {};
  const rugScore = token ? computeRugScore(token.security) : null;
  const verdict = rugScore != null ? getVerdict(rugScore) : null;
  const VerdictIcon = verdict?.icon ?? Shield;

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
          <Shield className="h-8 w-8 text-primary" />RUG PULL DETECTOR
        </h1>
        <p className="text-muted-foreground">
          GoPlus security checklist for any EVM token. Instant risk verdict with plain-language explanations.
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
          {loading ? "Checking…" : "Check Rug Risk"}
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
            <p className="text-sm font-mono text-muted-foreground">Running GoPlus security scan…</p>
          </div>
        </div>
      )}

      {!loading && token && verdict && rugScore != null && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Token header */}
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              {token.imageUrl && (
                <img src={token.imageUrl} alt={token.symbol} className="h-10 w-10 rounded-full border border-border/30 flex-shrink-0"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold font-mono">{token.name || data!.target} <span className="text-primary">({token.symbol || "?"})</span></h2>
                <div className="flex flex-wrap gap-2 mt-1">
                  {token.chainId && <Badge variant="outline" className="text-xs font-mono capitalize">{token.chainId}</Badge>}
                  {token.contractAddress && (
                    <a href={`https://etherscan.io/address/${token.contractAddress}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3 w-3" />{token.contractAddress.slice(0, 12)}…
                    </a>
                  )}
                </div>
              </div>
              <Link href={`/analyze?target=${encodeURIComponent(data!.target)}&type=token&chain=${token.chainId ?? chain}`}>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono h-8 border-border/40 hover:border-primary/40">
                  <ChevronRight className="h-3.5 w-3.5" />Full Analysis
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* VERDICT + Score */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Verdict card */}
            <div className="md:col-span-2">
              <Card className={cn("border-2", verdict.colorClass)}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-xl border-2 flex-shrink-0", verdict.colorClass)}>
                      <VerdictIcon className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Rug Pull Verdict</p>
                      <p className={cn("text-2xl font-bold font-mono", verdict.colorClass.split(" ")[0])}>
                        {verdict.label}
                      </p>
                      <p className="text-sm font-mono text-muted-foreground mt-2 leading-relaxed">
                        {verdict.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/20">
                    <p className="text-xs font-mono text-muted-foreground/50 flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Security data sourced from <SourceBadge source={fieldSources.honeypotCheck ?? "GoPlus"} />. DYOR — no tool is 100% accurate.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Score meter */}
            <Card className="bg-card/50 border-border/40 flex flex-col items-center justify-center p-6">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Rug Risk Score</p>
              <div className="relative">
                <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeOpacity="0.3" />
                  <circle cx="60" cy="60" r="48" fill="none"
                    stroke={rugScore >= 75 ? "#ef4444" : rugScore >= 50 ? "#f97316" : rugScore >= 25 ? "#FBBF24" : "#10b981"}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(rugScore / 100) * 2 * Math.PI * 48} ${2 * Math.PI * 48}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn(
                    "text-3xl font-bold font-mono",
                    rugScore >= 75 ? "text-destructive" : rugScore >= 50 ? "text-orange-400" : rugScore >= 25 ? "text-yellow-400" : "text-success"
                  )}>
                    {rugScore}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="mt-3 w-full space-y-1">
                {[
                  { label: "0–24", desc: "Likely Safe", color: "text-success" },
                  { label: "25–49", desc: "Suspicious", color: "text-yellow-400" },
                  { label: "50–74", desc: "High Risk", color: "text-orange-400" },
                  { label: "75–100", desc: "Critical", color: "text-destructive" },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/40">{r.label}</span>
                    <span className={r.color}>{r.desc}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Tax display */}
          {(token.security.buyTax != null || token.security.sellTax != null) && (
            <div className="grid grid-cols-2 gap-4">
              <TaxDisplay label="Buy Tax" value={token.security.buyTax} source={fieldSources.honeypotCheck} />
              <TaxDisplay label="Sell Tax" value={token.security.sellTax} source={fieldSources.honeypotCheck} />
            </div>
          )}

          {/* Security flags checklist */}
          <Card className="bg-card/50 border-border/40">
            <CardHeader className="pb-2 border-b border-border/20">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />SECURITY CHECKLIST
                <SourceBadge source={fieldSources.honeypotCheck ?? "GoPlus"} />
                <span className="ml-auto text-xs font-mono text-muted-foreground">
                  {FLAGS.filter((f) => f.dangerous && (token.security[f.key] as boolean | null) === false).length}/{FLAGS.filter((f) => f.dangerous).length} checks passed
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {FLAGS.map((flag) => (
                <FlagRow key={String(flag.key)} flag={flag} sec={token.security} source={fieldSources.honeypotCheck} />
              ))}
            </CardContent>
          </Card>

          {/* Owner info */}
          {(token.security.ownerAddress || token.security.creatorAddress) && (
            <Card className="bg-card/50 border-border/40">
              <CardHeader className="pb-2 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />CONTRACT AUTHORITY
                  <SourceBadge source={fieldSources.honeypotCheck} />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {token.security.ownerAddress && (
                  <div>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Owner Address</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono break-all">{token.security.ownerAddress}</p>
                      <a href={`https://etherscan.io/address/${token.security.ownerAddress}`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground/40 hover:text-primary flex-shrink-0 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
                {token.security.creatorAddress && (
                  <div>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Creator Address</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono break-all">{token.security.creatorAddress}</p>
                      <a href={`https://etherscan.io/address/${token.security.creatorAddress}`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground/40 hover:text-primary flex-shrink-0 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Market data */}
          {(token.marketCapUsd || token.liquidityUsd || token.priceUsd) && (
            <Card className="bg-card/30 border-border/20">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-6">
                  {token.priceUsd != null && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">Price <SourceBadge source={fieldSources.priceUsd} /></p>
                      <p className="text-sm font-bold font-mono">${token.priceUsd}</p>
                    </div>
                  )}
                  {token.marketCapUsd != null && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">Market Cap <SourceBadge source={fieldSources.marketCap} /></p>
                      <p className="text-sm font-bold font-mono">{fmtUsd(token.marketCapUsd, true)}</p>
                    </div>
                  )}
                  {token.liquidityUsd != null && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">Liquidity <SourceBadge source={fieldSources.liquidityUsd} /></p>
                      <p className="text-sm font-bold font-mono">{fmtUsd(token.liquidityUsd, true)}</p>
                    </div>
                  )}
                  {token.holderCount != null && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">Holders <SourceBadge source={fieldSources.holderCount} /></p>
                      <p className="text-sm font-bold font-mono">{token.holderCount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && token && rugScore === null && (
        <Alert className="bg-muted/10 border-border/30">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="font-mono text-xs text-muted-foreground">
            GoPlus returned no security data for this address. The token may be on an unsupported chain or not yet indexed.
          </AlertDescription>
        </Alert>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center space-y-3 opacity-40">
          <Shield className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">ENTER A TOKEN CONTRACT ADDRESS TO CHECK RUG PULL RISK</p>
          <p className="text-xs font-mono text-muted-foreground/60">Powered by GoPlus Security · Free · No API key required</p>
        </div>
      )}
    </div>
  );
}
