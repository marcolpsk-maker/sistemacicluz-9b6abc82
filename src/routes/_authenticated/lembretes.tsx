import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Plus, Trash2, Calendar as CalIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Lembrete } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lembretes")({ component: LembretesPage });

function LembretesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Lembrete[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", due_date: "" });

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("lembretes").select("*")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (active && data) setItems(data);
      setLoading(false);
    })();
    const ch = supabase.channel("lembretes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "lembretes" }, async () => {
        const { data } = await supabase.from("lembretes").select("*")
          .order("due_date", { ascending: true, nullsFirst: false });
        if (data) setItems(data);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  const reset = () => setForm({ title: "", description: "", due_date: "" });

  const create = async () => {
    if (!user || !form.title.trim()) return;
    const { error } = await supabase.from("lembretes").insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    });
    if (error) return toast.error("Erro ao criar lembrete");
    toast.success("Lembrete criado");
    reset(); setOpen(false);
  };

  const toggle = async (l: Lembrete) => {
    await supabase.from("lembretes").update({ completed: !l.completed }).eq("id", l.id);
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("lembretes").delete().eq("id", confirmId);
    toast.success("Lembrete removido");
    setConfirmId(null);
  };

  const pending = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2"><Bell className="h-7 w-7" /> Lembretes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pending.length} pendente{pending.length !== 1 && "s"} · {done.length} concluído{done.length !== 1 && "s"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo lembrete</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo lembrete</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Enviar relatório" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalhes opcionais..." rows={3} />
              </div>
              <div>
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={create} disabled={!form.title.trim()}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum lembrete ainda. Crie o primeiro!</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Pendentes</h2>
              {pending.map((l) => <LembreteRow key={l.id} l={l} onToggle={toggle} onDelete={() => setConfirmId(l.id)} />)}
            </section>
          )}
          {done.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Concluídos</h2>
              {done.map((l) => <LembreteRow key={l.id} l={l} onToggle={toggle} onDelete={() => setConfirmId(l.id)} />)}
            </section>
          )}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onCancel={() => setConfirmId(null)}
        title="Excluir lembrete?" message="Esta ação não pode ser desfeita." variant="danger" onConfirm={remove} />
    </div>
  );
}

function LembreteRow({ l, onToggle, onDelete }: {
  l: Lembrete; onToggle: (l: Lembrete) => void; onDelete: () => void;
}) {
  return (
    <Card className={cn("p-4 flex items-start gap-3 transition-opacity", l.completed && "opacity-60")}>
      <Checkbox checked={!!l.completed} onCheckedChange={() => onToggle(l)} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", l.completed && "line-through")}>{l.title}</p>
        {l.description && <p className="text-sm text-muted-foreground mt-1">{l.description}</p>}
        {l.due_date && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <CalIcon className="h-3 w-3" />
            {format(new Date(l.due_date), "PPp", { locale: ptBR })}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}
