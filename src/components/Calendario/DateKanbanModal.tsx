import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputDialog } from "@/components/modals/InputDialog";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { Lembrete } from "@/types";

const COLUMNS = [
  { id: "todo", title: "A Fazer", color: "#9CA3AF" },
  { id: "doing", title: "Fazendo", color: "#F59E0B" },
  { id: "done", title: "Feito", color: "#10B981" },
];

export function DateKanbanModal({ date, onClose }: { date: Date | null; onClose: () => void }) {
  const { user } = useAuth();
  const { tasks, loading, addTask, updateTaskStatus, deleteTask } = useCalendarTasks(user?.id, date);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTaskCol, setNewTaskCol] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId), [tasks, activeId]);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;
    const overTask = tasks.find(t => t.id === overId);
    
    // Determine the target column: if dropped on a task, use its status, else use the column id
    const targetStatus = overTask ? (overTask.status || "todo") : overId;

    if (task.status !== targetStatus) {
      void updateTaskStatus(taskId, targetStatus);
    }
  };

  return (
    <>
      <Dialog open={!!date} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle className="text-xl">
              Tarefas: {date ? format(date, "PPP", { locale: ptBR }) : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 p-6 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCorners}
                onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
                onDragEnd={onDragEnd}
                onDragCancel={() => setActiveId(null)}
              >
                <div className="flex gap-4 h-full overflow-x-auto pb-2">
                  {COLUMNS.map((col) => (
                    <Column 
                      key={col.id} 
                      id={col.id}
                      title={col.title}
                      color={col.color}
                      tasks={tasks.filter(t => (t.status || "todo") === col.id)}
                      onAdd={() => setNewTaskCol(col.id)}
                      onDelete={(id) => void deleteTask(id)}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeTask && <TaskCard task={activeTask} dragging />}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <InputDialog 
        open={!!newTaskCol} 
        title="Nova tarefa" 
        label="Descrição"
        placeholder="Ex: Enviar relatório" 
        onCancel={() => setNewTaskCol(null)} 
        onConfirm={(v) => { 
          if (v.trim() && newTaskCol) void addTask(v.trim(), newTaskCol);
          setNewTaskCol(null);
        }} 
      />
    </>
  );
}

function Column({ id, title, color, tasks, onAdd, onDelete }: {
  id: string; title: string; color: string; tasks: Lembrete[];
  onAdd: () => void; onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useSortable({ id });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[280px] flex flex-col bg-muted/30 rounded-lg p-3 max-h-full",
        isOver && "ring-2 ring-primary bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[40px]">
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onDelete={() => onDelete(task.id)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTask({ task, onDelete }: { task: Lembrete; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition, 
    opacity: isDragging ? 0.4 : 1 
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onDelete={onDelete} />
    </div>
  );
}

function TaskCard({ task, onDelete, dragging }: { task: Lembrete; onDelete?: () => void; dragging?: boolean }) {
  return (
    <div className={cn(
      "bg-card border rounded-md p-3 shadow-sm flex items-start justify-between gap-2 group cursor-grab active:cursor-grabbing",
      dragging && "rotate-2 shadow-lg"
    )}>
      <span className="text-sm font-medium">{task.title}</span>
      {onDelete && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
