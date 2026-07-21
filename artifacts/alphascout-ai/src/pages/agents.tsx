import { useState } from "react";
import { useListAgents, getListAgentsQueryKey } from "@workspace/api-client-react";
import { AgentCard } from "@/components/agents/agent-card";
import { Cpu, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["all", "analysis", "trading", "monitoring", "research", "security"];

export function Agents() {
  const [activeCategory, setActiveCategory] = useState("all");
  
  const { data: agents, isLoading, isError } = useListAgents({ 
    query: { queryKey: getListAgentsQueryKey() } 
  });

  const filteredAgents = agents?.filter(
    agent => activeCategory === "all" || agent.category === activeCategory
  );

  return (
    <div className="container px-4 md:px-8 py-8 mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 border-b border-border/30 pb-8">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-3 glow-text mb-3">
            <Cpu className="h-8 w-8 text-primary" />
            AGENT REGISTRY
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg">
            Deploy specialized autonomous models for on-chain execution, monitoring, and deep fundamental analysis.
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded bg-card border border-border/50">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          {agents?.filter(a => a.status === 'active').length || 0} AGENTS ONLINE
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex items-center gap-2 mr-2 text-muted-foreground/70 shrink-0">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-wider">Filter:</span>
        </div>
        {CATEGORIES.map(category => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(category)}
            className="uppercase font-mono tracking-wider text-xs h-8 shrink-0 rounded-full"
          >
            {category}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 bg-card/40 border border-border/20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-20 text-center border border-dashed border-destructive/30 rounded-xl bg-destructive/5 text-destructive font-mono">
          FAILED TO LOAD AGENT REGISTRY. PLEASE RETRY.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents?.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {!isLoading && filteredAgents?.length === 0 && (
        <div className="py-20 text-center border border-dashed border-border/30 rounded-xl bg-card/20 text-muted-foreground font-mono">
          NO AGENTS FOUND FOR CATEGORY: {activeCategory.toUpperCase()}
        </div>
      )}
    </div>
  );
}
