import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Database, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RichAnalyzeResult } from "@/lib/scan-types";

interface Props {
  result: RichAnalyzeResult;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getSourceLabel(source: string): string {
  const map: Record<string, string> = {
    moralis: "Moralis",
    ankr: "Ankr API",
    rpc: "Public RPC",
    "solana-rpc": "Solana RPC",
    blockstream: "Blockstream",
    dexscreener: "DexScreener",
    goplus: "GoPlus Security",
    limited: "Limited (no key)",
    "project-fetch": "URL Fetch",
    "coingecko": "CoinGecko",
  };
  return map[source] ?? source;
}

function getSources(result: RichAnalyzeResult): string[] {
  const sources: string[] = [];
  if (result.walletScan?.dataSource) sources.push(getSourceLabel(result.walletScan.dataSource));
  if (result.tokenScan?.dataSource) sources.push(getSourceLabel(result.tokenScan.dataSource));
  if (result.contractScan?.dataSource) sources.push(getSourceLabel(result.contractScan.dataSource));
  if (result.projectScan?.dataSource) sources.push(getSourceLabel(result.projectScan.dataSource));
  // Always includes AI + GoPlus for analysis
  if (!sources.some(s => s.includes("GoPlus"))) sources.push("GoPlus Security");
  sources.push("Claude AI");
  return [...new Set(sources)];
}

function getFetchedAt(result: RichAnalyzeResult): string | null {
  return (
    result.walletScan?.fetchedAt ??
    result.tokenScan?.fetchedAt ??
    result.contractScan?.fetchedAt ??
    result.projectScan?.fetchedAt ??
    null
  );
}

function confidenceColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-yellow-400";
  return "text-orange-400";
}

export function ConfidencePanel({ result }: Props) {
  const confidence = result.confidenceScore;
  const fetchedAt = getFetchedAt(result);
  const sources = getSources(result);
  const analyzedAt = result.analyzedAt;

  return (
    <Card className="bg-card/30 border-border/20">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* Confidence score */}
          {confidence != null && (
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn("h-3.5 w-3.5", confidenceColor(confidence))} />
              <span className="text-xs font-mono text-muted-foreground">Confidence</span>
              <span className={cn("text-xs font-bold font-mono", confidenceColor(confidence))}>
                {confidence}%
              </span>
            </div>
          )}

          {/* Data freshness */}
          {fetchedAt && (
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-xs font-mono text-muted-foreground">Data fetched</span>
              <span className="text-xs font-mono text-foreground/80">{timeAgo(fetchedAt)}</span>
            </div>
          )}

          {/* Last analyzed */}
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs font-mono text-muted-foreground">Analyzed</span>
            <span className="text-xs font-mono text-foreground/80">{timeAgo(analyzedAt)}</span>
          </div>

          {/* Sources */}
          <div className="flex items-center gap-2 flex-wrap">
            <Database className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
            <span className="text-xs font-mono text-muted-foreground">Sources</span>
            <div className="flex flex-wrap gap-1">
              {sources.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px] font-mono h-4 px-1.5 border-border/30 text-muted-foreground/70">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
