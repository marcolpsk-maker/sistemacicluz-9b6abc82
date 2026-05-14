import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Bell, Video, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ openTasks: 0, weekMeetings: 0, pendingReminders: 0, doneToday: 0 });
  const [byStatus, setByStatus] = useState<{ status: string; total: number }[]>([]);
  const [activity, setActivity] = useState<{ day: string; total: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

      const [{ data: cards }, { data: meetings }, { data: lembretes }] = await Promise.all([
        supabase.from("kanban_cards").select("status, created_at"),
        supabase.from("reunioes").select("date").gte("date", today.toISOString().slice(0,10)).lte("date", weekEnd.toISOString().slice(0,10)),
        supabase.from("lembretes").select("completed").eq("completed", false),
      ]);

      const cardsArr = cards ?? [];
      setStats({
        openTasks: cardsArr.filter(c => c.status !== "done").length,
        weekMeetings: meetings?.length ?? 0,
        pendingReminders: lembretes?.length ?? 0,
        doneToday: cardsArr.filter(c => c.status === "done" && c.created_at && new Date(c.created_at) >= today).length,
      });

      const counts = new Map<string, number>();
      cardsArr.forEach(c => counts.set(c.status ?? "todo", (counts.get(c.status ?? "todo") ?? 0) + 1));
      setByStatus(Array.from(counts.entries()).map(([status, total]) => ({ status, total })));

      const days: { day: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        days.push({
          day: d.toLocaleDateString("pt-BR", { weekday: "short" }),
          total: cardsArr.filter(c => c.created_at && new Date(c.created_at) >= d && new Date(c.created_at) < next).length,
        });
      }
      setActivity(days);
    })();
  }, [user]);

  const cards = [
    { label: "Tarefas abertas", value: stats.openTasks, icon: CheckCircle2, color: "text-primary" },
    { label: "Reuniões da semana", value: stats.weekMeetings, icon: Video, color: "text-secondary" },
    { label: "Lembretes pendentes", value: stats.pendingReminders, icon: Bell, color: "text-accent" },
    { label: "Concluídas hoje", value: stats.doneToday, icon: Clock, color: "text-foreground" },
  ];

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="text-5xl font-extrabold tracking-tighter text-[#172B4D] dark:text-white">
          {(() => {
            const hour = new Date().getHours();
            if (hour < 12) return "Bom dia";
            if (hour < 18) return "Boa tarde";
            return "Boa noite";
          })()}, {(user?.user_metadata?.name as string | undefined)?.split(" ")[0] ?? "Usuário"}!
        </h1>
        <p className="text-muted-foreground text-xl font-medium opacity-80">Aqui está o pulso estratégico do seu CICLUZ hoje.</p>
      </motion.div>

      <motion.div 
        initial="hidden"
        animate="show"
        variants={{
          show: { transition: { staggerChildren: 0.1 } }
        }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {cards.map(c => (
          <motion.div
            key={c.label}
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
          >
            <Card className="p-6 hover:shadow-lg transition-shadow border-black/5 bg-gradient-to-br from-card to-muted/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className="text-4xl font-bold mt-2 tracking-tight">{c.value}</p>
                </div>
                <div className={cn("p-2 rounded-lg bg-white/50 shadow-sm", c.color)}>
                  <c.icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="mb-4">Tarefas por status</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="status" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-4">Atividade — últimos 7 dias</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="var(--color-secondary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
