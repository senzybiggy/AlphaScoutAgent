import { AnthropicMessage } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { TerminalSquare, User } from "lucide-react";

interface MessageBubbleProps {
  message: Pick<AnthropicMessage, "role" | "content">;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn(
      "flex w-full group py-6",
      isAssistant ? "bg-card/20 border-y border-border/10" : ""
    )}>
      <div className="container px-4 md:px-8 mx-auto max-w-4xl flex gap-6">
        <div className="shrink-0 mt-1">
          {isAssistant ? (
            <div className="w-8 h-8 rounded bg-primary/20 border border-primary/30 flex items-center justify-center glow-box">
              <TerminalSquare className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center border border-border/50">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
        
        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="font-mono text-xs font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
            {isAssistant ? "ALPHASCOUT AI" : "OPERATOR"}
            {isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          
          <div className="text-sm md:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
