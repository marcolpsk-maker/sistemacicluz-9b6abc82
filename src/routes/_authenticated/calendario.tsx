import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth,
  isSameDay, addMonths, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Evento, Reuniao } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateKanbanModal } from "@/components/Calendario/DateKanbanModal";

export const Route = createFileRoute("/_authenticated/calendario")({ component: CalendarPage });

type Item = {
  id: string;
  date: Date;
  title: string;
  type: "event" | "meeting" | "reminder";
  color: string;
};

function CalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "" });
  
  // Date selection opens the Kanban Modal
  const [kanbanDate, setKanbanDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const [{ data: ev }, { data: re }] = await Promise.all([
        supabase.from("eventos").select("*"),
        supabase.from("reunioes").select("*"),
      ]);
      if (!active) return;
      setEventos(ev || []);
      setReunioes(re || []);
      setLoading(false);
    };
    load();
    const ch = supabase.channel("calendar-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "reunioes" }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const e of eventos) {
      if (e.reuniao_id) continue; // dedupe
      list.push({ id: e.id, date: new Date(`${e.date}T${e.time || "00:00"}`),
        title: e.title, type: "event", color: e.color || "#4F46E5" });
    }
    for (const r of reunioes) {
      list.push({ id: r.id, date: new Date(`${r.date}T${r.time}`),
        title: r.title, type: "meeting", color: "#10B981" });
    }
    return list;
  }, [eventos, reunioes]);

  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [cursor]);

  const itemsByDay = (day: Date) => items.filter((i) => isSameDay(i.date, day));

  const createEvent = async () => {
    if (!user || !form.title.trim() || !form.date) return;
    const { error } = await supabase.from("eventos").insert({
      user_id: user.id, title: form.title.trim(), date: form.date,
      time: form.time || null, type: "event", color: "#4F46E5",
    });
    if (error) return toast.error("Erro ao criar evento");
    toast.success("Evento criado");
    setForm({ title: "", date: "", time: "" });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2"><CalIcon className="h-7 w-7" /> Calendário</h1>
          <p className="text-muted-foreground text-sm mt-1">Eventos, reuniões e tarefas diárias</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold w-40 text-center capitalize">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCursor(new Date())}>Hoje</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Evento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo evento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data *</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><Label>Hora</Label>
                    <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={createEvent} disabled={!form.title.trim() || !form.date}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Card className="p-2 md:p-4">
          <div className="grid grid-cols-7 gap-px text-xs font-semibold text-muted-foreground mb-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="text-center py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
            {grid.map((day) => {
              const dayItems = itemsByDay(day);
              const inMonth = isSameMonth(day, cursor);
              const today = isSameDay(day, new Date());
              return (
                <button key={day.toISOString()}
                  onClick={() => setKanbanDate(day)}
                  className={cn(
                    "bg-card min-h-[100px] p-1.5 text-left transition-colors hover:bg-muted/40",
                    !inMonth && "opacity-40",
                  )}>
                  <div className={cn("text-xs font-medium mb-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full",
                    today && "bg-primary text-primary-foreground")}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((it) => (
                      <div key={`${it.type}-${it.id}`}
                        className="text-[10px] truncate px-1 py-0.5 rounded text-white"
                        style={{ background: it.color }}>
                        {it.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">+{dayItems.length - 3} itens</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Kanban Modal for selected date */}
      <DateKanbanModal 
        date={kanbanDate} 
        onClose={() => setKanbanDate(null)} 
      />
    </div>
  );
}
