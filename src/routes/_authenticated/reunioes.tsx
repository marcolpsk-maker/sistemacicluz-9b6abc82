import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Video, Plus, Trash2, Users, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Reuniao } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reunioes")({ component: ReunioesPage });

function ReunioesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", date: "", time: "", participants: [] as string[], participantInput: "",
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("reunioes").select("*")
        .order("date", { ascending: true }).order("time", { ascending: true });
      if (active && data) setItems(data);
      setLoading(false);
    })();
    const ch = supabase.channel("reunioes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "reunioes" }, async () => {
        const { data } = await supabase.from("reunioes").select("*")
          .order("date", { ascending: true }).order("time", { ascending: true });
        if (data) setItems(data);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  const reset = () => setForm({ title: "", description: "", date: "", time: "", participants: [], participantInput: "" });

  const addParticipant = () => {
    const v = form.participantInput.trim();
    if (!v) return;
    setForm({ ...form, participants: [...form.participants, v], participantInput: "" });
  };

  const create = async () => {
    if (!user || !form.title.trim() || !form.date || !form.time) return;
    const { data: meeting, error } = await supabase.from("reunioes").insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      date: form.date,
      time: form.time,
      participants: form.participants,
    }).select().single();
    if (error || !meeting) return toast.error("Erro ao criar reunião");
    // mirror as evento
    await supabase.from("eventos").insert({
      user_id: user.id,
      title: form.title.trim(),
      date: form.date,
      time: form.time,
      type: "meeting",
      color: "#10B981",
      reuniao_id: meeting.id,
    });
    toast.success("Reunião criada");
    reset(); setOpen(false);
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("eventos").delete().eq("reuniao_id", confirmId);
    await supabase.from("reunioes").delete().eq("id", confirmId);
    toast.success("Reunião removida");
    setConfirmId(null);
  };

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = items.filter((i) => i.date >= today);
  const past = items.filter((i) => i.date < today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2"><Video className="h-7 w-7" /> Reuniões</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {upcoming.length} próxima{upcoming.length !== 1 && "s"} · {past.length} passada{past.length !== 1 && "s"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova reunião</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova reunião</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Descrição / pauta</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <Label>Hora *</Label>
                  <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Participantes</Label>
                <div className="flex gap-2">
                  <Input value={form.participantInput}
                    onChange={(e) => setForm({ ...form, participantInput: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } }}
                    placeholder="Nome ou email" />
                  <Button type="button" variant="outline" onClick={addParticipant}>Adicionar</Button>
                </div>
                {form.participants.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.participants.map((p, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {p}
                        <button onClick={() => setForm({ ...form, participants: form.participants.filter((_, idx) => idx !== i) })}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={create} disabled={!form.title.trim() || !form.date || !form.time}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <Video className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma reunião agendada.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Próximas</h2>
              {upcoming.map((r) => <ReuniaoCard key={r.id} r={r} onDelete={() => setConfirmId(r.id)} />)}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-2 opacity-70">
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Passadas</h2>
              {past.map((r) => <ReuniaoCard key={r.id} r={r} onDelete={() => setConfirmId(r.id)} />)}
            </section>
          )}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onCancel={() => setConfirmId(null)}
        title="Excluir reunião?" message="O evento associado também será removido." variant="danger" onConfirm={remove} />
    </div>
  );
}

function ReuniaoCard({ r, onDelete }: { r: Reuniao; onDelete: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium">{r.title}</p>
          {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
          <p className="text-xs text-muted-foreground mt-2">
            {format(new Date(`${r.date}T${r.time}`), "PPP 'às' HH:mm", { locale: ptBR })}
          </p>
          {r.participants && r.participants.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              <Users className="h-3 w-3 text-muted-foreground" />
              {r.participants.map((p, i) => <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>)}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
