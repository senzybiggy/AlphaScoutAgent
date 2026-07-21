import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnalyzeInputType } from "@workspace/api-client-react";
import { Search, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  target: z.string().min(2, { message: "Target must be at least 2 characters." }),
  type: z.enum([AnalyzeInputType.wallet, AnalyzeInputType.token, AnalyzeInputType.contract, AnalyzeInputType.project]),
  chain: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AnalyzerFormProps {
  onSubmit: (data: FormValues) => void;
  isLoading: boolean;
}

const CHAINS = [
  { value: "ethereum", label: "Ethereum" },
  { value: "solana", label: "Solana" },
  { value: "base", label: "Base" },
  { value: "okx", label: "OKX X Layer" },
  { value: "arbitrum", label: "Arbitrum" },
];

export function AnalyzerForm({ onSubmit, isLoading }: AnalyzerFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      target: "",
      type: AnalyzeInputType.wallet,
      chain: "ethereum",
    },
  });

  const selectedType = form.watch("type");

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-1 glow-box">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Tabs
            value={selectedType}
            onValueChange={(val) => {
              form.setValue("type", val as any);
              form.setValue("target", ""); // Clear target when switching types
            }}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 w-full bg-background p-1">
              <TabsTrigger value={AnalyzeInputType.wallet} className="font-mono text-xs">WALLET</TabsTrigger>
              <TabsTrigger value={AnalyzeInputType.token} className="font-mono text-xs">TOKEN</TabsTrigger>
              <TabsTrigger value={AnalyzeInputType.contract} className="font-mono text-xs">CONTRACT</TabsTrigger>
              <TabsTrigger value={AnalyzeInputType.project} className="font-mono text-xs">PROJECT</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col sm:flex-row gap-3 p-3 pt-0">
            {selectedType !== AnalyzeInputType.project && (
              <div className="sm:w-[180px] shrink-0">
                <FormField
                  control={form.control}
                  name="chain"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-mono text-xs h-12 bg-background border-border/50">
                            <SelectValue placeholder="Select chain" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CHAINS.map((chain) => (
                            <SelectItem key={chain.value} value={chain.value} className="font-mono text-xs">
                              {chain.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="target"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input 
                        placeholder={
                          selectedType === 'project' ? "Enter project name (e.g., 'Uniswap')" : 
                          `Enter ${selectedType} address...`
                        } 
                        className="pl-10 h-12 font-mono text-sm bg-background border-border/50 focus-visible:ring-primary/50" 
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={isLoading}
              className="h-12 px-8 font-mono tracking-wide shrink-0 transition-all active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ANALYZING
                </>
              ) : (
                "SCAN TARGET"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
