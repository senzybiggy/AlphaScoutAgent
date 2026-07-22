import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Waves, Building2, Sparkles, Moon, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WalletScanData } from "@/lib/scan-types";

interface Signal {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  detected: boolean | null; // null = insufficient data
  severity: "positive" | "warning" | "danger" | "neutral";
}

function detectSignals(data: WalletScanData): Signal[] {
  const netWorth = data.totalNetWorthUsd ?? 0;
  const ageDays = data.walletAgeDays;
  const daysSinceLast = data.lastTxDate
    ? Math.floor((Date.now() - new Date(data.lastTxDate).getTime()) / 86_400_000)
    : null;
  const labels = data.walletLabels.map((l) => l.toLowerCase());
  const isExchange = labels.some((l) =>
    ["exchange", "cex", "binance", "coinbase", "kraken", "okx", "bybit", "kucoin", "huobi"].some((x) =>
      l.includes(x),
    ),
  );
  const isSuspicious =
    data.isSanctioned || data.isMixer || data.isScammer || data.addressRiskLabels.length > 0;

  return [
    {
      id: "whale",
      label: "Whale",
      description:
        netWorth > 0
          ? netWorth >= 1_000_000
            ? `Portfolio ≥ $1M ($${(netWorth / 1_000_000).toFixed(1)}M)`
            : `Portfolio $${(netWorth / 1_000).toFixed(0)}K — below $1M threshold`
          : "Portfolio value unavailable",
      icon: Waves,
      detected: netWorth > 0 ? netWorth >= 1_000_000 : null,
      severity: "positive",
    },
    {
      id: "smart_money",
      label: "Smart Money",
      description:
        data.smartMoneyScore != null
          ? data.smartMoneyScore >= 70
            ? `Score ${data.smartMoneyScore}/100 — consistent profitable behaviour`
            : `Score ${data.smartMoneyScore}/100 — below threshold`
          : "Insufficient trade history to score",
      icon: Brain,
      detected: data.smartMoneyScore != null ? data.smartMoneyScore >= 70 : null,
      severity: "positive",
    },
    {
      id: "exchange",
      label: "Exchange Deposit",
      description: isExchange
        ? `Labelled: ${data.walletLabels.slice(0, 3).join(", ")}`
        : data.walletLabels.length > 0
          ? `Labels: ${data.walletLabels.join(", ")} — no exchange pattern`
          : "No exchange deposit label detected",
      icon: Building2,
      detected: data.walletLabels.length > 0 ? isExchange : null,
      severity: "warning",
    },
    {
      id: "fresh",
      label: "Fresh Wallet",
      description:
        ageDays != null
          ? ageDays < 30
            ? `Wallet is only ${ageDays} day${ageDays !== 1 ? "s" : ""} old`
            : `${ageDays} days old — established wallet`
          : "Wallet age unavailable",
      icon: Sparkles,
      detected: ageDays != null ? ageDays < 30 : null,
      severity: "warning",
    },
    {
      id: "dormant",
      label: "Dormant",
      description:
        daysSinceLast != null
          ? daysSinceLast >= 365
            ? `No activity for ${Math.floor(daysSinceLast / 30)} months`
            : `Last active ${daysSinceLast}d ago`
          : "Last transaction date unavailable",
      icon: Moon,
      detected: daysSinceLast != null ? daysSinceLast >= 365 : null,
      severity: "neutral",
    },
    {
      id: "suspicious",
      label: "Suspicious",
      description: isSuspicious
        ? [
            data.isSanctioned && "Sanctioned address",
            data.isMixer && "Mixer activity detected",
            data.isScammer && "Scam/phishing history",
            ...data.addressRiskLabels.slice(0, 2),
          ]
            .filter(Boolean)
            .join(" · ")
        : "No suspicious flags detected",
      icon: AlertTriangle,
      detected: isSuspicious,
      severity: "danger",
    },
  ];
}

const SEVERITY_DETECTED: Record<Signal["severity"], string> = {
  positive: "border-success/30 bg-success/5 text-success",
  warning: "border-yellow-400/30 bg-yellow-400/5 text-yellow-400",
  danger: "border-destructive/40 bg-destructive/5 text-destructive",
  neutral: "border-blue-400/30 bg-blue-400/5 text-blue-400",
};
const IDLE = "border-border/20 bg-transparent text-muted-foreground/40";

export function WalletIntelligence({ data }: { data: WalletScanData }) {
  const signals = detectSignals(data);
  const detectedCount = signals.filter((s) => s.detected === true).length;

  return (
    <Card className="bg-card/50 border-border/40">
      <CardHeader className="pb-2 border-b border-border/20">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          WALLET INTELLIGENCE
          {detectedCount > 0 && (
            <Badge
              variant="outline"
              className="ml-auto text-xs font-mono border-primary/30 text-primary bg-primary/5"
            >
              {detectedCount} signal{detectedCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {signals.map((sig) => {
            const Icon = sig.icon;
            const isUnknown = sig.detected === null;
            const isDetected = sig.detected === true;
            const color = isUnknown ? IDLE : isDetected ? SEVERITY_DETECTED[sig.severity] : IDLE;

            return (
              <div
                key={sig.id}
                className={cn(
                  "flex items-start gap-2.5 p-3 rounded-xl border transition-colors",
                  color,
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isUnknown ? (
                    <HelpCircle className="h-4 w-4 opacity-40" />
                  ) : isDetected ? (
                    <Icon className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground/30" />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-bold font-mono",
                      isUnknown || !isDetected
                        ? "text-muted-foreground/40"
                        : "",
                    )}
                  >
                    {sig.label}
                    {isDetected && (
                      <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-70">
                        ▲
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] font-mono leading-relaxed mt-0.5 opacity-60 line-clamp-2">
                    {sig.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
