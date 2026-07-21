import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "./risk-gauge";
import { Shield, CheckCircle, XCircle, HelpCircle, AlertTriangle, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContractScanData, TokenSecurity } from "@/lib/scan-types";
import { shortAddr, riskColor } from "@/lib/scan-types";

interface Props {
  data: ContractScanData;
  riskScore: number | null;
  summary: string;
  insights: string[];
  recommendations: string[];
}

interface FlagRow {
  label: string;
  value: boolean | null;
  dangerous: boolean;
  description: string;
}

function Flag({ label, value, dangerous, description }: FlagRow) {
  const unknown = value == null;
  const isBad = dangerous ? value === true : false;
  const isGood = dangerous ? value === false : value === true;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/20 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        {unknown ? (
          <HelpCircle className="h-4 w-4 text-muted-foreground/50" />
        ) : isBad ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : (
          <CheckCircle className="h-4 w-4 text-success" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-mono font-medium">{label}</p>
          <span className={cn("text-xs font-mono font-bold",
            unknown ? "text-muted-foreground/50" : isBad ? "text-destructive" : "text-success")}>
            {unknown ? "UNKNOWN" : isBad ? (dangerous ? "DETECTED ⚠" : "NO") : (dangerous ? "CLEAR ✓" : "YES ✓")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

const SECURITY_FLAGS = (sec: TokenSecurity): FlagRow[] => [
  { label: "Source Code Verified", value: sec.isOpenSource, dangerous: false, description: "Contract source code is publicly verified on-chain explorer." },
  { label: "Honeypot", value: sec.isHoneypot, dangerous: true, description: "Tokens can be bought but not sold — a classic exit scam pattern." },
  { label: "Proxy / Upgradeable", value: sec.isProxy, dangerous: false, description: "Contract logic can be replaced after deployment." },
  { label: "Mintable Tokens", value: sec.isMintable, dangerous: true, description: "Owner can mint unlimited new tokens, diluting supply." },
  { label: "Hidden Owner", value: sec.hasHiddenOwner, dangerous: true, description: "Ownership is obfuscated — true controller is not publicly visible." },
  { label: "Blacklist Function", value: sec.hasBlacklist, dangerous: true, description: "Owner can prevent specific addresses from trading." },
  { label: "Owner Can Reclaim", value: sec.ownerCanTakeBack, dangerous: true, description: "Ownership was previously renounced but can be reclaimed." },
  { label: "Cannot Sell All", value: sec.cannotSellAll, dangerous: true, description: "Holders cannot sell their entire balance at once." },
  { label: "Transfer Pausable", value: sec.transferPausable, dangerous: true, description: "Owner can freeze all token transfers at any time." },
  { label: "Self-Destruct", value: sec.hasSelfDestruct, dangerous: true, description: "Contract contains self-destruct function — can be wiped by owner." },
];

export function ContractScanResults({ data, riskScore, summary, insights, recommendations }: Props) {
  const sec = data.security;
  const RISK_META = {
    low: { label: "LOW RISK", color: "text-success", bg: "bg-success/10 border-success/30" },
    medium: { label: "MEDIUM RISK", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
    high: { label: "HIGH RISK", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" },
    critical: { label: "CRITICAL RISK", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
    unknown: { label: "UNKNOWN", color: "text-muted-foreground", bg: "bg-muted/10 border-border/30" },
  };
  const risk = RISK_META[sec.overallRisk];
  const criticalFlags = SECURITY_FLAGS(sec).filter((f) => f.dangerous && f.value === true);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Critical alerts */}
      {criticalFlags.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-destructive font-mono">CRITICAL SECURITY FLAGS DETECTED</p>
              <ul className="mt-2 space-y-1">
                {criticalFlags.map((f) => (
                  <li key={f.label} className="text-xs text-destructive/80">⚠ {f.label}: {f.description}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Card className="bg-card/50 border-border/40 h-full">
            <CardHeader className="pb-3 border-b border-border/20">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-primary" />CONTRACT OVERVIEW
                <Badge variant="outline" className={cn("ml-auto text-xs font-mono border", risk.bg, risk.color)}>{risk.label}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
              {data.chainId && (
                <div><p className="text-xs font-mono text-muted-foreground">Chain</p><p className="text-sm font-mono capitalize">{data.chainId}</p></div>
              )}
              {data.ownerAddress && (
                <div><p className="text-xs font-mono text-muted-foreground">Owner</p><p className="text-xs font-mono break-all">{data.ownerAddress}</p></div>
              )}
              {data.totalSupply && (
                <div><p className="text-xs font-mono text-muted-foreground">Total Supply</p><p className="text-sm font-mono">{Number(data.totalSupply).toLocaleString()}</p></div>
              )}
              {data.holderCount != null && (
                <div><p className="text-xs font-mono text-muted-foreground">Holder Count</p><p className="text-sm font-mono">{data.holderCount.toLocaleString()}</p></div>
              )}
            </CardContent>
          </Card>
        </div>
        {riskScore != null && (
          <Card className="bg-card/50 border-border/40 flex flex-col items-center justify-center p-4">
            <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">Security Score</p>
            <RiskGauge score={riskScore} />
          </Card>
        )}
      </div>

      {/* Tax info */}
      {(sec.buyTax != null || sec.sellTax != null) && (
        <div className="grid grid-cols-2 gap-3">
          {[{ label: "Buy Tax", value: sec.buyTax }, { label: "Sell Tax", value: sec.sellTax }].map(({ label, value }) => {
            const pct = value ? parseFloat(value) : null;
            const warn = pct != null && pct > 5;
            const critical = pct != null && pct > 20;
            return (
              <Card key={label} className="bg-card/50 border-border/40">
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="text-xs font-mono text-muted-foreground uppercase">{label}</p>
                  <p className={cn("text-2xl font-bold font-mono", critical ? "text-destructive" : warn ? "text-yellow-400" : "text-success")}>
                    {value ?? "?"}%
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Security checklist */}
      <Card className="bg-card/50 border-border/40">
        <CardHeader className="pb-2 border-b border-border/20">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />SECURITY CHECKLIST
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {SECURITY_FLAGS(sec).map((f) => <Flag key={f.label} {...f} />)}
        </CardContent>
      </Card>

      {/* AI security report */}
      {summary && (
        <Card className="bg-card/50 border-border/50 scanline">
          <CardHeader className="pb-3 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />AI SECURITY REPORT
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm leading-relaxed">{summary}</p>
            {insights.length > 0 && (
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Security Findings</p>
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
