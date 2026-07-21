import { AnalyzeResult } from "@workspace/api-client-react";
import { RiskGauge } from "./risk-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity, ShieldAlert, Cpu } from "lucide-react";
import { format } from "date-fns";

interface AnalysisResultsProps {
  result: AnalyzeResult;
}

export function AnalysisResults({ result }: AnalysisResultsProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main Summary Card */}
        <Card className="flex-1 bg-card/50 border-border/50 scanline">
          <CardHeader className="pb-3 border-b border-border/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-mono flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                INTELLIGENCE REPORT
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs uppercase bg-primary/5 text-primary border-primary/20">
                {result.type} {result.chain ? `• ${result.chain}` : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground font-mono mb-4 break-all bg-muted/30 p-2 rounded border border-border/50">
              TARGET: <span className="text-foreground">{result.target}</span>
            </p>
            <p className="text-base leading-relaxed">{result.summary}</p>
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Activity className="w-4 h-4" />
              ANALYZED AT {format(new Date(result.analyzedAt), "yyyy-MM-dd HH:mm:ss 'UTC'")}
            </div>
          </CardContent>
        </Card>

        {/* Risk Score Card */}
        {result.riskScore !== null && (
          <Card className="md:w-[320px] bg-card/50 border-border/50 flex flex-col items-center justify-center p-6 scanline">
            <h3 className="text-sm font-mono text-muted-foreground mb-6 w-full text-center">OVERALL RISK SCORE</h3>
            <RiskGauge score={result.riskScore} />
          </Card>
        )}
      </div>

      {/* Metrics Grid */}
      {result.metrics.length > 0 && (
        <div>
          <h3 className="text-sm font-mono text-muted-foreground mb-4">KEY METRICS</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {result.metrics.map((metric, i) => (
              <Card key={i} className="bg-card/30 border-border/30">
                <CardContent className="p-4 flex flex-col items-start">
                  <span className="text-xs text-muted-foreground font-mono uppercase mb-1">{metric.label}</span>
                  <div className="flex items-baseline gap-2 w-full">
                    <span className="text-xl font-bold font-mono truncate">{metric.value}</span>
                    {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-success ml-auto flex-shrink-0" />}
                    {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-destructive ml-auto flex-shrink-0" />}
                    {metric.trend === 'neutral' && <Minus className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0" />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Insights List */}
      {result.insights.length > 0 && (
        <Card className="bg-card/50 border-border/50 scanline">
          <CardHeader className="pb-3 border-b border-border/20">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              AI INSIGHTS & VULNERABILITIES
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
    </div>
  );
}
