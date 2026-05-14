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
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Próximas Reuniões</h2>
              </div>
              <motion.div 
                initial="hidden" animate="show"
                variants={{ show: { transition: { staggerChildren: 0.1 } } }}
                className="grid gap-4"
              >
                {upcoming.map((r) => <ReuniaoCard key={r.id} r={r} onDelete={() => setConfirmId(r.id)} />)}
              </motion.div>
            </section>
          )}
          
          {past.length > 0 && (
            <section className="space-y-4 opacity-75 grayscale-[0.5]">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Passadas</h2>
              <div className="grid gap-3">
                {past.map((r) => <ReuniaoCard key={r.id} r={r} onDelete={() => setConfirmId(r.id)} />)}
              </div>
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
  const isPast = new Date(`${r.date}T${r.time}`) < new Date();
  const meetingDate = new Date(`${r.date}T${r.time}`);
  
  // Extract link if it's in the description
  const link = r.description?.match(/https?:\/\/[^\s]+/)?.[0];
  const cleanDescription = r.description?.replace(/https?:\/\/[^\s]+/, "").trim();

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
      whileHover={{ scale: 1.01 }}
      className="group"
    >
      <Card className={cn(
        "relative overflow-hidden border-l-4 transition-all duration-300",
        isPast ? "border-l-muted" : "border-l-primary shadow-sm hover:shadow-md"
      )}>
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex gap-5 items-start">
            <div className={cn(
              "flex flex-col items-center justify-center min-w-[64px] h-16 rounded-xl border-2 font-bold",
              isPast ? "bg-muted/50 border-muted text-muted-foreground" : "bg-primary/5 border-primary/20 text-primary"
            )}>
              <span className="text-xs uppercase">{format(meetingDate, "MMM", { locale: ptBR })}</span>
              <span className="text-xl">{format(meetingDate, "dd")}</span>
            </div>
            
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg leading-none">{r.title}</h3>
                {isPast ? (
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold">Encerrada</Badge>
                ) : (
                  <Badge className="bg-emerald-500 text-white text-[10px] uppercase font-bold">Confirmada</Badge>
                )}
              </div>
              
              {cleanDescription && (
                <p className="text-sm text-muted-foreground line-clamp-1">{cleanDescription}</p>
              )}
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <div className="flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  <span>{format(meetingDate, "HH:mm")}</span>
                </div>
                {r.participants && r.participants.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>{r.participants.length} participante{r.participants.length !== 1 && "s"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto md:ml-0">
            {link && !isPast && (
              <Button asChild size="sm" className="rounded-full shadow-lg shadow-primary/20">
                <a href={link} target="_blank" rel="noopener noreferrer">
                  Entrar na Reunião
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Progress bar decoration for upcoming */}
        {!isPast && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/10">
            <div className="h-full bg-primary/40 w-1/3" />
          </div>
        )}
      </Card>
    </motion.div>
  );
}
