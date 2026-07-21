import { useState } from "react";
import { TerminalSquare, AlertCircle } from "lucide-react";
import { useAnalyzeTarget, type AnalyzeResult } from "@workspace/api-client-react";
import { SmartInput } from "@/components/analyze/smart-input";
import { AnalysisResults } from "@/components/analyze/analysis-results";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DetectionResult } from "@/lib/detect-input-type";

export function Analyze() {
  const analyzeTarget = useAnalyzeTarget();
  const [lastResult, setLastResult] = useState<AnalyzeResult | null>(null);

  const handleSubmit = (value: string, detection: DetectionResult) => {
    const type =
      detection.type === "unknown" ? "wallet" : detection.type;

    setLastResult(null);
    analyzeTarget.mutate(
      {
        data: {
          target: value,
          type: type as "wallet" | "token" | "contract" | "project",
          chain: detection.chain ?? undefined,
        },
      },
      {
        onSuccess: (result) => setLastResult(result),
      },
    );
  };

  const errorMessage = (() => {
    if (!analyzeTarget.isError) return null;
    const err = analyzeTarget.error as unknown as { data?: { error?: string }; message?: string };
    return err?.data?.error ?? err?.message ?? "An unexpected error occurred. Please try again.";
  })();

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
          <TerminalSquare className="h-8 w-8 text-primary" />
          ANALYSIS TERMINAL
        </h1>
        <p className="text-muted-foreground">
          Paste any wallet address, token contract, smart contract, or project URL.
          AlphaScout auto-detects the target type and runs a deep-scan intelligence report.
        </p>
      </div>

      {/* Single smart input */}
      <div className="mb-10">
        <SmartInput onSubmit={handleSubmit} isLoading={analyzeTarget.isPending} />
      </div>

      {/* Results area */}
      <div className="min-h-[400px]">
        {analyzeTarget.isError && (
          <Alert
            variant="destructive"
            className="bg-destructive/10 border-destructive/20 text-destructive mb-6 animate-in fade-in"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription className="font-mono text-xs mt-2">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {analyzeTarget.isPending && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row gap-6">
              <Skeleton className="h-48 flex-1 bg-card/40 border border-border/20 rounded-xl" />
              <Skeleton className="h-48 w-full md:w-[320px] bg-card/40 border border-border/20 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 bg-card/40 border border-border/20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 bg-card/40 border border-border/20 rounded-xl" />
          </div>
        )}

        {!analyzeTarget.isPending && lastResult && (
          <AnalysisResults result={lastResult} />
        )}

        {!analyzeTarget.isPending && !lastResult && !analyzeTarget.isError && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 border border-dashed border-border/30 rounded-xl p-12 bg-background/50">
            <TerminalSquare className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-mono text-sm tracking-widest uppercase">AWAITING TARGET INPUT</p>
          </div>
        )}
      </div>
    </div>
  );
}
