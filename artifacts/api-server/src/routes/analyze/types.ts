export interface AnalyzerInput {
  target: string;
  type: "wallet" | "token" | "contract" | "project";
  chain?: string;
}

export interface AnalyzerMetric {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral" | null;
}

export interface AnalyzerOutput {
  summary: string;
  riskScore: number;
  metrics: AnalyzerMetric[];
  insights: string[];
}

export interface Analyzer {
  systemPrompt(input: AnalyzerInput): string;
  userMessage(input: AnalyzerInput): string;
  /** Optional post-processing hook — mutate output in place if needed */
  postProcess?(output: AnalyzerOutput, input: AnalyzerInput): void;
}
