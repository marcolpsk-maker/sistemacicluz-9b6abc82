import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, Plus, Trash2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import type { BrainstormNode } from "@/types";
import { InputDialog } from "@/components/modals/InputDialog";

export const Route = createFileRoute("/_authenticated/brainstorm")({ component: BrainstormPage });

type Pos = { x: number; y: number };

function BrainstormPage() {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<BrainstormNode[]>([]);
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; offset: Pos } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const { data } = await supabase.from("brainstorm_nodes").select("*").order("created_at");
    setNodes(data ?? []);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel("brainstorm")
      .on("postgres_changes", { event: "*", schema: "public", table: "brainstorm_nodes" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const addNode = async (title: string) => {
    if (!user || !title.trim()) return;
    const board = boardRef.current?.getBoundingClientRect();
    const x = board ? Math.random() * (board.width - 200) : 50;
    const y = board ? Math.random() * (board.height - 100) : 50;
    const { error } = await supabase.from("brainstorm_nodes").insert({
      user_id: user.id,
      title: title.trim(),
      position: { x, y },
    });
    if (error) toast.error("Falha ao criar nó");
    setCreating(false);
  };

  const removeNode = async (id: string) => {
    await supabase.from("brainstorm_nodes").delete().eq("id", id);
  };

  const onMouseDown = (e: React.MouseEvent, node: BrainstormNode) => {
    const pos = node.position as Pos;
    setDragging({ id: node.id, offset: { x: e.clientX - pos.x, y: e.clientY - pos.y } });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setNodes((curr) =>
        curr.map((n) => n.id === dragging.id
          ? { ...n, position: { x: e.clientX - dragging.offset.x, y: e.clientY - dragging.offset.y } as never }
          : n
        )
      );
    };
    const onUp = async () => {
      const node = nodes.find((n) => n.id === dragging.id);
      if (node) {
        await supabase.from("brainstorm_nodes").update({ position: node.position }).eq("id", node.id);
      }
      setDragging(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, nodes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6 text-primary" /> Brainstorm</h1>
          <p className="text-sm text-muted-foreground">Capture e arraste suas ideias.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" /> Nova ideia</Button>
      </div>

      <Card
        ref={boardRef}
        className="relative w-full h-[calc(100vh-12rem)] overflow-hidden bg-muted/30"
        style={{ backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      >
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <Lightbulb className="h-10 w-10 mb-2" />
            <p>Clique em "Nova ideia" para começar.</p>
          </div>
        )}
        {nodes.map((n) => {
          const pos = n.position as Pos;
          return (
            <div
              key={n.id}
              className="absolute group select-none"
              style={{ left: pos.x, top: pos.y }}
            >
              <Card
                onMouseDown={(e) => onMouseDown(e, n)}
                className="w-48 p-3 cursor-grab active:cursor-grabbing shadow-md hover:shadow-lg transition-shadow border-l-4"
                style={{ borderLeftColor: n.color ?? "#4F46E5" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium break-words">{n.title}</p>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => removeNode(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            </div>
          );
        })}
      </Card>

      <InputDialog
        open={creating}
        title="Nova ideia"
        label="Título"
        placeholder="Ex.: Campanha de lançamento"
        onConfirm={addNode}
        onCancel={() => setCreating(false)}
      />
    </div>
  );
}
