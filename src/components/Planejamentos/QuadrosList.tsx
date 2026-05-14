import type { KanbanBoard } from "@/types";
import { Layout, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

interface QuadrosListProps {
  boards: KanbanBoard[];
  onSelect: (id: string) => void;
  onNew: () => void;
  getTaskCount?: (boardId: string) => number;
}

export function QuadrosList({ boards, onSelect, onNew, getTaskCount }: QuadrosListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {boards.map((b) => (
        <Card 
          key={b.id} 
          className="p-6 cursor-pointer hover:shadow-md transition-all flex flex-col gap-4 border-l-4"
          style={{ borderLeftColor: b.color || "#4F46E5" }}
          onClick={() => onSelect(b.id)}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md flex items-center justify-center bg-muted shrink-0">
              <Layout className="h-5 w-5" style={{ color: b.color || "#4F46E5" }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate">{b.name}</h3>
              {getTaskCount && <p className="text-sm text-muted-foreground truncate">{getTaskCount(b.id)} tarefas</p>}
            </div>
          </div>
        </Card>
      ))}
      <Card 
        className="p-6 cursor-pointer hover:shadow-md transition-all flex flex-col items-center justify-center text-muted-foreground hover:text-primary gap-2 min-h-[120px] border-dashed"
        onClick={onNew}
      >
        <Plus className="h-6 w-6" />
        <span className="font-medium">Novo Quadro</span>
      </Card>
    </div>
  );
}
