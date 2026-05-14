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

  const handleEditNode = useCallback(async (id: string, newTitle: string) => {
    if (!newTitle || !newTitle.trim()) return;
    await supabase.from("brainstorm_nodes").update({ title: newTitle.trim() }).eq("id", id);
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: newTitle.trim() } } : n));
  }, [setNodes]);

  const handleDeleteNode = useCallback(async (id: string) => {
    await supabase.from("brainstorm_connections").delete().or(`source_id.eq.${id},target_id.eq.${id}`);
    await supabase.from("brainstorm_nodes").delete().eq("id", id);
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const handleAddChild = useCallback(async (parentId: string) => {
    if (!user || !activeMap) return;
    setNodes((nds) => {
      const parent = nds.find(n => n.id === parentId);
      if (!parent) return nds;
      
      const pos = { x: parent.position.x + 250, y: parent.position.y + (Math.random() * 100 - 50) };
      
      setTimeout(async () => {
        const { data: node, error: nErr } = await supabase.from("brainstorm_nodes").insert({
          user_id: user.id, mindmap_id: activeMap, title: "Nova ideia", position: pos, parent_id: parentId
        }).select().single();

        if (nErr || !node) return toast.error("Erro ao criar nó");
        
        await supabase.from("brainstorm_connections").insert({
          user_id: user.id, mindmap_id: activeMap, source_id: parentId, target_id: node.id
        });

        setNodes((nds) => [...nds, {
          id: node.id, position: pos, type: "mindmapNode",
          data: { label: node.title, onEdit: handleEditNode, onAddChild: handleAddChild, onAddSibling: handleAddSibling, onDelete: handleDeleteNode }
        }]);
        setEdges((eds) => [...eds, { id: `e-${parentId}-${node.id}`, source: parentId, target: node.id, type: 'bezier' }]);
      }, 10);
      return nds;
    });
  }, [user, activeMap, handleEditNode, handleDeleteNode]);

  const handleAddSibling = useCallback(async (nodeId: string) => {
    if (!user || !activeMap) return;
    const edge = edges.find(e => e.target === nodeId);
    if (edge) {
      void handleAddChild(edge.source);
    } else {
      // Main node sibling
      void addNode("Nova ideia principal");
    }
  }, [user, activeMap, edges, handleAddChild]);

  // load nodes + edges
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
      
      const n: Node[] = (nData || []).map((row) => ({
        id: row.id,
        position: (row.position as any) || { x: 0, y: 0 },
        type: "mindmapNode",
        data: { 
          label: row.title, 
          isMain: !row.parent_id,
          onEdit: handleEditNode, 
          onAddChild: handleAddChild, 
          onAddSibling: handleAddSibling,
          onDelete: handleDeleteNode
        },
      }));
      const e: Edge[] = (eData || []).map((row) => ({ 
        id: row.id, source: row.source_id, target: row.target_id, type: 'bezier' 
      }));
      setNodes(n); setEdges(e);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [activeMap, handleEditNode, handleAddChild, handleAddSibling, handleDeleteNode]);

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

  const addNode = useCallback(async (title: string, atFlowPos?: { x: number; y: number }) => {
    if (!user || !activeMap || !title.trim()) return;
    const pos = atFlowPos || { x: 0, y: 0 };
    const { data, error } = await supabase.from("brainstorm_nodes").insert({
      user_id: user.id, mindmap_id: activeMap, title: title.trim(), position: pos,
    }).select().single();
    if (error || !data) return;
    setNodes((nds) => [...nds, {
      id: data.id, position: pos, type: "mindmapNode",
      data: { label: data.title, isMain: true, onEdit: handleEditNode, onAddChild: handleAddChild, onAddSibling: handleAddSibling, onDelete: handleDeleteNode }
    }]);
  }, [user, activeMap, handleEditNode, handleAddChild, handleAddSibling, handleDeleteNode]);

  return (
    <div className="space-y-4 h-[calc(100vh-120px)] flex flex-col bg-[#0a0a0a] -m-8 p-8 text-white">
      <div className="flex items-center justify-between flex-wrap gap-3 z-10">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-primary animate-pulse" />
          <Select value={activeMap ?? ""} onValueChange={setActiveMap}>
            <SelectTrigger className="w-[240px] h-9 bg-white/5 border-white/10 text-white font-bold rounded-full">
              <SelectValue placeholder="Selecione um mapa" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
              {maps.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
            </SelectContent>
          </Select>
          {activeMap && (
            <Button size="icon" variant="ghost" onClick={() => setConfirmDelMap(true)} className="hover:bg-destructive/20">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewMap(true)} className="rounded-full border-white/10 hover:bg-white/5">
            <Plus className="h-4 w-4 mr-2" />Novo mapa
          </Button>
          <Button onClick={() => addNode("Nova ideia principal")} disabled={!activeMap} className="rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20">
            <Plus className="h-4 w-4 mr-2" />Nova Ideia
          </Button>
        </div>
      </div>

      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        {loading ? (
          <div className="h-full flex items-center justify-center bg-[#0a0a0a]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !activeMap ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-[#0a0a0a]">
            <Brain className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Crie um mapa mental para explorar suas ideias.</p>
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
            defaultEdgeOptions={{ type: "bezier", style: { strokeWidth: 3, stroke: "#3b82f6", opacity: 0.6 } }}
            fitView
            className="bg-[#0a0a0a]"
          >
            <Background color="#333" gap={20} />
            <Controls className="bg-[#1A1A1A] border-white/10 fill-white [&_button]:border-white/5" />
          </ReactFlow>
        )}

        {/* Shortcuts Legend Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex gap-6 text-[10px] font-bold tracking-widest uppercase text-white/50 z-10">
          <span className="flex items-center gap-2"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">TAB</kbd> Adicionar Filho</span>
          <span className="flex items-center gap-2"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">ENTER</kbd> Adicionar Irmão</span>
          <span className="flex items-center gap-2"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">DBL CLICK</kbd> Editar</span>
        </div>
      </div>

      <InputDialog open={newMap} title="Novo mapa mental" label="Nome do mapa"
        placeholder="Ex.: Estratégia Q1" onCancel={() => setNewMap(false)} onConfirm={(v) => { void createMap(v); }} />

      <ConfirmDialog open={confirmDelMap} variant="danger" title="Excluir mapa?"
        message="Todas as ideias e conexões deste mapa serão removidas."
        onConfirm={deleteActiveMap} onCancel={() => setConfirmDelMap(false)} />
    </div>
  );
}
