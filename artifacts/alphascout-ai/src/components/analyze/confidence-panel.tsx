import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Database, ShieldCheck, Zap, ChevronDown, ChevronUp, CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RichAnalyzeResult, ProviderAttempt } from "@/lib/scan-types";

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

function getFetchedAt(result: RichAnalyzeResult): string | null {
  return (
    result.walletScan?.fetchedAt ??
    result.tokenScan?.fetchedAt ??
    result.contractScan?.fetchedAt ??
    result.projectScan?.fetchedAt ??
    null
  );
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <span className={cn("text-lg font-bold font-mono tabular-nums", color)}>{score}%</span>
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider text-center">{label}</span>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-destructive";
}

function ProviderRow({ attempt }: { attempt: ProviderAttempt }) {
  const icon =
    attempt.status === "success" ? <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" /> :
    attempt.status === "skipped" ? <MinusCircle className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" /> :
    <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />;

  return (
    <div className="flex items-start gap-2 py-1 text-xs font-mono border-b border-border/10 last:border-0">
      <span className="mt-0.5">{icon}</span>
      <span className={cn(
        "flex-1 min-w-0",
        attempt.status === "success" ? "text-foreground/80" :
        attempt.status === "skipped" ? "text-muted-foreground/40" :
        "text-muted-foreground/60"
      )}>
        <span className="font-semibold">{attempt.provider}</span>
        <span className="text-muted-foreground/50 mx-1">·</span>
        <span className="text-muted-foreground/50">{attempt.category}</span>
        {attempt.latencyMs > 0 && (
          <span className="text-muted-foreground/40 ml-1">({attempt.latencyMs}ms)</span>
        )}
        {attempt.status !== "success" && attempt.error && (
          <span className="block text-muted-foreground/50 mt-0.5 truncate max-w-[280px]" title={attempt.error}>
            {attempt.error}
          </span>
        )}
      </span>
      <Badge
        variant="outline"
        className={cn(
          "text-[9px] h-4 px-1 flex-shrink-0",
          attempt.status === "success" ? "border-success/30 text-success/70 bg-success/5" :
          attempt.status === "skipped" ? "border-border/20 text-muted-foreground/40" :
          "border-destructive/30 text-destructive/70 bg-destructive/5"
        )}
      >
        {attempt.status}
      </Badge>
    </div>
  );
}

export function ConfidencePanel({ result }: Props) {
  const [expanded, setExpanded] = useState(false);

  const confidence     = result.confidenceScore;
  const dataQuality    = result.dataQualityScore ?? 0;
  const reliability    = result.reliabilityScore ?? 0;
  const fetchedAt      = getFetchedAt(result);
  const analyzedAt     = result.analyzedAt;
  const attempts       = result.providerAttempts ?? [];
  const fieldSources   = result.fieldSources ?? {};

  const successCount = attempts.filter((a) => a.status === "success").length;
  const failCount    = attempts.filter((a) => a.status === "failed").length;
  const skipCount    = attempts.filter((a) => a.status === "skipped").length;

  const uniqueSucceeded = [...new Set(
    attempts.filter((a) => a.status === "success").map((a) => a.provider)
  )];

  const hasIssues = failCount > 0 || skipCount > 0;

  return (
    <Card className={cn(
      "border-border/20",
      result.isDataUnavailable ? "bg-destructive/5 border-destructive/20" : "bg-card/30",
    )}>
      <CardContent className="p-3 space-y-2">
        {/* Main row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* Three scores */}
          <div className="flex items-center gap-4 border-r border-border/20 pr-5">
            {confidence != null && (
              <ScoreRing score={confidence} label="AI Conf" color={scoreColor(confidence)} />
            )}
            <ScoreRing score={dataQuality} label="Data Quality" color={scoreColor(dataQuality)} />
            <ScoreRing score={reliability} label="Reliability" color={scoreColor(reliability)} />
          </div>

          {/* Data freshness */}
          {fetchedAt && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-xs font-mono text-muted-foreground">Fetched</span>
              <span className="text-xs font-mono text-foreground/80">{timeAgo(fetchedAt)}</span>
            </div>
          )}

          {/* Last analyzed */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs font-mono text-muted-foreground">Analyzed</span>
            <span className="text-xs font-mono text-foreground/80">{timeAgo(analyzedAt)}</span>
          </div>

          {/* Source badges */}
          {uniqueSucceeded.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Database className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {uniqueSucceeded.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] font-mono h-4 px-1.5 border-success/20 text-success/70 bg-success/5">
                    ✓ {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Provider issues indicator */}
          {hasIssues && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              <AlertTriangle className={cn(
                "h-3.5 w-3.5",
                failCount > 0 ? "text-destructive/70" : "text-muted-foreground/50"
              )} />
              {failCount > 0 && <span className="text-destructive/70">{failCount} failed</span>}
              {skipCount > 0 && <span className="text-muted-foreground/50">{failCount > 0 ? "," : ""} {skipCount} skipped</span>}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          {/* Claude AI always shown */}
          <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5 border-primary/20 text-primary/60 bg-primary/5">
            Claude AI
          </Badge>
        </div>

        {/* Field sources summary (compact) */}
        {Object.keys(fieldSources).length > 0 && !expanded && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-border/10">
            {Object.entries(fieldSources).map(([field, src]) => (
              <span key={field} className="text-[10px] font-mono text-muted-foreground/50">
                <span className="text-muted-foreground/30">{field}:</span> [{src}]
              </span>
            ))}
          </div>
        )}

        {/* Expandable provider log */}
        {expanded && attempts.length > 0 && (
          <div className="pt-2 border-t border-border/20 space-y-0.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
              Provider Attempt Log ({successCount} succeeded, {failCount} failed, {skipCount} skipped)
            </p>
            {attempts.map((a, i) => (
              <ProviderRow key={i} attempt={a} />
            ))}
          </div>
        )}

        {/* Show expand button even when no issues if there are attempts */}
        {!hasIssues && attempts.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Show"} provider log ({attempts.length} attempts)
          </button>
        )}
      </CardContent>
    </Card>
  );
}
