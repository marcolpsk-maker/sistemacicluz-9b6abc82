import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanSquare, Plus, Trash2, MoreVertical, Loader2, Calendar as CalIcon, X, Pencil } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/kanban")({ component: KanbanPage });

const PRIO_LABEL: Record<Priority, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const PRIO_CLASS: Record<Priority, string> = {
  low: "bg-secondary-light text-secondary",
  medium: "bg-accent-light text-accent-foreground",
  high: "bg-destructive-light text-destructive",
};

const COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#EF4444", "#8B5CF6", "#9CA3AF"];

function KanbanPage() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [cats, setCats] = useState<KanbanCategory[]>([]);
  const [cards, setCards] = useState<KCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ card?: KCard; categoryId: string } | null>(null);
  const [editingCat, setEditingCat] = useState<KanbanCategory | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ type: "card" | "category" | "board"; id: string } | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [newBoard, setNewBoard] = useState(false);
  const [renameBoard, setRenameBoard] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load boards
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("kanban_boards").select("*").order("order");
      if (!active || !data) return;
      setBoards(data);
      if (data.length && !activeBoardId) setActiveBoardId(data[0].id);
    })();
    const ch = supabase.channel("kanban-boards-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_boards" }, async () => {
        const { data } = await supabase.from("kanban_boards").select("*").order("order");
        if (data) setBoards(data);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  // Load cats + cards for active board
  useEffect(() => {
    if (!user || !activeBoardId) { setLoading(false); return; }
    setLoading(true);
    let active = true;
    (async () => {
      const { data: c } = await supabase.from("kanban_categories").select("*").eq("board_id", activeBoardId).order("order");
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
    const ch = supabase.channel(`kanban-rt-${activeBoardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_categories", filter: `board_id=eq.${activeBoardId}` }, async () => {
        const { data } = await supabase.from("kanban_categories").select("*").eq("board_id", activeBoardId).order("order");
        if (data) setCats(data);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards" }, async () => {
        const { data: c2 } = await supabase.from("kanban_categories").select("id").eq("board_id", activeBoardId);
        const ids = (c2 || []).map((x) => x.id);
        if (!ids.length) { setCards([]); return; }
        const { data: k } = await supabase.from("kanban_cards").select("*").in("category_id", ids).order("order");
        if (k) setCards(k);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user, activeBoardId]);

  const cardsByCat = useMemo(() => {
    const m: Record<string, KCard[]> = {};
    for (const cat of cats) m[cat.id] = [];
    for (const c of cards) (m[c.category_id] ||= []).push(c);
    return m;
  }, [cards, cats]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;
  const activeBoard = boards.find((b) => b.id === activeBoardId);

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
    setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, category_id: targetCatId } : c));
    const { error } = await supabase.from("kanban_cards").update({ category_id: targetCatId }).eq("id", card.id);
    if (error) toast.error("Erro ao mover card");
  };

  const createCategory = async (name: string) => {
    if (!user || !name.trim() || !activeBoardId) return;
    const order = cats.length;
    const { error } = await supabase.from("kanban_categories")
      .insert({ user_id: user.id, board_id: activeBoardId, name: name.trim(), order, color: "#4F46E5" });
    if (error) return toast.error("Erro ao criar coluna");
    toast.success("Coluna criada");
    setNewCat(false);
  };

  const createBoard = async (name: string) => {
    if (!user || !name.trim()) return;
    const order = boards.length;
    const { data, error } = await supabase.from("kanban_boards")
      .insert({ user_id: user.id, name: name.trim(), order, color: "#4F46E5" }).select().single();
    if (error || !data) return toast.error("Erro ao criar quadro");
    // Default columns
    await supabase.from("kanban_categories").insert([
      { user_id: user.id, board_id: data.id, name: "A Fazer", color: "#9CA3AF", order: 1 },
      { user_id: user.id, board_id: data.id, name: "Em Andamento", color: "#F59E0B", order: 2 },
      { user_id: user.id, board_id: data.id, name: "Concluído", color: "#10B981", order: 3 },
    ]);
    setActiveBoardId(data.id);
    toast.success("Quadro criado");
    setNewBoard(false);
  };

  const renameActiveBoard = async (name: string) => {
    if (!activeBoardId || !name.trim()) return;
    await supabase.from("kanban_boards").update({ name: name.trim() }).eq("id", activeBoardId);
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
      const next = boards.find((b) => b.id !== confirmDel.id);
      setActiveBoardId(next?.id ?? null);
    } else {
      const table = confirmDel.type === "card" ? "kanban_cards" : "kanban_categories";
      await supabase.from(table).delete().eq("id", confirmDel.id);
      toast.success("Removido");
    }
    setConfirmDel(null);
  };

  if (loading && !boards.length) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <KanbanSquare className="h-7 w-7" />
          <div>
            <Select value={activeBoardId ?? ""} onValueChange={setActiveBoardId}>
              <SelectTrigger className="w-[260px] h-9 text-base font-semibold">
                <SelectValue placeholder="Selecione um quadro" />
              </SelectTrigger>
              <SelectContent>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: b.color || "#4F46E5" }} />
                      {b.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs mt-1">{cards.length} cards · {cats.length} colunas</p>
          </div>
          {activeBoard && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setRenameBoard(true)}><Pencil className="h-4 w-4 mr-2" />Renomear quadro</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setConfirmDel({ type: "board", id: activeBoard.id })} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />Excluir quadro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewBoard(true)}><Plus className="h-4 w-4 mr-2" />Novo quadro</Button>
          <Button onClick={() => setNewCat(true)} disabled={!activeBoardId}><Plus className="h-4 w-4 mr-2" />Nova coluna</Button>
        </div>
      </div>

      {!activeBoardId ? (
        <Card className="p-10 text-center text-muted-foreground">
          <p>Crie seu primeiro quadro para começar.</p>
          <Button className="mt-4" onClick={() => setNewBoard(true)}><Plus className="h-4 w-4 mr-2" />Novo quadro</Button>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}>
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
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
      )}

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

      <InputDialog open={newBoard} title="Novo quadro" label="Nome do quadro"
        placeholder="Ex: Marketing" onCancel={() => setNewBoard(false)} onConfirm={(v) => { void createBoard(v); }} />

      <InputDialog open={renameBoard} title="Renomear quadro" label="Novo nome"
        defaultValue={activeBoard?.name ?? ""}
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
            <DropdownMenuItem onClick={onEditCat}><Pencil className="h-4 w-4 mr-2" />Editar coluna</DropdownMenuItem>
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
  const tags = (card.tags as string[] | null) || [];
  return (
    <Card
      className={cn("p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-4",
        dragging && "rotate-2 shadow-lg")}
      style={{ borderLeftColor: card.color || "transparent" }}>
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
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", PRIO_CLASS[prio])}>
          {PRIO_LABEL[prio]}
        </Badge>
        {tags.map((t) => (
          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
        ))}
        {card.due_date && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
            <CalIcon className="h-3 w-3" />
            {format(new Date(card.due_date), "dd MMM", { locale: ptBR })}
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
