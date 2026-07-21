import { useState } from "react";
import { useAnalyzeTarget } from "@workspace/api-client-react";
import { AnalyzerForm } from "@/components/analyze/analyzer-form";
import { AnalysisResults } from "@/components/analyze/analysis-results";
import { TerminalSquare, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function Analyze() {
  const analyzeTarget = useAnalyzeTarget();

  const handleSubmit = (data: { target: string; type: any; chain?: string }) => {
    analyzeTarget.mutate({
      data: {
        target: data.target,
        type: data.type,
        chain: data.chain === "project" ? undefined : data.chain
      }
    });
  };

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-2">
          <TerminalSquare className="h-8 w-8 text-primary" />
          ANALYSIS TERMINAL
        </h1>
        <p className="text-muted-foreground">
          Deploy deep-scan modules on any on-chain entity to retrieve risk profiles, fundamental metrics, and AI-driven insights.
        </p>
      </div>

      <div className="mb-10">
        <AnalyzerForm 
          onSubmit={handleSubmit} 
          isLoading={analyzeTarget.isPending} 
        />
      </div>

      <div className="min-h-[400px]">
        {analyzeTarget.isError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive mb-6 animate-in fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription className="font-mono text-xs mt-2">
              {analyzeTarget.error?.message || "An unexpected error occurred during analysis. Please try again."}
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
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 bg-card/40 border border-border/20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 bg-card/40 border border-border/20 rounded-xl" />
          </div>
        )}

        {!analyzeTarget.isPending && analyzeTarget.data && (
          <AnalysisResults result={analyzeTarget.data} />
        )}

        {!analyzeTarget.isPending && !analyzeTarget.data && !analyzeTarget.isError && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 border border-dashed border-border/30 rounded-xl p-12 bg-background/50">
            <TerminalSquare className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-mono text-sm tracking-widest uppercase">AWAITING TARGET INPUT</p>
          </div>
        )}
      </div>
    </div>
  );
}
