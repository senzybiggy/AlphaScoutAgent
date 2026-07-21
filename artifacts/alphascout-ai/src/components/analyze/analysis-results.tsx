import type { AnalyzeResult } from "@workspace/api-client-react";
import type { RichAnalyzeResult } from "@/lib/scan-types";
import { RiskGauge } from "./risk-gauge";
import { WalletScanResults } from "./wallet-scan-results";
import { TokenScanResults } from "./token-scan-results";
import { ContractScanResults } from "./contract-scan-results";
import { AICopilotPanel } from "./ai-copilot-panel";
import { ExportPanel } from "./export-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity, ShieldAlert, Cpu } from "lucide-react";
import { format } from "date-fns";

interface AnalysisResultsProps {
  result: AnalyzeResult;
}

const INSIGHTS_LABEL: Record<string, string> = {
  wallet: "AI INSIGHTS",
  token: "AI SUMMARY",
  contract: "AI EXPLANATION",
  project: "AI RECOMMENDATION",
};

function TrendIcon({ trend }: { trend: string | null | undefined }) {
  if (trend === "up") return <TrendingUp className="w-4 h-4 text-success ml-auto flex-shrink-0" />;
  if (trend === "down") return <TrendingDown className="w-4 h-4 text-destructive ml-auto flex-shrink-0" />;
  if (trend === "neutral") return <Minus className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0" />;
  return null;
}

/** Build a trimmed context string for the AI copilot (no huge image URLs or huge arrays). */
function buildCopilotContext(r: RichAnalyzeResult): string {
  const trimmed: Record<string, unknown> = {
    target: r.target,
    type: r.type,
    chain: r.chain,
    summary: r.summary,
    riskScore: r.riskScore,
    insights: r.insights,
    recommendations: r.recommendations,
    smartMoneyScore: r.smartMoneyScore,
    walletHealthScore: r.walletHealthScore,
    analyzedAt: r.analyzedAt,
  };

  if (r.walletScan) {
    const w = r.walletScan;
    trimmed.walletScan = {
      chain: w.chain,
      dataSource: w.dataSource,
      nativeBalance: w.nativeBalance,
      nativeSymbol: w.nativeSymbol,
      nativeBalanceUsd: w.nativeBalanceUsd,
      totalNetWorthUsd: w.totalNetWorthUsd,
      txCount: w.txCount,
      walletAgeDays: w.walletAgeDays,
      firstTxDate: w.firstTxDate,
      lastTxDate: w.lastTxDate,
      chainsUsed: w.chainsUsed,
      walletLabels: w.walletLabels,
      addressRiskLabels: w.addressRiskLabels,
      isSanctioned: w.isSanctioned,
      isMixer: w.isMixer,
      isScammer: w.isScammer,
      smartMoneyScore: w.smartMoneyScore,
      walletHealthScore: w.walletHealthScore,
      recommendations: w.recommendations,
      totalGasSpentNative: w.totalGasSpentNative,
      tokens: w.tokens.slice(0, 10).map((t) => ({
        symbol: t.symbol, name: t.name,
        balanceFormatted: t.balanceFormatted,
        usdValue: t.usdValue, portfolioPct: t.portfolioPct, change24h: t.change24h,
      })),
      nftCount: w.nfts.length,
      defiPositions: w.defiPositions.slice(0, 5),
      recentTransactions: w.recentTransactions.slice(0, 5).map((t) => ({
        category: t.category, summary: t.summary,
        valueFormatted: t.valueFormatted, timestamp: t.timestamp, status: t.status,
      })),
      topContracts: w.topContracts.slice(0, 5),
    };
  }

  if (r.tokenScan) {
    const t = r.tokenScan;
    trimmed.tokenScan = {
      symbol: t.symbol, name: t.name, chainId: t.chainId,
      contractAddress: t.contractAddress,
      priceUsd: t.priceUsd, priceChange24h: t.priceChange24h,
      marketCapUsd: t.marketCapUsd, fdvUsd: t.fdvUsd,
      liquidityUsd: t.liquidityUsd, volumeH24: t.volumeH24,
      buys24h: t.buys24h, sells24h: t.sells24h, holderCount: t.holderCount,
      security: t.security,
      topHolders: t.topHolders.slice(0, 5),
      recommendations: t.recommendations,
    };
  }

  if (r.contractScan) {
    trimmed.contractScan = r.contractScan;
  }

  return JSON.stringify(trimmed, null, 2);
}

