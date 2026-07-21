import { useState } from "react";
import { TerminalSquare } from "lucide-react";
import { SmartInput } from "@/components/analyze/smart-input";
import { AnalysisResults } from "@/components/analyze/analysis-results";
import { DetectionResult } from "@/lib/detect-input-type";
import { buildPlaceholderResult, PlaceholderResult } from "@/lib/placeholder-analysis";
import { Skeleton } from "@/components/ui/skeleton";

export function Analyze() {
  const [result, setResult] = useState<PlaceholderResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (value: string, detection: DetectionResult) => {
    setResult(null);
    setIsLoading(true);

    // Simulate a short analysis delay so the loading state feels real
    setTimeout(() => {
      const placeholder = buildPlaceholderResult(
        value,
        detection.type === "unknown" ? "wallet" : detection.type,
        detection.chain,
      );
      setResult(placeholder);
      setIsLoading(false);
    }, 1400);
  };

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
        <SmartInput onSubmit={handleSubmit} isLoading={isLoading} />
      </div>

      {/* Results area */}
      <div className="min-h-[400px]">
        {isLoading && (
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

        {!isLoading && result && (
          <AnalysisResults result={result} />
        )}

        {!isLoading && !result && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 border border-dashed border-border/30 rounded-xl p-12 bg-background/50">
            <TerminalSquare className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-mono text-sm tracking-widest uppercase">AWAITING TARGET INPUT</p>
          </div>
        )}
      </div>
    </div>
  );
}
