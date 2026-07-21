import { useState } from "react";
import { TerminalSquare, AlertCircle, Clock, ChevronRight } from "lucide-react";
import { useAnalyzeTarget, type AnalyzeResult } from "@workspace/api-client-react";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { SmartInput } from "@/components/analyze/smart-input";
import { AnalysisResults } from "@/components/analyze/analysis-results";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DetectionResult } from "@/lib/detect-input-type";
import type { RichAnalyzeResult } from "@/lib/scan-types";
import { Link } from "wouter";

const SCAN_STAGES = [
  "Connecting to blockchain nodes...",
  "Fetching on-chain data...",
  "Running security analysis...",
  "Generating AI intelligence report...",
  "Compiling results...",
];

function ScanProgress() {
  const [stage] = useState(() => Math.floor(Math.random() * SCAN_STAGES.length));
  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Status bar */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 font-mono text-sm">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
        <span className="text-primary">{SCAN_STAGES[stage]}</span>
      </div>
      {/* Skeleton cards */}
      <div className="flex flex-col md:flex-row gap-6">
        <Skeleton className="h-48 flex-1 bg-card/40 border border-border/20 rounded-xl" />
        <Skeleton className="h-48 w-full md:w-[320px] bg-card/40 border border-border/20 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 bg-card/40 border border-border/20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 bg-card/40 border border-border/20 rounded-xl" />
    </div>
  );
}

export function Analyze() {
  const analyzeTarget = useAnalyzeTarget();
  const [lastResult, setLastResult] = useState<AnalyzeResult | null>(null);

  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const connectedAddress = isConnected && address ? address : undefined;
  const connectedNetwork = caipNetwork?.name ?? undefined;

  const handleSubmit = (value: string, detection: DetectionResult) => {
    const type = detection.type === "unknown" ? "wallet" : detection.type;
    setLastResult(null);
    analyzeTarget.mutate(
      {
        data: {
          target: value,
          type: type as "wallet" | "token" | "contract" | "project",
          chain: detection.chain ?? undefined,
        },
      },
      { onSuccess: (result) => setLastResult(result) },
    );
  };

  const errorMessage = (() => {
    if (!analyzeTarget.isError) return null;
    const err = analyzeTarget.error as unknown as { data?: { error?: string }; message?: string };
    return err?.data?.error ?? err?.message ?? "An unexpected error occurred. Please try again.";
  })();

  const rich = lastResult as unknown as RichAnalyzeResult | null;
  const hasMoralisKey = rich?.walletScan?.dataSource === "moralis";
  const isLimitedMode = rich?.walletScan?.dataSource === "limited";

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
            <TerminalSquare className="h-8 w-8 text-primary" />
            ANALYSIS TERMINAL
          </h1>
          <p className="text-muted-foreground">
            Real on-chain intelligence — wallet portfolios, token security, contract audits, and project research.
          </p>
        </div>
        <Link href="/history">
          <button className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors border border-border/30 hover:border-primary/30 rounded-lg px-3 py-1.5">
            <Clock className="h-3.5 w-3.5" />
            SCAN HISTORY
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </Link>
      </div>

      {/* Data source badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: "GoPlus Security", free: true },
          { label: "DexScreener", free: true },
          { label: "Blockstream BTC", free: true },
          { label: "Moralis", free: false, active: Boolean(process?.env) },
        ].map((s) => (
          <Badge key={s.label} variant="outline" className="text-xs font-mono border-border/30 text-muted-foreground gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${s.free ? "bg-success" : "bg-yellow-400"}`} />
            {s.label}
            {s.free ? "" : " (key req.)"}
          </Badge>
        ))}
      </div>

      {/* Smart input */}
      <div className="mb-10">
        <SmartInput
          onSubmit={handleSubmit}
          isLoading={analyzeTarget.isPending}
          connectedAddress={connectedAddress}
          connectedNetwork={connectedNetwork}
        />
      </div>

      {/* Results area */}
      <div className="min-h-[400px]">
        {analyzeTarget.isError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive mb-6 animate-in fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription className="font-mono text-xs mt-2">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {analyzeTarget.isPending && <ScanProgress />}

        {!analyzeTarget.isPending && lastResult && (
          <>
            {/* Limited data notice */}
            {isLimitedMode && (
              <Alert className="bg-yellow-400/5 border-yellow-400/20 mb-6">
                <AlertTitle className="text-yellow-400 font-mono text-xs">LIMITED DATA MODE</AlertTitle>
                <AlertDescription className="text-xs font-mono mt-1">
                  Token balances, NFTs, and transaction history require a <span className="text-yellow-400">MORALIS_API_KEY</span>.
                  GoPlus security scan + AI analysis are still active.
                </AlertDescription>
              </Alert>
            )}
            <AnalysisResults result={lastResult} />
          </>
        )}

        {!analyzeTarget.isPending && !lastResult && !analyzeTarget.isError && (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 opacity-40">
            <TerminalSquare className="h-12 w-12 text-primary" />
            <p className="font-mono text-sm text-muted-foreground">
              AWAITING TARGET · ENTER ADDRESS OR CONNECT WALLET TO BEGIN
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