export function AnalysisResults({ result }: AnalysisResultsProps) {
  const rich = result as unknown as RichAnalyzeResult;
  const insightsLabel = INSIGHTS_LABEL[result.type] ?? "AI INSIGHTS & VULNERABILITIES";

  const hasSections = Array.isArray((result as unknown as Record<string, unknown>).sections) &&
    ((result as unknown as { sections: unknown[] }).sections).length > 0;
  const sections = hasSections
    ? (result as unknown as { sections: { title: string; items: { label: string; value: string; trend: string | null }[] }[] }).sections
    : [];

  const hasWalletScan = Boolean(rich.walletScan);
  const hasTokenScan = Boolean(rich.tokenScan);
  const hasContractScan = Boolean(rich.contractScan);
  const hasRichScan = hasWalletScan || hasTokenScan || hasContractScan;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Scan header — target + timestamp + export */}
      <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-border/20">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-muted-foreground">
            <span className="text-muted-foreground/50">TARGET </span>
            <span className="text-foreground break-all">{result.target}</span>
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="font-mono text-xs uppercase bg-primary/5 text-primary border-primary/20">
              {result.type}{result.chain ? ` · ${result.chain}` : ""}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground/50">
              <Activity className="h-3 w-3 inline-block mr-1" />
              {format(new Date(result.analyzedAt), "yyyy-MM-dd HH:mm")}
            </span>
          </div>
        </div>
        <ExportPanel result={rich} />
      </div>

      {/* Rich type-specific view — wallet / token / contract */}
      {hasWalletScan && rich.walletScan && (
        <WalletScanResults
          data={rich.walletScan}
          riskScore={rich.riskScore ?? null}
          smartMoneyScore={rich.smartMoneyScore ?? null}
          walletHealthScore={rich.walletHealthScore ?? null}
          summary={rich.summary}
          insights={rich.insights}
          recommendations={rich.recommendations ?? []}
        />
      )}

      {hasTokenScan && rich.tokenScan && (
        <TokenScanResults
          data={rich.tokenScan}
          riskScore={rich.riskScore ?? null}
          summary={rich.summary}
          insights={rich.insights}
          recommendations={rich.recommendations ?? []}
          target={rich.target}
        />
      )}

      {hasContractScan && rich.contractScan && (
        <ContractScanResults
          data={rich.contractScan}
          riskScore={rich.riskScore ?? null}
          summary={rich.summary}
          insights={rich.insights}
          recommendations={rich.recommendations ?? []}
        />
      )}

      {/* Generic fallback view (project type or no real data) */}
      {!hasRichScan && (
        <>
          <div className="flex flex-col md:flex-row gap-6">
            <Card className="flex-1 bg-card/50 border-border/50 scanline">
              <CardHeader className="pb-3 border-b border-border/20">
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" />INTELLIGENCE REPORT
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-base leading-relaxed">{result.summary}</p>
              </CardContent>
            </Card>
            {result.riskScore !== null && (
              <Card className="md:w-[300px] bg-card/50 border-border/50 flex flex-col items-center justify-center p-6 scanline">
                <h3 className="text-sm font-mono text-muted-foreground mb-4 text-center">OVERALL RISK SCORE</h3>
                <RiskGauge score={result.riskScore} />
              </Card>
            )}
          </div>

          {hasSections && (
            <div className="space-y-6">
              {sections.map((section, si) => (
                <div key={si}>
                  <h3 className="text-sm font-mono text-muted-foreground mb-4 uppercase tracking-wider">{section.title}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {section.items.map((item, ii) => (
                      <Card key={ii} className="bg-card/30 border-border/30">
                        <CardContent className="p-4 flex flex-col items-start">
                          <span className="text-xs text-muted-foreground font-mono uppercase mb-1">{item.label}</span>
                          <div className="flex items-baseline gap-2 w-full mt-1">
                            <span className="text-sm font-bold font-mono break-words leading-snug flex-1 min-w-0">{item.value}</span>
                            <TrendIcon trend={item.trend} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasSections && result.metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {result.metrics.map((metric, i) => (
                <Card key={i} className="bg-card/30 border-border/30">
                  <CardContent className="p-4 flex flex-col items-start">
                    <span className="text-xs text-muted-foreground font-mono uppercase mb-1">{metric.label}</span>
                    <div className="flex items-baseline gap-2 w-full">
                      <span className="text-xl font-bold font-mono truncate">{metric.value}</span>
                      <TrendIcon trend={metric.trend} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.insights.length > 0 && (
            <Card className="bg-card/50 border-border/50 scanline">
              <CardHeader className="pb-3 border-b border-border/20">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary" />{insightsLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-3">
                  {result.insights.map((insight, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-primary mt-0.5 opacity-70">▹</span>
                      <span className="leading-relaxed">{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* AI Copilot — always shown after a successful scan */}
      <AICopilotPanel context={buildCopilotContext(rich)} target={result.target} />
    </div>
  );
}
