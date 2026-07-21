import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Clock, ChevronRight, Wallet, Coins, FileCode2, Globe, TerminalSquare, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RichAnalyzeResult } from "@/lib/scan-types";
import { AnalysisResults } from "@/components/analyze/analysis-results";
import type { AnalyzeResult } from "@workspace/api-client-react";

interface HistoryEntry {
  id: number;
  target: string;
  type: string;
  chain: string | null;
  scannedAt: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  wallet: Wallet,
  token: Coins,
  contract: FileCode2,
  project: Globe,
};

const TYPE_COLORS: Record<string, string> = {
  wallet: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  token: "text-purple-400 border-purple-400/30 bg-purple-400/5",
  contract: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  project: "text-green-400 border-green-400/30 bg-green-400/5",
};

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1_000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

async function fetchHistory(): Promise<HistoryEntry[]> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze/history`);
  if (!r.ok) return [];
  return r.json();
}

async function fetchHistoryItem(id: number): Promise<RichAnalyzeResult | null> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const r = await fetch(`${base}/api/analyze/history/${id}`);
  if (!r.ok) return null;
  const row = await r.json() as { result: RichAnalyzeResult };
  return row.result;
}

export function History() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<RichAnalyzeResult | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);

  useEffect(() => {
    fetchHistory()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const openEntry = async (id: number) => {
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedResult(null);
      return;
    }
    setSelectedId(id);
    setLoadingItem(true);
    try {
      const item = await fetchHistoryItem(id);
      setSelectedResult(item);
    } finally {
      setLoadingItem(false);
    }
  };

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
            <Clock className="h-8 w-8 text-primary" />
            SCAN HISTORY
          </h1>
          <p className="text-muted-foreground">
            Your recent on-chain intelligence scans. Click any entry to review the full report.
          </p>
        </div>
        <Link href="/analyze">
          <Button variant="outline" size="sm" className="gap-2 font-mono text-xs border-border/40 hover:border-primary/40">
            <TerminalSquare className="h-3.5 w-3.5" />
            NEW SCAN
          </Button>
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 opacity-40">
          <Clock className="h-12 w-12 text-primary" />
          <p className="font-mono text-sm text-muted-foreground">
            NO SCAN HISTORY YET · RUN YOUR FIRST ANALYSIS
          </p>
          <Link href="/analyze">
            <Button variant="outline" size="sm" className="font-mono text-xs">START SCANNING</Button>
          </Link>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => {
            const Icon = TYPE_ICONS[entry.type] ?? Globe;
            const colorClass = TYPE_COLORS[entry.type] ?? "text-muted-foreground border-border/30 bg-muted/5";
            const isOpen = selectedId === entry.id;

            return (
              <div key={entry.id} className="rounded-xl border border-border/30 overflow-hidden">
                <button
                  onClick={() => openEntry(entry.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 text-left hover:bg-muted/10 transition-colors",
                    isOpen && "bg-muted/10 border-b border-border/20",
                  )}
                >
                  <div className={cn("p-2 rounded-lg border", colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-bold truncate">{entry.target}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={cn("text-xs font-mono border capitalize", colorClass)}>
                        {entry.type}
                      </Badge>
                      {entry.chain && (
                        <span className="text-xs font-mono text-muted-foreground capitalize">{entry.chain}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono text-muted-foreground">{timeAgo(entry.scannedAt)}</p>
                    <p className="text-xs text-muted-foreground/50">{new Date(entry.scannedAt).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                </button>

                {isOpen && (
                  <div className="p-4 pt-0 space-y-4">
                    {loadingItem && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                        <span className="text-sm font-mono text-muted-foreground">Loading report...</span>
                      </div>
                    )}
                    {!loadingItem && selectedResult && (
                      <div className="pt-4">
                        <AnalysisResults result={selectedResult as unknown as AnalyzeResult} />
                      </div>
                    )}
                    {!loadingItem && !selectedResult && (
                      <div className="flex items-center gap-2 py-4 text-sm font-mono text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        Failed to load report
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
