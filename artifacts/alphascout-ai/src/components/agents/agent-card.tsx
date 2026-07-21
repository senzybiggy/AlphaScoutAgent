import { Agent } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, BarChart3, Search, Activity, Cpu, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: Agent;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  analysis: Search,
  trading: Activity,
  monitoring: BarChart3,
  research: Cpu,
  security: ShieldAlert,
};

export function AgentCard({ agent }: AgentCardProps) {
  const Icon = CATEGORY_ICONS[agent.category] || Bot;

  const isComingSoon = agent.status === "coming_soon";
  const isActive = agent.status === "active";
  const isBeta = agent.status === "beta";

  return (
    <Card className={cn(
      "flex flex-col bg-card/40 border-border/50 transition-all hover:border-primary/40 scanline group overflow-hidden relative",
      isComingSoon && "opacity-70 grayscale-[0.5] pointer-events-none"
    )}>
      {isComingSoon && (
        <div className="absolute inset-0 bg-background/50 z-10 flex flex-col items-center justify-center backdrop-blur-[1px]">
          <div className="bg-background/90 px-4 py-2 border border-border/50 rounded font-mono text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Deploying Soon
          </div>
        </div>
      )}
      
      <CardHeader className="pb-4 border-b border-border/10 relative z-0">
        <div className="flex justify-between items-start mb-2">
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          
          <Badge 
            variant="outline" 
            className={cn(
              "font-mono text-[10px] uppercase tracking-wider px-2 py-0.5",
              isActive && "bg-success/10 text-success border-success/30",
              isBeta && "bg-primary/10 text-primary border-primary/30",
              isComingSoon && "bg-muted text-muted-foreground border-border/50"
            )}
          >
            {agent.status.replace('_', ' ')}
          </Badge>
        </div>
        
        <h3 className="text-xl font-bold font-mono tracking-tight mt-2">{agent.name}</h3>
        <Badge variant="secondary" className="w-fit text-[10px] bg-secondary/50 uppercase">
          {agent.category}
        </Badge>
      </CardHeader>
      
      <CardContent className="pt-4 flex flex-col flex-1 relative z-0">
        <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">
          {agent.description}
        </p>
        
        <div className="space-y-3">
          <div className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest border-b border-border/20 pb-1 mb-2">
            Capabilities
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agent.capabilities.map((cap, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-background/50 border-border/40 font-normal px-2 rounded-sm text-foreground/80">
                {cap}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
