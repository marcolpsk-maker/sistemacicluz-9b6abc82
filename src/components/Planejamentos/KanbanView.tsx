import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  useDroppable, closestCorners, pointerWithin, rectIntersection,
  type DragEndEvent, type DragStartEvent, type DragOverEvent, type CollisionDetection,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, MoreVertical, Loader2, Calendar as CalIcon, X, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { KanbanCard as KCard, KanbanCategory, KanbanBoard, Priority } from "@/types";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { InputDialog } from "@/components/modals/InputDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRIO_LABEL: Record<Priority, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const PRIO_CLASS: Record<Priority, string> = {
  low: "bg-secondary-light text-secondary",
  medium: "bg-accent-light text-accent-foreground",
  high: "bg-destructive-light text-destructive",
};

const COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#EF4444", "#8B5CF6", "#9CA3AF"];

export function KanbanView({ board, onDelete }: { board: KanbanBoard; onDelete: () => void }) {
  const { user } = useAuth();
  const [cats, setCats] = useState<KanbanCategory[]>([]);
  const [cards, setCards] = useState<KCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ card?: KCard; categoryId: string } | null>(null);
  const [editingCat, setEditingCat] = useState<KanbanCategory | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ type: "card" | "category" | "board"; id: string } | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [renameBoard, setRenameBoard] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // Custom collision: prefer pointer-within (cards), fall back to rect-intersection (empty columns)
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    return rectIntersection(args);
  };

  useEffect(() => {
    if (!user || !board) return;
    setLoading(true);
    let active = true;
    (async () => {
      const { data: c } = await supabase.from("kanban_categories").select("*").eq("board_id", board.id).order("order");
      if (!active) return;
      const catList = c || [];
      setCats(catList);
      const catIds = catList.map((x) => x.id);
      if (catIds.length) {
        const { data: k } = await supabase.from("kanban_cards").select("*").in("category_id", catIds).order("order");
        if (k) setCards(k);
        else setCards([]);
      } else {
        setCards([]);
      }
      setLoading(false);
    })();
    const ch = supabase.channel(`kanban-rt-${board.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_categories", filter: `board_id=eq.${board.id}` }, async () => {
        const { data } = await supabase.from("kanban_categories").select("*").eq("board_id", board.id).order("order");
        if (data) setCats(data);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards" }, async () => {
        const { data: c2 } = await supabase.from("kanban_categories").select("id").eq("board_id", board.id);
        const ids = (c2 || []).map((x) => x.id);
        if (!ids.length) { setCards([]); return; }
        const { data: k } = await supabase.from("kanban_cards").select("*").in("category_id", ids).order("order");
        if (k) setCards(k);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user, board?.id]);

  const cardsByCat = useMemo(() => {
    const m: Record<string, KCard[]> = {};
    for (const cat of cats) m[cat.id] = [];
    for (const c of cards) (m[c.category_id] ||= []).push(c);
    return m;
  }, [cards, cats]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  // Resolve drop target -> { categoryId, index }
  const resolveTarget = (overId: string) => {
    const overCard = cards.find((c) => c.id === overId);
    if (overCard) {
      const list = cards.filter((c) => c.category_id === overCard.category_id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const idx = list.findIndex((c) => c.id === overCard.id);
      return { categoryId: overCard.category_id, index: idx };
    }
    // Dropped on a column container
    const cat = cats.find((c) => c.id === overId);
    if (cat) {
      const list = cards.filter((c) => c.category_id === cat.id);
      return { categoryId: cat.id, index: list.length };
    }
    return null;
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const card = cards.find((c) => c.id === active.id);
    if (!card) return;
    const target = resolveTarget(over.id as string);
    if (!target) return;
    if (card.category_id === target.categoryId) return;
    // Move card across columns optimistically (no DB write yet)
    setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, category_id: target.categoryId } : c));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const card = cards.find((c) => c.id === active.id);
    if (!card) return;
    const target = resolveTarget(over.id as string);
    if (!target) return;

    // Compute new order within target column
    const colCards = cards.filter((c) => c.category_id === target.categoryId && c.id !== card.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const insertAt = Math.min(target.index, colCards.length);
    const reordered = [...colCards.slice(0, insertAt), card, ...colCards.slice(insertAt)];

    // Update local state
    setCards((prev) => {
      const others = prev.filter((c) => c.category_id !== target.categoryId && c.id !== card.id);
      return [...others, ...reordered.map((c, i) => ({ ...c, category_id: target.categoryId, order: i }))];
    });

    // Persist: update moved card + reorder siblings
    const updates = reordered.map((c, i) =>
      supabase.from("kanban_cards").update({ category_id: target.categoryId, order: i }).eq("id", c.id)
    );
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) toast.error("Erro ao salvar posição");
  };

  const createCategory = async (name: string) => {
    if (!user || !name.trim() || !board) return;
    const order = cats.length;
    const { error } = await supabase.from("kanban_categories")
      .insert({ user_id: user.id, board_id: board.id, name: name.trim(), order, color: "#4F46E5" });
    if (error) return toast.error("Erro ao criar coluna");
    toast.success("Coluna criada");
    setNewCat(false);
  };

  const renameActiveBoard = async (name: string) => {
    if (!board || !name.trim()) return;
    await supabase.from("kanban_boards").update({ name: name.trim() }).eq("id", board.id);
    setRenameBoard(false);
    toast.success("Quadro renomeado");
  };

  const deleteEntity = async () => {
    if (!confirmDel) return;
    if (confirmDel.type === "board") {
      const ids = cats.map((c) => c.id);
      if (ids.length) await supabase.from("kanban_cards").delete().in("category_id", ids);
      await supabase.from("kanban_categories").delete().eq("board_id", confirmDel.id);
      await supabase.from("kanban_boards").delete().eq("id", confirmDel.id);
      toast.success("Quadro removido");
      onDelete();
    } else {
      const table = confirmDel.type === "card" ? "kanban_cards" : "kanban_categories";
      await supabase.from(table).delete().eq("id", confirmDel.id);
      toast.success("Removido");
    }
    setConfirmDel(null);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full shrink-0" style={{ background: board.color || "#4F46E5" }} />
          <div>
            <h2 className="text-xl font-bold">{board.name}</h2>
            <p className="text-muted-foreground text-xs mt-0.5">{cards.length} cards · {cats.length} colunas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setNewCat(true)} variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" />Nova coluna</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenameBoard(true)}><Pencil className="h-4 w-4 mr-2" />Renomear quadro</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConfirmDel({ type: "board", id: board.id })} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Excluir quadro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={collisionDetection}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0 items-start">
          {cats.map((cat) => (
            <Column key={cat.id} category={cat} cards={cardsByCat[cat.id] || []}
              onAddCard={() => setEditing({ categoryId: cat.id })}
              onEditCard={(card) => setEditing({ card, categoryId: card.category_id })}
              onEditCat={() => setEditingCat(cat)}
              onDeleteCard={(id) => setConfirmDel({ type: "card", id })}
              onDeleteCat={() => setConfirmDel({ type: "category", id: cat.id })} />
          ))}
          {!cats.length && (
            <Card className="p-8 text-center text-muted-foreground w-full">
              Nenhuma coluna ainda. Clique em "Nova coluna".
            </Card>
          )}
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

      {editingCat && (
        <CategoryDialog open category={editingCat} onClose={() => setEditingCat(null)} />
      )}

      <InputDialog open={newCat} title="Nova coluna" label="Nome da coluna"
        placeholder="Ex: Em Revisão" onCancel={() => setNewCat(false)} onConfirm={(v) => { void createCategory(v); }} />

      <InputDialog open={renameBoard} title="Renomear quadro" label="Novo nome"
        initialValue={board.name}
        onCancel={() => setRenameBoard(false)} onConfirm={(v) => { void renameActiveBoard(v); }} />

      <ConfirmDialog open={!!confirmDel} variant="danger"
        title={confirmDel?.type === "card" ? "Excluir card?" : confirmDel?.type === "board" ? "Excluir quadro?" : "Excluir coluna?"}
        message={confirmDel?.type === "category"
          ? "Todos os cards desta coluna também serão excluídos."
          : confirmDel?.type === "board"
          ? "Todas as colunas e cards deste quadro serão excluídos."
          : "Esta ação não pode ser desfeita."}
        onConfirm={deleteEntity} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

function Column({ category, cards, onAddCard, onEditCard, onEditCat, onDeleteCard, onDeleteCat }: {
  category: KanbanCategory; cards: KCard[];
  onAddCard: () => void;
  onEditCard: (c: KCard) => void;
  onEditCat: () => void;
  onDeleteCard: (id: string) => void;
  onDeleteCat: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category.id });
  return (
    <div ref={setNodeRef}
      className={cn("w-80 shrink-0 bg-[#F1F2F4] dark:bg-muted/20 rounded-xl p-3 flex flex-col max-h-full transition-all duration-200 shadow-sm",
        isOver && "ring-2 ring-primary bg-primary/5")}>
      <div className="flex items-center justify-between mb-4 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: category.color || "#4F46E5" }} />
          <h3 className="text-xs font-bold text-[#44546F] dark:text-foreground tracking-tight uppercase">{category.name}</h3>
          <span className="text-[10px] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full text-muted-foreground font-bold">{cards.length}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-black/5 rounded-md"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="backdrop-blur-xl bg-white/90 dark:bg-black/90 border-none shadow-2xl">
            <DropdownMenuItem onClick={onEditCat} className="rounded-md font-medium"><Pencil className="h-4 w-4 mr-2" />Editar coluna</DropdownMenuItem>
            <DropdownMenuItem onClick={onDeleteCat} className="text-destructive rounded-md font-medium">
              <Trash2 className="h-4 w-4 mr-2" />Excluir coluna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1 min-h-[40px] overflow-y-auto pr-1 custom-scrollbar">
          {cards.map((c) => (
            <SortableCard key={c.id} card={c}
              onClick={() => onEditCard(c)}
              onDelete={() => onDeleteCard(c.id)} />
          ))}
        </div>
      </SortableContext>
      <Button 
        variant="ghost" 
        size="sm" 
        className="mt-3 justify-start shrink-0 text-[#44546F] hover:bg-black/10 hover:text-primary transition-all font-bold rounded-lg h-9" 
        onClick={onAddCard}
      >
        <Plus className="h-4 w-4 mr-2" strokeWidth={3} /> Nova Meta
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
  const tags = (card.tags as string[] | null) || [];
  return (
    <Card
      className={cn(
        "p-3.5 cursor-grab active:cursor-grabbing hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-all duration-300 border-none bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12)] group rounded-lg",
        dragging && "rotate-2 shadow-2xl scale-105 ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm flex-1 text-[#172B4D] dark:text-foreground leading-tight">{card.title}</p>
        {onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      
      {card.description && (
        <p className="text-[11px] text-[#44546F] dark:text-muted-foreground mt-2 line-clamp-2 leading-normal">
          {card.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <div className={cn("h-1 w-8 rounded-full mb-1", 
          prio === "high" ? "bg-red-500" : prio === "medium" ? "bg-amber-500" : "bg-blue-500"
        )} />
        <div className="w-full" />
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0 bg-[#F1F2F4] text-[#44546F] hover:bg-[#E2E4E9] border-none font-bold uppercase">
            {t}
          </Badge>
        ))}
        {card.due_date && (
          <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 ml-auto">
            <CalIcon className="h-3 w-3" />
            {format(new Date(card.due_date), "dd/MM", { locale: ptBR })}
          </span>
        )}
      </div>
    </Card>
  );
}

function CategoryDialog({ open, category, onClose }: { open: boolean; category: KanbanCategory; onClose: () => void }) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color || "#4F46E5");
  const save = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("kanban_categories").update({ name: name.trim(), color }).eq("id", category.id);
    if (error) return toast.error("Erro ao salvar");
    toast.success("Coluna atualizada");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar coluna</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className={cn("h-7 w-7 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    color: card?.color || "",
    tags: ((card?.tags as string[] | null) || []) as string[],
  });
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t] });
    setTagInput("");
  };
  const removeTag = (t: string) => setForm({ ...form, tags: form.tags.filter((x) => x !== t) });

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      color: form.color || null,
      tags: form.tags,
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
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{card ? "Editar card" : "Novo card"}</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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
          <div>
            <Label>Cor de destaque</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              <button onClick={() => setForm({ ...form, color: "" })}
                className={cn("h-7 w-7 rounded-full border-2 flex items-center justify-center", !form.color ? "border-foreground" : "border-transparent")}>
                <X className="h-3 w-3" />
              </button>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={cn("h-7 w-7 rounded-full border-2", form.color === c ? "border-foreground" : "border-transparent")}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Digite e pressione Enter" />
              <Button type="button" variant="outline" onClick={addTag}>Add</Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {form.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
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
