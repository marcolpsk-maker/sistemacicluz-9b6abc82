import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputDialog } from "@/components/modals/InputDialog";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  pointerWithin, rectIntersection,
  type DragEndEvent, type DragStartEvent, type DragOverEvent, type CollisionDetection,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { Lembrete } from "@/types";
import { toast } from "sonner";

const COLUMNS = [
  { id: "todo", title: "A Fazer", color: "#94a3b8" },
  { id: "doing", title: "Em Andamento", color: "#3b82f6" },
  { id: "alter", title: "Alteração", color: "#f59e0b" },
  { id: "done", title: "Finalizado", color: "#10b981" },
];

export function DateKanbanModal({ date, onClose }: { date: Date | null; onClose: () => void }) {
  const { user } = useAuth();
  const { tasks, loading, addTask, updateTaskStatus, deleteTask, updateTaskTitle } = useCalendarTasks(user?.id, date);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTaskCol, setNewTaskCol] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Lembrete | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId), [tasks, activeId]);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine target status. If dropped over a column, it's the column id.
    // If dropped over another task, it's that task's status.
    const overColumn = COLUMNS.find(c => c.id === overId);
    const overTask = tasks.find(t => t.id === overId);
    
    const targetStatus = overColumn ? overColumn.id : (overTask ? overTask.status : null);

    if (targetStatus && taskId !== overId) {
      void updateTaskStatus(taskId, targetStatus);
    }
  };

  return (
    <>
      <Dialog open={!!date} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 border-none bg-[#F4F5F7] dark:bg-background shadow-2xl overflow-hidden rounded-[32px]">
          <DialogHeader className="p-8 pb-4 shrink-0 bg-white/80 dark:bg-card/80 backdrop-blur-md border-b border-black/5">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight text-[#172B4D] dark:text-foreground">
                  Quadro Diário Cicluz
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider">
                    {date ? format(date, "EEEE, d 'de' MMMM", { locale: ptBR }) : ""}
                  </p>
                </div>
              </div>
              <Button onClick={() => setNewTaskCol("todo")} className="rounded-full shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" /> Nova Meta
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 p-6 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCorners}
                onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
                onDragEnd={onDragEnd}
                onDragCancel={() => setActiveId(null)}
              >
                <div className="flex gap-6 h-full overflow-x-auto pb-4 custom-scrollbar">
                  {COLUMNS.map((col) => (
                    <Column 
                      key={col.id} 
                      id={col.id}
                      title={col.title}
                      color={col.color}
                      tasks={tasks.filter(t => (t.status || "todo") === col.id)}
                      onAdd={() => setNewTaskCol(col.id)}
                      onEdit={setEditingTask}
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
        title="Nova Meta" 
        label="O que precisa ser feito?"
        placeholder="Descreva o objetivo..." 
        onCancel={() => setNewTaskCol(null)} 
        onConfirm={(v) => { 
          if (v.trim() && newTaskCol) void addTask(v.trim(), newTaskCol);
          setNewTaskCol(null);
        }} 
      />

      <InputDialog 
        open={!!editingTask} 
        title="Editar Meta" 
        label="Título da meta"
        initialValue={editingTask?.title}
        onCancel={() => setEditingTask(null)} 
        onConfirm={(v) => { 
          if (v.trim() && editingTask) void updateTaskTitle(editingTask.id, v.trim());
          setEditingTask(null);
        }} 
      />
    </>
  );
}

function Column({ id, title, color, tasks, onAdd, onDelete, onEdit }: {
  id: string; title: string; color: string; tasks: Lembrete[];
  onAdd: () => void; onDelete: (id: string) => void; onEdit: (t: Lembrete) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[280px] flex flex-col bg-[#EBEDF0] dark:bg-muted/10 rounded-2xl p-4 max-h-full transition-all duration-200 border-2 border-transparent",
        isOver && "bg-primary/5 border-primary/20 shadow-inner"
      )}
    >
      <div className="flex items-center justify-between mb-4 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ background: color }} />
          <h3 className="font-black text-[12px] uppercase tracking-widest text-[#44546F] dark:text-muted-foreground">{title}</h3>
          <span className="text-[10px] bg-white/80 dark:bg-black/20 px-2 py-0.5 rounded-full font-black shadow-sm">{tasks.length}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/50 rounded-full" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[100px] custom-scrollbar">
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onDelete={() => onDelete(task.id)} onEdit={() => onEdit(task)} />
          ))}
        </div>
      </SortableContext>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className="mt-4 justify-start shrink-0 text-[#44546F] hover:bg-white/50 font-bold rounded-xl h-10 border border-transparent hover:border-black/5" 
        onClick={onAdd}
      >
        <Plus className="h-4 w-4 mr-2" /> Adicionar Meta
      </Button>
    </div>
  );
}

function SortableTask({ task, onDelete, onEdit }: { task: Lembrete; onDelete: () => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { 
    transform: CSS.Translate.toString(transform), 
    transition, 
    opacity: isDragging ? 0.5 : 1 
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onDelete={onDelete} onEdit={onEdit} />
    </div>
  );
}

function TaskCard({ task, onDelete, onEdit, dragging }: { task: Lembrete; onDelete?: () => void; onEdit?: () => void; dragging?: boolean }) {
  return (
    <div className={cn(
      "bg-white dark:bg-card border-none rounded-xl p-4 shadow-sm flex flex-col gap-3 group cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-1 transition-all duration-200 ring-1 ring-black/5",
      dragging && "rotate-2 shadow-2xl scale-105 ring-primary/20 ring-4"
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-bold text-[#172B4D] dark:text-foreground leading-tight">{task.title}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 bg-black/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary/20 w-1/3" />
        </div>
        <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-tighter">Cicluz Task</span>
      </div>
    </div>
  );
}

