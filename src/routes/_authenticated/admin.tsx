import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Settings, Database, MessageSquare, KanbanSquare, Bell, Video, Calendar as CalIcon, Brain } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

const tables = [
  { key: "kanban_cards", label: "Cards Kanban", icon: KanbanSquare },
  { key: "lembretes", label: "Lembretes", icon: Bell },
  { key: "reunioes", label: "Reuniões", icon: Video },
  { key: "eventos", label: "Eventos", icon: CalIcon },
  { key: "chat_messages", label: "Mensagens IA", icon: MessageSquare },
  { key: "brainstorm_nodes", label: "Nós Brainstorm", icon: Brain },
  { key: "areas", label: "Áreas", icon: Database },
] as const;

function AdminPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    Promise.all(
      tables.map(async (t) => {
        const { count } = await supabase.from(t.key).select("*", { count: "exact", head: true });
        return [t.key, count ?? 0] as const;
      })
    ).then((rows) => setCounts(Object.fromEntries(rows)));
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6 text-primary" /> Admin</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos seus dados.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.key} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{counts[t.key] ?? "—"}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t.label}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
