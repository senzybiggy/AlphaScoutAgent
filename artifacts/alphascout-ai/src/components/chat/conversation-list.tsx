import { AnthropicConversation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ConversationListProps {
  conversations: AnthropicConversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreateNew: () => void;
  onDelete: (id: number) => void;
  isCreating: boolean;
  isDeleting: number | null;
}

export function ConversationList({ 
  conversations, 
  activeId, 
  onSelect, 
  onCreateNew, 
  onDelete,
  isCreating,
  isDeleting
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full bg-card/30 border-r border-border/50">
      <div className="p-4 border-b border-border/20">
        <Button 
          onClick={onCreateNew} 
          disabled={isCreating}
          className="w-full justify-start gap-2 font-mono"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          NEW COMM LINK
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors text-sm font-mono",
                activeId === conv.id 
                  ? "bg-primary/10 text-primary hover:bg-primary/20" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              onClick={() => onSelect(conv.id)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare className={cn("w-4 h-4 shrink-0", activeId === conv.id ? "text-primary" : "text-muted-foreground/50")} />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate">{conv.title || "Untitled"}</span>
                  <span className="text-[10px] opacity-50">
                    {format(new Date(conv.createdAt), "MMM dd, HH:mm")}
                  </span>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0 hover:bg-destructive/20 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                disabled={isDeleting === conv.id}
              >
                {isDeleting === conv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </Button>
            </div>
          ))}
          
          {conversations.length === 0 && (
            <div className="text-center p-4 text-xs font-mono text-muted-foreground/50 mt-10 uppercase tracking-widest">
              No active links
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
