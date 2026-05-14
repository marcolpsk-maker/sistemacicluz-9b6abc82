import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, Plus, Trash2, Search, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Lembrete } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lembretes")({ component: LembretesPage });

const STICKY_COLORS = [
  "#FEF3C7", "#FED7AA", "#FECACA", "#FBCFE8",
  "#DDD6FE", "#BFDBFE", "#A7F3D0", "#E5E7EB",
];

type Status = "pending" | "done" | "archived";
const STATUS_LABEL: Record<Status, string> = { pending: "Pendente", done: "Concluído", archived: "Arquivado" };

function LembretesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Lembrete[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lembrete | null | "new">(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("lembretes").select("*").order("created_at", { ascending: false });
      if (!active) return;
      if (data) setItems(data);
      setLoading(false);
    })();
    const ch = supabase.channel("lembretes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "lembretes" }, async () => {
        const { data } = await supabase.from("lembretes").select("*").order("created_at", { ascending: false });
        if (data) setItems(data);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const status = (it.status as Status | null) || "pending";
      if (filter !== "all" && status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!it.title.toLowerCase().includes(q) && !((it.content || "").toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [items, filter, search]);

  const remove = async () => {
    if (!confirmDel) return;
    await supabase.from("lembretes").delete().eq("id", confirmDel);
    setConfirmDel(null);
    toast.success("Lembrete removido");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="h-7 w-7 text-primary" /> Lembretes</h1>
          <p className="text-muted-foreground text-xs mt-1 font-medium">{filtered.length} de {items.length} lembretes</p>
        </div>
        <Button onClick={() => {
          const name = window.prompt("Qual o seu nome para salvar o lembrete?");
          if (name) setEditing("new");
        }} className="rounded-full shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />Novo Lembrete</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="done">Concluídos</TabsTrigger>
            <TabsTrigger value="archived">Arquivados</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{items.length === 0 ? "Nenhum lembrete ainda. Crie seu primeiro!" : "Nenhum lembrete encontrado."}</p>
        </Card>
      ) : (
        <motion.div 
          layout
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.05 }
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((it, idx) => (
              <StickyNote 
                key={it.id} 
                item={it}
                index={idx}
                onClick={() => setEditing(it)}
                onDelete={() => setConfirmDel(it.id)} 
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {editing !== null && (
        <NoteDialog
          open
          item={editing === "new" ? null : editing}
          userId={user!.id}
          onClose={() => setEditing(null)} />
      )}

      <ConfirmDialog open={!!confirmDel} variant="danger"
        title="Excluir lembrete?" message="Esta ação não pode ser desfeita."
        onConfirm={remove} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

function StickyNote({ item, index, onClick, onDelete }: { 
  item: Lembrete; 
  index: number;
  onClick: () => void; 
  onDelete: () => void 
}) {
  const status = (item.status as Status | null) || "pending";
  const tags = (item.tags as string[] | null) || [];
  
  // Create an organic feel with slight rotation based on index
  const rotation = useMemo(() => (index % 2 === 0 ? 1 : -1) * (Math.random() * 1.5 + 0.5), [index]);

  return (
    <motion.div
      layout
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.9 },
        show: { opacity: 1, y: 0, scale: 1 }
      }}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      whileHover={{ y: -5, rotate: 0, scale: 1.02, zIndex: 10 }}
      onClick={onClick}
      className="group relative rounded-xl p-5 shadow-sm hover:shadow-xl transition-shadow cursor-pointer min-h-[220px] flex flex-col border border-black/5"
      style={{ 
        background: item.color || "#FEF3C7",
        rotate: `${rotation}deg`
      }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 hover:bg-destructive/10 p-1.5 rounded-full text-foreground/50 hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
      
      <div className="flex-1">
        <h3 className="font-bold text-base pr-8 text-foreground/90 leading-tight">{item.title}</h3>
        {item.content && (
          <p className="text-sm text-foreground/75 mt-3 whitespace-pre-wrap line-clamp-5 leading-relaxed">
            {item.content}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] py-0 px-2 bg-white/40 border-black/10 text-foreground/80">
                {t}
              </Badge>
            ))}
            {tags.length > 3 && <span className="text-[10px] text-foreground/50">+{tags.length - 3}</span>}
          </div>
        )}
        
        <div className="flex items-center justify-between border-t border-black/5 pt-3">
          <Badge variant="outline" className={cn(
            "text-[10px] py-0 px-2 border-black/10",
            status === "done" ? "bg-emerald-500/20 text-emerald-700" : "bg-white/40 text-foreground/70"
          )}>
            {STATUS_LABEL[status]}
          </Badge>
          
          {item.due_date && (
            <span className="text-[10px] font-medium text-foreground/60 bg-white/30 px-2 py-0.5 rounded-full">
              {format(new Date(item.due_date), "dd/MM", { locale: ptBR })}
            </span>
          )}
        </div>
      </div>
      
      {/* Decorative tape effect */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 bg-white/20 backdrop-blur-sm rotate-2 border border-white/30 shadow-sm pointer-events-none" />
    </motion.div>
  );
}

function NoteDialog({ open, item, userId, onClose }: {
  open: boolean; item: Lembrete | null; userId: string; onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: item?.title || "",
    content: item?.content || "",
    color: item?.color || STICKY_COLORS[0],
    status: ((item?.status as Status | null) || "pending") as Status,
    due_date: item?.due_date ? new Date(item.due_date).toISOString().slice(0, 16) : "",
    tags: ((item?.tags as string[] | null) || []) as string[],
  });
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t] });
    setTagInput("");
  };

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      content: form.content || null,
      color: form.color,
      status: form.status,
      completed: form.status === "done",
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      tags: form.tags,
    };
    if (item) {
      const { error } = await supabase.from("lembretes").update(payload).eq("id", item.id);
      if (error) return toast.error("Erro ao salvar");
      toast.success("Lembrete atualizado");
    } else {
      const { error } = await supabase.from("lembretes").insert({ ...payload, user_id: userId });
      if (error) return toast.error("Erro ao criar");
      toast.success("Lembrete criado");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{item ? "Editar lembrete" : "Novo lembrete"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div>
            <Label>Conteúdo</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {STICKY_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={cn("h-8 w-8 rounded-md border-2 transition-all", form.color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
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
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Enter para adicionar" />
              <Button type="button" variant="outline" onClick={addTag}>Add</Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {form.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}>
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
