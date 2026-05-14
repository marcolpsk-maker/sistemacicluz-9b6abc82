import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  useNodesState, useEdgesState, addEdge, useReactFlow,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Brain, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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

  // Refs to avoid stale closures inside node-data callbacks
  const userRef = useRef(user);
  const mapRef = useRef<string | null>(null);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { mapRef.current = activeMap; }, [activeMap]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const nodeTypes = useMemo(() => ({ mindmapNode: MindmapNode }), []);

  // ---- node operations (stable refs) ----
  const editNode = useCallback(async (id: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    await supabase.from("brainstorm_nodes").update({ title: t }).eq("id", id);
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: t } } : n));
  }, [setNodes]);

  const deleteNode = useCallback(async (id: string) => {
    await supabase.from("brainstorm_connections").delete().or(`source_id.eq.${id},target_id.eq.${id}`);
    await supabase.from("brainstorm_nodes").delete().eq("id", id);
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const buildNodeData = useCallback((label: string, isMain = false) => ({
    label, isMain,
    onEdit: editNode,
    onDelete: deleteNode,
    onAddChild: (id: string) => addChild(id),
    onAddSibling: (id: string) => addSibling(id),
  }), [editNode, deleteNode]);
  // forward refs
  const addChildRef = useRef<(parentId: string) => void>(() => {});
  const addSiblingRef = useRef<(nodeId: string) => void>(() => {});

  const addChild = useCallback((parentId: string) => addChildRef.current(parentId), []);
  const addSibling = useCallback((nodeId: string) => addSiblingRef.current(nodeId), []);

  const addRoot = useCallback(async (title: string, atFlowPos?: { x: number; y: number }) => {
    const u = userRef.current; const m = mapRef.current;
    if (!u || !m || !title.trim()) return;
    const pos = atFlowPos ?? { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    const { data, error } = await supabase.from("brainstorm_nodes").insert({
      user_id: u.id, mindmap_id: m, title: title.trim(), position: pos,
    }).select().single();
    if (error || !data) return toast.error("Erro ao criar nó");
    setNodes((nds) => [...nds, {
      id: data.id, position: pos, type: "mindmapNode",
      data: buildNodeData(data.title, true),
    }]);
  }, [setNodes, buildNodeData]);

  // wire addChild/addSibling implementations against latest state
  useEffect(() => {
    addChildRef.current = async (parentId: string) => {
      const u = userRef.current; const m = mapRef.current;
      if (!u || !m) return;
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) return;
      const pos = {
        x: parent.position.x + 220,
        y: parent.position.y + (Math.random() * 120 - 60),
      };
      const { data: node, error: nErr } = await supabase.from("brainstorm_nodes").insert({
        user_id: u.id, mindmap_id: m, title: "Nova ideia", position: pos, parent_id: parentId,
      }).select().single();
      if (nErr || !node) return toast.error("Erro ao criar nó");
      const { data: conn } = await supabase.from("brainstorm_connections").insert({
        user_id: u.id, mindmap_id: m, source_id: parentId, target_id: node.id,
      }).select().single();
      setNodes((nds) => [...nds, {
        id: node.id, position: pos, type: "mindmapNode",
        data: buildNodeData(node.title, false),
      }]);
      setEdges((eds) => [...eds, {
        id: conn?.id ?? `e-${parentId}-${node.id}`,
        source: parentId, target: node.id, type: "bezier",
      }]);
    };

    addSiblingRef.current = (nodeId: string) => {
      const incoming = edgesRef.current.find((e) => e.target === nodeId);
      if (incoming) addChildRef.current(incoming.source);
      else void addRoot("Nova ideia principal");
    };
  }, [nodes, setNodes, setEdges, buildNodeData, addRoot]);

  // ---- load maps ----
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("mindmaps").select("id, name").order("created_at");
      if (!active || !data) return;
      setMaps(data);
      setActiveMap((cur) => cur ?? data[0]?.id ?? null);
    })();
    return () => { active = false; };
  }, [user]);

  // ---- load nodes/edges for active map ----
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
        position: (row.position as { x: number; y: number }) || { x: 0, y: 0 },
        type: "mindmapNode",
        data: buildNodeData(row.title, !row.parent_id),
      }));
      const e: Edge[] = (eData || []).map((row) => ({
        id: row.id, source: row.source_id, target: row.target_id, type: "bezier",
      }));
      setNodes(n); setEdges(e);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [activeMap, setNodes, setEdges, buildNodeData]);

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
    setEdges((eds) => addEdge({ ...conn, id: data.id, type: "bezier" } as Edge, eds));
  }, [user, activeMap, setEdges]);

  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const title = window.prompt("Ideia principal:");
    if (!title) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    void addRoot(title, pos);
  }, [addRoot, screenToFlowPosition]);

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
    <div className="space-y-4 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <Select value={activeMap ?? ""} onValueChange={setActiveMap}>
            <SelectTrigger className="w-[240px] h-9">
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
          <Button variant="outline" onClick={() => setNewMap(true)}>
            <Plus className="h-4 w-4 mr-2" />Novo mapa
          </Button>
          <Button onClick={() => addRoot("Nova ideia principal")} disabled={!activeMap}>
            <Plus className="h-4 w-4 mr-2" />Nova Ideia
          </Button>
        </div>
      </div>

      <div className="flex-1 relative rounded-xl overflow-hidden border bg-card shadow-sm">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !activeMap ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
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
            defaultEdgeOptions={{ type: "bezier", style: { strokeWidth: 2, stroke: "hsl(var(--primary) / 0.5)" } }}
            fitView
          >
            <Background color="hsl(var(--border))" gap={20} />
            <Controls />
          </ReactFlow>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-background/90 backdrop-blur-sm border rounded-full flex gap-4 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground shadow-sm">
          <span className="flex items-center gap-1.5"><kbd className="bg-muted px-1.5 py-0.5 rounded">+</kbd> Filho</span>
          <span className="flex items-center gap-1.5"><kbd className="bg-muted px-1.5 py-0.5 rounded">DBL CLICK</kbd> Editar</span>
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
