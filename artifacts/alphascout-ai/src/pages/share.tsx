import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Activity, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AnalysisResults } from "@/components/analyze/analysis-results";
import type { AnalyzeResult } from "@workspace/api-client-react";

async function fetchSharedReport(token: string): Promise<{ result: AnalyzeResult; createdAt: string }> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/share/${token}`);
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Not found");
  }
  return r.json();
}

export function ShareView() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ result: AnalyzeResult; createdAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Invalid share link"); setLoading(false); return; }
    fetchSharedReport(token)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/20">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold tracking-tight text-base">
              AlphaScout <span className="text-primary font-mono">AI</span>
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs font-mono text-muted-foreground">
              Shared {new Date(data.createdAt).toLocaleDateString()}
            </span>
          )}
          <Link href="/analyze">
            <Button variant="outline" size="sm" className="gap-2 font-mono text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              Open AlphaScout
            </Button>
          </Link>
        </div>
      </div>

      {/* Shared report banner */}
      <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs font-mono text-primary/80">
        <Activity className="h-3.5 w-3.5 flex-shrink-0" />
        This is a shared AlphaScout AI analysis report. It expires after 30 days.
      </div>

      {/* States */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-mono text-sm">Loading shared report…</p>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-mono text-xs">
            {error}
            <br />
            <Link href="/analyze" className="underline mt-1 inline-block">Run a new analysis →</Link>
          </AlertDescription>
        </Alert>
      )}

      {!loading && data && (
        <AnalysisResults result={data.result} readOnly />
      )}
    </div>
  );
}
