import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Brain, Plus, Trash2, Loader2, LayoutGrid, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InputDialog } from "@/components/modals/InputDialog";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { toast } from "sonner";
import { MindmapNode, type MindmapNodeData } from "@/components/Brainstorm/MindmapNode";
import { layoutTree } from "@/components/Brainstorm/layout";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  const userRef = useRef(user);
  const mapRef = useRef<string | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { mapRef.current = activeMap; }, [activeMap]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  const nodeTypes = useMemo(() => ({ mindmapNode: MindmapNode }), []);

  // ---- node ops ----
  const editNode = useCallback(async (id: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    await supabase.from("brainstorm_nodes").update({ title: t }).eq("id", id);
    setNodes((nds) => nds.map((n) => n.id === id
      ? { ...n, data: { ...(n.data as MindmapNodeData), label: t, autoEdit: false } }
      : n));
  }, [setNodes]);

  const deleteNode = useCallback(async (id: string) => {
    await supabase.from("brainstorm_connections").delete().or(`source_id.eq.${id},target_id.eq.${id}`);
    await supabase.from("brainstorm_nodes").delete().eq("id", id);
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    if (selectedRef.current === id) setSelectedId(null);
  }, [setNodes, setEdges]);

  const addChildRef = useRef<(parentId: string) => Promise<void>>(async () => {});
  const addSiblingRef = useRef<(nodeId: string) => Promise<void>>(async () => {});

  const buildData = useCallback((label: string, isMain: boolean, autoEdit = false): MindmapNodeData => ({
    label, isMain, autoEdit,
    onEdit: editNode,
    onDelete: deleteNode,
    onAddChild: (id: string) => { void addChildRef.current(id); },
  }), [editNode, deleteNode]);

  const relayout = useCallback(() => {
    setNodes((nds) => {
      const laid = layoutTree(nds, edgesRef.current);
      // persist positions
      laid.forEach((n) => {
        void supabase.from("brainstorm_nodes").update({ position: n.position }).eq("id", n.id);
      });
      return laid;
    });
    setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 50);
  }, [setNodes, fitView]);

  const addRoot = useCallback(async (title = "Ideia central") => {
    const u = userRef.current; const m = mapRef.current;
    if (!u || !m) return;
    const pos = { x: 0, y: 0 };
    const { data, error } = await supabase.from("brainstorm_nodes").insert({
      user_id: u.id, mindmap_id: m, title, position: pos,
    }).select().single();
    if (error || !data) return toast.error("Erro ao criar nó");
    setNodes((nds) => [...nds, {
      id: data.id, position: pos, type: "mindmapNode",
      data: buildData(title, true, true),
    }]);
    setSelectedId(data.id);
  }, [setNodes, buildData]);

  // child / sibling
  useEffect(() => {
    addChildRef.current = async (parentId: string) => {
      const u = userRef.current; const m = mapRef.current;
      if (!u || !m) return;
      const parent = nodesRef.current.find((n) => n.id === parentId);
      if (!parent) return;
      const pos = { x: parent.position.x + 220, y: parent.position.y };
      const { data: node, error } = await supabase.from("brainstorm_nodes").insert({
        user_id: u.id, mindmap_id: m, title: "Nova ideia", position: pos, parent_id: parentId,
      }).select().single();
      if (error || !node) { toast.error("Erro ao criar nó"); return; }
      const { data: conn } = await supabase.from("brainstorm_connections").insert({
        user_id: u.id, mindmap_id: m, source_id: parentId, target_id: node.id,
      }).select().single();
      const newNode: Node = {
        id: node.id, position: pos, type: "mindmapNode",
        data: buildData("Nova ideia", false, true),
      };
      const newEdge: Edge = {
        id: conn?.id ?? `e-${parentId}-${node.id}`,
        source: parentId, target: node.id, type: "smoothstep",
      };
      const nextNodes = [...nodesRef.current, newNode];
      const nextEdges = [...edgesRef.current, newEdge];
      const laid = layoutTree(nextNodes, nextEdges);
      setNodes(laid);
      setEdges(nextEdges);
      setSelectedId(node.id);
      laid.forEach((n) => {
        void supabase.from("brainstorm_nodes").update({ position: n.position }).eq("id", n.id);
      });
      setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 60);
    };

    addSiblingRef.current = async (nodeId: string) => {
      const incoming = edgesRef.current.find((e) => e.target === nodeId);
      if (incoming) await addChildRef.current(incoming.source);
      else await addRoot("Nova ideia");
    };
  }, [setNodes, setEdges, buildData, addRoot, fitView]);

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

  // ---- load nodes/edges ----
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
      let n: Node[] = (nData || []).map((row) => ({
        id: row.id,
        position: (row.position as { x: number; y: number }) || { x: 0, y: 0 },
        type: "mindmapNode",
        data: buildData(row.title, !row.parent_id),
      }));
      const e: Edge[] = (eData || []).map((row) => ({
        id: row.id, source: row.source_id, target: row.target_id, type: "smoothstep",
      }));
      // If everything is at (0,0) (e.g. new map), auto-layout
      const allZero = n.length > 0 && n.every((nd) => nd.position.x === 0 && nd.position.y === 0);
      if (allZero) n = layoutTree(n, e);
      setNodes(n); setEdges(e);
      setLoading(false);
      setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 80);
    })();
    return () => { active = false; };
  }, [activeMap, setNodes, setEdges, buildData, fitView]);

  const persistNodePosition = useCallback(async (id: string, x: number, y: number) => {
    await supabase.from("brainstorm_nodes").update({ position: { x, y } }).eq("id", id);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChangeBase(changes);
    for (const ch of changes) {
      if (ch.type === "position" && !ch.dragging && ch.position) {
        void persistNodePosition(ch.id, ch.position.x, ch.position.y);
      }
      if (ch.type === "select" && ch.selected) setSelectedId(ch.id);
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
    setEdges((eds) => addEdge({ ...conn, id: data.id, type: "smoothstep" } as Edge, eds));
  }, [user, activeMap, setEdges]);

  // ---- arrow navigation helpers ----
  const navigate = useCallback((dir: "up" | "down" | "left" | "right") => {
    const sel = selectedRef.current;
    const ns = nodesRef.current;
    const es = edgesRef.current;
    if (!sel) { if (ns[0]) setSelectedId(ns[0].id); return; }
    if (dir === "right") {
      const child = es.find((e) => e.source === sel);
      if (child) setSelectedId(child.target);
      return;
    }
    if (dir === "left") {
      const parent = es.find((e) => e.target === sel);
      if (parent) setSelectedId(parent.source);
      return;
    }
    // up/down: among siblings (same parent), sorted by Y
    const incoming = es.find((e) => e.target === sel);
    const siblingIds = incoming
      ? es.filter((e) => e.source === incoming.source).map((e) => e.target)
      : ns.filter((n) => !es.some((e) => e.target === n.id)).map((n) => n.id);
    const sibs = siblingIds
      .map((id) => ns.find((n) => n.id === id))
      .filter((n): n is Node => !!n)
      .sort((a, b) => a.position.y - b.position.y);
    const idx = sibs.findIndex((n) => n.id === sel);
    const next = dir === "up" ? sibs[idx - 1] : sibs[idx + 1];
    if (next) setSelectedId(next.id);
  }, []);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const sel = selectedRef.current;
      if (e.key === "Tab" && sel) {
        e.preventDefault();
        void addChildRef.current(sel);
      } else if (e.key === "Enter" && sel) {
        e.preventDefault();
        void addSiblingRef.current(sel);
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        const node = nodesRef.current.find((n) => n.id === sel);
        if (node && !(node.data as MindmapNodeData).isMain) void deleteNode(sel);
      } else if (e.key === "ArrowUp") { e.preventDefault(); navigate("up"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); navigate("down"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); navigate("left"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); navigate("right"); }
      else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteNode, navigate]);

  // ---- realtime sync ----
  useEffect(() => {
    if (!activeMap || !user) return;
    const channel = supabase
      .channel(`brainstorm:${activeMap}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "brainstorm_nodes", filter: `mindmap_id=eq.${activeMap}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as { id: string; title: string; parent_id: string | null; position: { x: number; y: number } };
            setNodes((nds) => nds.some((n) => n.id === row.id) ? nds : [...nds, {
              id: row.id, position: row.position || { x: 0, y: 0 }, type: "mindmapNode",
              data: buildData(row.title, !row.parent_id),
            }]);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as { id: string; title: string; position: { x: number; y: number } };
            setNodes((nds) => nds.map((n) => n.id === row.id
              ? { ...n, position: row.position || n.position, data: { ...(n.data as MindmapNodeData), label: row.title } }
              : n));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id: string };
            setNodes((nds) => nds.filter((n) => n.id !== row.id));
          }
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "brainstorm_connections", filter: `mindmap_id=eq.${activeMap}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as { id: string; source_id: string; target_id: string };
            setEdges((eds) => eds.some((e) => e.id === row.id) ? eds : [...eds, {
              id: row.id, source: row.source_id, target: row.target_id, type: "smoothstep",
            }]);
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id: string };
            setEdges((eds) => eds.filter((e) => e.id !== row.id));
          }
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeMap, user, setNodes, setEdges, buildData]);

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
          <Button variant="outline" size="sm" onClick={() => setNewMap(true)}>
            <Plus className="h-4 w-4 mr-2" />Novo mapa
          </Button>
          <Button variant="outline" size="sm" onClick={relayout} disabled={!activeMap || nodes.length === 0}>
            <LayoutGrid className="h-4 w-4 mr-2" />Auto-layout
          </Button>
          <Button variant="outline" size="sm" onClick={() => fitView({ duration: 400, padding: 0.2 })} disabled={!activeMap}>
            <Maximize2 className="h-4 w-4 mr-2" />Centralizar
          </Button>
          <Button size="sm" onClick={() => {
            const sel = selectedRef.current;
            if (sel) void addChildRef.current(sel);
            else void addRoot("Ideia central");
          }} disabled={!activeMap}>
            <Plus className="h-4 w-4 mr-2" />Nova ideia
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
        ) : nodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Brain className="h-16 w-16 opacity-20" />
            <p className="text-lg font-medium">Mapa vazio — crie sua ideia central.</p>
            <Button onClick={() => addRoot("Ideia central")}>
              <Plus className="h-4 w-4 mr-2" />Criar ideia central
            </Button>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { strokeWidth: 2, stroke: "hsl(var(--muted-foreground) / 0.4)" },
            }}
            fitView
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="hsl(var(--border))" gap={24} size={1} />
            <Controls showInteractive={false} className="!shadow-md !border !rounded-lg" />
            <MiniMap pannable zoomable className="!bg-background !border !rounded-lg" />
          </ReactFlow>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-background/95 backdrop-blur border rounded-full flex gap-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground shadow-sm">
          <span className="flex items-center gap-1.5"><kbd className="bg-muted px-1.5 py-0.5 rounded">Tab</kbd> Filho</span>
          <span className="flex items-center gap-1.5"><kbd className="bg-muted px-1.5 py-0.5 rounded">Enter</kbd> Irmão</span>
          <span className="flex items-center gap-1.5"><kbd className="bg-muted px-1.5 py-0.5 rounded">↑↓←→</kbd> Navegar</span>
          <span className="flex items-center gap-1.5"><kbd className="bg-muted px-1.5 py-0.5 rounded">Del</kbd> Excluir</span>
          <span className="flex items-center gap-1.5"><kbd className="bg-muted px-1.5 py-0.5 rounded">2× clique</kbd> Editar</span>
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
