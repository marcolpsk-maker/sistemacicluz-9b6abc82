import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Brain, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InputDialog } from "@/components/modals/InputDialog";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { toast } from "sonner";
import { MindmapNode } from "@/components/Brainstorm/MindmapNode";

export const Route = createFileRoute("/_authenticated/brainstorm")({
  ssr: false,
  component: BrainstormPage,
});

type Mindmap = { id: string; name: string };

function BrainstormPage() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}

function Inner() {
  const { user } = useAuth();
  const [maps, setMaps] = useState<Mindmap[]>([]);
  const [activeMap, setActiveMap] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMap, setNewMap] = useState(false);
  const [confirmDelMap, setConfirmDelMap] = useState(false);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(() => ({ mindmapNode: MindmapNode }), []);

  // load maps
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("mindmaps").select("id, name").order("created_at");
      if (data) {
        setMaps(data);
        if (data.length && !activeMap) setActiveMap(data[0].id);
      }
    })();
  }, [user]);

  const handleEditNode = useCallback(async (id: string, oldTitle: string) => {
    const newTitle = window.prompt("Editar ideia:", oldTitle);
    if (newTitle == null || !newTitle.trim()) return;
    await supabase.from("brainstorm_nodes").update({ title: newTitle.trim() }).eq("id", id);
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: newTitle.trim() } } : n));
  }, [setNodes]);

  const handleAddChild = useCallback(async (parentId: string) => {
    if (!user || !activeMap) return;
    setNodes((currentNodes) => {
      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return currentNodes;
      
      setEdges((currentEdges) => {
        // We use setEdges/setNodes callback to get latest state without dependency cycles
        const siblings = currentEdges.filter(e => e.source === parentId);
        
        // Simple auto layout: place to the right, and space vertically based on siblings
        const yOffset = (siblings.length * 80) - ((siblings.length > 0 ? 80 : 0) / 2);
        const pos = { 
          x: parentNode.position.x + 250, 
          y: parentNode.position.y + yOffset 
        };
        
        setTimeout(async () => {
          const title = window.prompt("Nova ideia:");
          if (!title || !title.trim()) return;

          const { data: nodeData, error: nodeError } = await supabase.from("brainstorm_nodes").insert({
            user_id: user.id, mindmap_id: activeMap, title: title.trim(), position: pos, parent_id: parentId
          }).select().single();

          if (nodeError || !nodeData) return toast.error("Falha ao criar nó");
          
          const { data: edgeData, error: edgeError } = await supabase.from("brainstorm_connections").insert({
            user_id: user.id, mindmap_id: activeMap, source_id: parentId, target_id: nodeData.id
          }).select().single();

          setNodes((nds) => [...nds, {
            id: nodeData.id, 
            position: pos, 
            type: "mindmapNode",
            data: { 
              label: nodeData.title, 
              color: nodeData.color,
              onEdit: handleEditNode,
              onAddChild: handleAddChild
            },
          }]);

          if (!edgeError && edgeData) {
            setEdges((eds) => [...eds, { 
              id: edgeData.id, 
              source: parentId, 
              target: nodeData.id,
              type: 'bezier'
            }]);
          }
        }, 10);
        
        return currentEdges;
      });
      return currentNodes;
    });
  }, [user, activeMap, setNodes, setEdges, handleEditNode]);

  // load nodes + edges of active map
  useEffect(() => {
    if (!activeMap) { setNodes([]); setEdges([]); setLoading(false); return; }
    setLoading(true);
    let active = true;
    (async () => {
      const [{ data: nData }, { data: eData }] = await Promise.all([
        supabase.from("brainstorm_nodes").select("*").eq("mindmap_id", activeMap),
        supabase.from("brainstorm_connections").select("*").eq("mindmap_id", activeMap),
      ]);
      if (!active) return;
      
      const n: Node[] = (nData || []).map((row) => {
        const pos = (row.position as { x: number; y: number } | null) || { x: 0, y: 0 };
        return {
          id: row.id,
          position: pos,
          type: "mindmapNode",
          data: { 
            label: row.title,
            color: row.color,
            onEdit: handleEditNode,
            onAddChild: handleAddChild
          },
        };
      });
      const e: Edge[] = (eData || []).map((row) => ({ 
        id: row.id, 
        source: row.source_id, 
        target: row.target_id,
        type: 'bezier'
      }));
      setNodes(n); setEdges(e);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [activeMap, setNodes, setEdges, handleEditNode, handleAddChild]);

  const persistNodePosition = useCallback(async (id: string, x: number, y: number) => {
    await supabase.from("brainstorm_nodes").update({ position: { x, y } }).eq("id", id);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChangeBase(changes);
    for (const ch of changes) {
      if (ch.type === "position" && !ch.dragging && ch.position) {
        void persistNodePosition(ch.id, ch.position.x, ch.position.y);
      }
    }
  }, [onNodesChangeBase, persistNodePosition]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChangeBase(changes);
    for (const ch of changes) {
      if (ch.type === "remove") {
        void supabase.from("brainstorm_connections").delete().eq("id", ch.id);
      }
    }
  }, [onEdgesChangeBase]);

  const onConnect = useCallback(async (conn: Connection) => {
    if (!user || !activeMap || !conn.source || !conn.target) return;
    const { data, error } = await supabase.from("brainstorm_connections")
      .insert({ user_id: user.id, mindmap_id: activeMap, source_id: conn.source, target_id: conn.target })
      .select().single();
    if (error || !data) return toast.error("Falha ao conectar");
    setEdges((eds) => addEdge({ ...conn, id: data.id, type: 'bezier' } as Edge, eds));
  }, [user, activeMap, setEdges]);

  const addNode = useCallback(async (title: string, atFlowPos?: { x: number; y: number }) => {
    if (!user || !activeMap || !title.trim()) return;
    const pos = atFlowPos || { x: Math.random() * 400, y: Math.random() * 300 };
    const { data, error } = await supabase.from("brainstorm_nodes").insert({
      user_id: user.id, mindmap_id: activeMap, title: title.trim(), position: pos,
    }).select().single();
    if (error || !data) return toast.error("Falha ao criar nó");
    setNodes((nds) => [...nds, {
      id: data.id, 
      position: pos, 
      type: "mindmapNode",
      data: { 
        label: data.title,
        color: data.color,
        onEdit: handleEditNode,
        onAddChild: handleAddChild
      },
    }]);
  }, [user, activeMap, setNodes, handleEditNode, handleAddChild]);

  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const title = window.prompt("Ideia principal:");
    if (!title) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    void addNode(title, pos);
  }, [addNode, screenToFlowPosition]);

  const createMap = async (name: string) => {
    if (!user || !name.trim()) return;
    const { data, error } = await supabase.from("mindmaps")
      .insert({ user_id: user.id, name: name.trim() }).select("id, name").single();
    if (error || !data) return toast.error("Falha ao criar mapa");
    setMaps((m) => [...m, data]);
    setActiveMap(data.id);
    setNewMap(false);
    toast.success("Mapa criado");
  };

  const deleteActiveMap = async () => {
    if (!activeMap) return;
    await supabase.from("brainstorm_connections").delete().eq("mindmap_id", activeMap);
    await supabase.from("brainstorm_nodes").delete().eq("mindmap_id", activeMap);
    await supabase.from("mindmaps").delete().eq("id", activeMap);
    const remaining = maps.filter((m) => m.id !== activeMap);
    setMaps(remaining);
    setActiveMap(remaining[0]?.id ?? null);
    setConfirmDelMap(false);
    toast.success("Mapa excluído");
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7" />
          <Select value={activeMap ?? ""} onValueChange={setActiveMap}>
            <SelectTrigger className="w-[240px] h-9 text-base font-semibold">
              <SelectValue placeholder="Selecione um mapa" />
            </SelectTrigger>
            <SelectContent>
              {maps.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
            </SelectContent>
          </Select>
          {activeMap && (
            <Button size="icon" variant="ghost" onClick={() => setConfirmDelMap(true)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewMap(true)}><Plus className="h-4 w-4 mr-2" />Novo mapa</Button>
          <Button onClick={() => addNode(window.prompt("Ideia principal:") || "")} disabled={!activeMap}>
            <Plus className="h-4 w-4 mr-2" />Nova Ideia
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Duplo-clique no canvas para criar ideia principal · duplo-clique na ideia para editar · use o botão (+) para ramificar</p>

      <Card ref={wrapperRef} className="flex-1 min-h-[500px] overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !activeMap ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Brain className="h-10 w-10 mb-2 opacity-40" />
            <p>Crie seu primeiro mapa mental para começar.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDoubleClick={onPaneDoubleClick}
            defaultEdgeOptions={{ type: "bezier", style: { strokeWidth: 2, stroke: "#9ca3af" } }}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        )}
      </Card>

      <InputDialog open={newMap} title="Novo mapa mental" label="Nome do mapa"
        placeholder="Ex.: Estratégia Q1" onCancel={() => setNewMap(false)} onConfirm={(v) => { void createMap(v); }} />

      <ConfirmDialog open={confirmDelMap} variant="danger" title="Excluir mapa?"
        message="Todas as ideias e conexões deste mapa serão removidas."
        onConfirm={deleteActiveMap} onCancel={() => setConfirmDelMap(false)} />
    </div>
  );
}
