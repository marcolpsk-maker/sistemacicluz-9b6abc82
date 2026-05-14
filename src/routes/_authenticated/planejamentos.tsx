import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { KanbanBoard } from "@/types";
import { QuadrosList } from "@/components/Planejamentos/QuadrosList";
import { KanbanView } from "@/components/Planejamentos/KanbanView";
import { InputDialog } from "@/components/modals/InputDialog";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/planejamentos")({
  component: PlanejamentosPage,
});

function PlanejamentosPage() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [newBoard, setNewBoard] = useState(false);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadBoards = async () => {
      const { data } = await supabase.from("kanban_boards").select("*").order("order");
      if (!active || !data) return;
      setBoards(data);
      
      const { data: cats } = await supabase.from("kanban_categories").select("id, board_id");
      if (cats && cats.length > 0) {
        const catIds = cats.map(c => c.id);
        const { data: cards } = await supabase.from("kanban_cards").select("id, category_id").in("category_id", catIds);
        
        const counts: Record<string, number> = {};
        for (const b of data) {
          const boardCats = cats.filter(c => c.board_id === b.id).map(c => c.id);
          const boardCards = (cards || []).filter(c => boardCats.includes(c.category_id));
          counts[b.id] = boardCards.length;
        }
        setTaskCounts(counts);
      }
      setLoading(false);
    };
    
    loadBoards();
    const ch = supabase.channel("planejamentos-boards-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_boards" }, loadBoards)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards" }, loadBoards)
      .subscribe();
      
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

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
    toast.success("Quadro criado");
    setNewBoard(false);
  };

  if (loading && !boards.length) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {!activeBoardId ? (
        <>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Planejamentos</h1>
            <p className="text-muted-foreground mt-1">Gerencie seus quadros e tarefas.</p>
          </div>
          <QuadrosList 
            boards={boards} 
            onSelect={setActiveBoardId} 
            onNew={() => setNewBoard(true)} 
            getTaskCount={(id) => taskCounts[id] || 0}
          />
        </>
      ) : (
        <div className="flex flex-col h-full space-y-4 min-h-0">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setActiveBoardId(null)} className="mb-2 text-muted-foreground -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar aos quadros
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <KanbanView 
              board={boards.find(b => b.id === activeBoardId)!} 
              onDelete={() => setActiveBoardId(null)} 
            />
          </div>
        </div>
      )}

      <InputDialog open={newBoard} title="Novo quadro" label="Nome do quadro"
        placeholder="Ex: Marketing" onCancel={() => setNewBoard(false)} onConfirm={(v) => { void createBoard(v); }} />
    </div>
  );
}
