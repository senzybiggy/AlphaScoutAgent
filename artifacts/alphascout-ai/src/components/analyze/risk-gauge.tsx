import { cn } from "@/lib/utils";
import { Gauge } from "lucide-react";

interface RiskGaugeProps {
  score: number;
  className?: string;
}

export function RiskGauge({ score, className }: RiskGaugeProps) {
  // 0-30: Low (Success), 31-69: Medium (Warning/Yellow), 70-100: High (Destructive)
  let colorClass = "text-success";
  let bgClass = "bg-success/20";
  let label = "LOW RISK";

  if (score > 30 && score < 70) {
    colorClass = "text-yellow-500";
    bgClass = "bg-yellow-500/20";
    label = "MEDIUM RISK";
  } else if (score >= 70) {
    colorClass = "text-destructive";
    bgClass = "bg-destructive/20";
    label = "HIGH RISK";
  }

  // Calculate rotation for the gauge needle (-90deg to 90deg)
  const rotation = -90 + (score / 100) * 180;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-48 h-24 overflow-hidden mb-2">
        {/* Semi-circle background */}
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-secondary" />
        
        {/* Colored arc representing risk */}
        <div 
          className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-transparent"
          style={{
            borderTopColor: score > 30 ? (score >= 70 ? '#ef4444' : '#eab308') : '#00c982',
            borderRightColor: score > 30 ? (score >= 70 ? '#ef4444' : '#eab308') : '#00c982',
            transform: 'rotate(45deg)',
            clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)'
          }}
        />

        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-20 bg-foreground origin-bottom transition-transform duration-1000 ease-out z-10"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-foreground" />
        </div>
        
        {/* Center dot */}
        <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background border-2 border-foreground z-20" />
      </div>

      <div className={cn("text-4xl font-bold font-mono tracking-tighter", colorClass)}>
        {score}
      </div>
      <div className={cn("text-xs font-mono font-bold px-2 py-0.5 rounded mt-1", bgClass, colorClass)}>
        {label}
      </div>
    </div>
  );
}
