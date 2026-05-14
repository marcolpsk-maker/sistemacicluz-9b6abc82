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

  const months = useMemo(() => {
    return [0, 1, 2, 3].map((i) => addMonths(cursor, i));
  }, [cursor]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#172B4D] dark:text-foreground flex items-center gap-3">
            <CalIcon className="h-9 w-9 text-primary" strokeWidth={2.5} /> Agenda Global
          </h1>
          <p className="text-muted-foreground text-base font-medium opacity-80">Gerencie seu cronograma com clareza e elegância.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="px-3 font-semibold" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />Novo Evento</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-card/90">
              <DialogHeader><DialogTitle>Criar Novo Evento</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Título do Compromisso</Label>
                  <Input placeholder="Ex: Reunião de Alinhamento" className="rounded-xl border-none bg-muted/50 focus:bg-white transition-all h-11" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Data</Label>
                    <Input type="date" className="rounded-xl border-none bg-muted/50 focus:bg-white transition-all h-11" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Horário</Label>
                    <Input type="time" className="rounded-xl border-none bg-muted/50 focus:bg-white transition-all h-11" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button className="rounded-xl px-8" onClick={createEvent} disabled={!form.title.trim() || !form.date}>Agendar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {months.map((month) => (
            <MonthCard 
              key={month.toISOString()} 
              month={month} 
              items={items} 
              onSelectDate={setKanbanDate} 
            />
          ))}
        </div>
      )}

      <DateKanbanModal 
        date={kanbanDate} 
        onClose={() => setKanbanDate(null)} 
      />
    </div>
  );
}

function MonthCard({ month, items, onSelectDate }: { month: Date; items: Item[]; onSelectDate: (d: Date) => void }) {
  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [month]);

  const itemsByDay = (day: Date) => items.filter((i) => isSameDay(i.date, day));

  return (
    <Card className="p-5 border-none shadow-sm bg-white/50 dark:bg-card/50 backdrop-blur-sm rounded-2xl flex flex-col hover:shadow-md transition-shadow">
      <h3 className="text-lg font-bold capitalize mb-4 text-[#172B4D] dark:text-foreground">
        {format(month, "MMMM yyyy", { locale: ptBR })}
      </h3>
      <div className="grid grid-cols-7 gap-y-2 mb-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {grid.map((day) => {
          const dayItems = itemsByDay(day);
          const inMonth = isSameMonth(day, month);
          const today = isSameDay(day, new Date());
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "h-10 w-full flex flex-col items-center justify-center relative rounded-lg transition-all group",
                !inMonth && "opacity-10",
                inMonth && "hover:bg-primary/5"
              )}
            >
              <span className={cn(
                "text-xs font-semibold z-10",
                today && "text-primary",
                !inMonth && "text-muted-foreground"
              )}>
                {format(day, "d")}
              </span>
              
              {inMonth && dayItems.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayItems.slice(0, 3).map((it, idx) => (
                    <div 
                      key={idx} 
                      className="h-1 w-1 rounded-full shadow-sm" 
                      style={{ background: it.color }} 
                    />
                  ))}
                </div>
              )}
              
              {today && (
                <div className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20" />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
