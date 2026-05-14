import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanSquare, Plus, Trash2, MoreVertical, Loader2, Calendar as CalIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { KanbanCard as KCard, KanbanCategory, Priority } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { InputDialog } from "@/components/modals/InputDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kanban")({ component: KanbanPage });

const PRIO_LABEL: Record<Priority, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const PRIO_CLASS: Record<Priority, string> = {
  low: "bg-secondary-light text-secondary",
  medium: "bg-accent-light text-accent-foreground",
  high: "bg-destructive-light text-destructive",
};

function KanbanPage() {
  const { user } = useAuth();
  const [cats, setCats] = useState<KanbanCategory[]>([]);
  const [cards, setCards] = useState<KCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ card?: KCard; categoryId: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ type: "card" | "category"; id: string } | null>(null);
  const [newCat, setNewCat] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: c }, { data: k }] = await Promise.all([
        supabase.from("kanban_categories").select("*").order("order"),
        supabase.from("kanban_cards").select("*").order("order"),
      ]);
      if (!active) return;
      if (c) setCats(c);
      if (k) setCards(k);
      setLoading(false);
    })();
    const ch = supabase.channel("kanban-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_categories" }, async () => {
        const { data } = await supabase.from("kanban_categories").select("*").order("order");
        if (data) setCats(data);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards" }, async () => {
        const { data } = await supabase.from("kanban_cards").select("*").order("order");
        if (data) setCards(data);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  const cardsByCat = useMemo(() => {
    const m: Record<string, KCard[]> = {};
    for (const cat of cats) m[cat.id] = [];
    for (const c of cards) (m[c.category_id] ||= []).push(c);
    return m;
  }, [cards, cats]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const card = cards.find((c) => c.id === active.id);
    if (!card) return;
    const overId = over.id as string;
    const overCard = cards.find((c) => c.id === overId);
    const targetCatId = overCard ? overCard.category_id : overId;
    if (!targetCatId) return;
    if (card.category_id === targetCatId && card.id === overId) return;
    // optimistic update
    setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, category_id: targetCatId } : c));
    const { error } = await supabase.from("kanban_cards")
      .update({ category_id: targetCatId }).eq("id", card.id);
    if (error) toast.error("Erro ao mover card");
  };

  const createCategory = async (name: string) => {
    if (!user || !name.trim()) return;
    const order = cats.length;
    const { error } = await supabase.from("kanban_categories")
      .insert({ user_id: user.id, name: name.trim(), order, color: "#4F46E5" });
    if (error) return toast.error("Erro ao criar coluna");
    toast.success("Coluna criada");
    setNewCat(false);
  };

  const deleteEntity = async () => {
    if (!confirmDel) return;
    const table = confirmDel.type === "card" ? "kanban_cards" : "kanban_categories";
    await supabase.from(table).delete().eq("id", confirmDel.id);
    toast.success("Removido");
    setConfirmDel(null);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2"><KanbanSquare className="h-7 w-7" /> Kanban</h1>
          <p className="text-muted-foreground text-sm mt-1">{cards.length} cards · {cats.length} colunas</p>
        </div>
        <Button onClick={() => setNewCat(true)}><Plus className="h-4 w-4 mr-2" />Nova coluna</Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
          {cats.map((cat) => (
            <Column key={cat.id} category={cat} cards={cardsByCat[cat.id] || []}
              onAddCard={() => setEditing({ categoryId: cat.id })}
              onEditCard={(card) => setEditing({ card, categoryId: card.category_id })}
              onDeleteCard={(id) => setConfirmDel({ type: "card", id })}
              onDeleteCat={() => setConfirmDel({ type: "category", id: cat.id })} />
          ))}
        </div>
        <DragOverlay>
          {activeCard && <CardItem card={activeCard} dragging />}
        </DragOverlay>
      </DndContext>

      {editing && (
        <CardDialog open key={editing.card?.id ?? "new"}
          card={editing.card} categoryId={editing.categoryId} userId={user!.id}
          onClose={() => setEditing(null)} />
      )}

      <InputDialog open={newCat} title="Nova coluna" label="Nome da coluna"
        placeholder="Ex: Em Revisão" onCancel={() => setNewCat(false)} onConfirm={(v) => { void createCategory(v); }} />

      <ConfirmDialog open={!!confirmDel} variant="danger"
        title={confirmDel?.type === "card" ? "Excluir card?" : "Excluir coluna?"}
        message={confirmDel?.type === "category"
          ? "Todos os cards desta coluna também serão excluídos."
          : "Esta ação não pode ser desfeita."}
        onConfirm={deleteEntity} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

function Column({ category, cards, onAddCard, onEditCard, onDeleteCard, onDeleteCat }: {
  category: KanbanCategory; cards: KCard[];
  onAddCard: () => void;
  onEditCard: (c: KCard) => void;
  onDeleteCard: (id: string) => void;
  onDeleteCat: () => void;
}) {
  const { setNodeRef, isOver } = useSortable({ id: category.id });
  return (
    <div ref={setNodeRef}
      className={cn("w-80 shrink-0 bg-muted/40 rounded-lg p-3 flex flex-col",
        isOver && "ring-2 ring-primary")}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color || "#4F46E5" }} />
          <h3 className="text-sm font-semibold">{category.name}</h3>
          <span className="text-xs text-muted-foreground">{cards.length}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDeleteCat} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Excluir coluna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1 min-h-[40px]">
          {cards.map((c) => (
            <SortableCard key={c.id} card={c}
              onClick={() => onEditCard(c)}
              onDelete={() => onDeleteCard(c.id)} />
          ))}
        </div>
      </SortableContext>
      <Button variant="ghost" size="sm" className="mt-2 justify-start" onClick={onAddCard}>
        <Plus className="h-4 w-4 mr-2" />Adicionar card
      </Button>
    </div>
  );
}

function SortableCard({ card, onClick, onDelete }: {
  card: KCard; onClick: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardItem card={card} onClick={onClick} onDelete={onDelete} />
    </div>
  );
}

function CardItem({ card, onClick, onDelete, dragging }: {
  card: KCard; onClick?: () => void; onDelete?: () => void; dragging?: boolean;
}) {
  const prio = (card.priority as Priority) || "medium";
  return (
    <Card className={cn("p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
      dragging && "rotate-2 shadow-lg")}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm flex-1" onClick={onClick}>{card.title}</p>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {card.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.description}</p>}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", PRIO_CLASS[prio])}>
          {PRIO_LABEL[prio]}
        </Badge>
        {card.due_date && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CalIcon className="h-3 w-3" />
            {format(new Date(card.due_date), "dd MMM", { locale: ptBR })}
          </span>
        )}
      </div>
    </Card>
  );
}

function CardDialog({ open, card, categoryId, userId, onClose }: {
  open: boolean; card?: KCard; categoryId: string; userId: string; onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: card?.title || "",
    description: card?.description || "",
    priority: (card?.priority as Priority) || "medium",
    due_date: card?.due_date ? new Date(card.due_date).toISOString().slice(0, 16) : "",
  });

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    };
    if (card) {
      const { error } = await supabase.from("kanban_cards").update(payload).eq("id", card.id);
      if (error) return toast.error("Erro ao salvar");
      toast.success("Card atualizado");
    } else {
      const { error } = await supabase.from("kanban_cards")
        .insert({ ...payload, user_id: userId, category_id: categoryId });
      if (error) return toast.error("Erro ao criar");
      toast.success("Card criado");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{card ? "Editar card" : "Novo card"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="datetime-local" value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!form.title.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
