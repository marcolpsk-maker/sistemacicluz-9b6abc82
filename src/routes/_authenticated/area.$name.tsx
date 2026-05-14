import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { KanbanBoard } from "@/types";
import { KanbanView } from "@/components/Planejamentos/KanbanView";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/area/$name")({
  component: AreaPage,
});

function AreaPage() {
  const { name } = Route.useParams();
  const { user } = useAuth();
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !name) return;
    setLoading(true);
    
    const loadBoard = async () => {
      // Find board by name (case insensitive-ish or exact based on route generation)
      // Since we generate route as slug, we might need to be careful.
      // But usually boards have the same name as Area.
      
      const { data, error } = await supabase
        .from("kanban_boards")
        .select("*")
        .ilike("name", name.replace(/-/g, " "))
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
        
      if (data) {
        setBoard(data);
      }
      setLoading(false);
    };
    
    loadBoard();
  }, [user, name]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Quadro não encontrado</h2>
        <p className="text-muted-foreground mt-1">Não encontramos um planejamento para esta área.</p>
        <Button asChild className="mt-6">
          <Link to="/kanban">Ir para Planejamentos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex-1 min-h-0">
        <KanbanView board={board} onDelete={() => {}} />
      </div>
    </div>
  );
}
