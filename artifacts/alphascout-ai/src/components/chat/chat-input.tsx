import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-4xl relative">
        <div className="relative flex items-end gap-2 bg-card border border-border/50 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 transition-shadow shadow-sm">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Initialize comm link... (Shift+Enter for newline)"
            className="min-h-[44px] max-h-[200px] resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent py-3 font-mono text-sm"
            disabled={disabled}
          />
          <Button
            size="icon"
            disabled={!input.trim() || disabled}
            onClick={handleSubmit}
            className="h-10 w-10 shrink-0 mb-1 mr-1"
          >
            <SendHorizontal className="w-5 h-5" />
          </Button>
        </div>
        <div className="text-center mt-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          AlphaScout AI can make mistakes. Verify critical intelligence.
        </div>
      </div>
    </div>
  );
}
