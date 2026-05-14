
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, MessageSquare, Send, ArrowLeft, MoreVertical, Layout, PlusCircle, Maximize2, ChevronLeft, ChevronRight, GripVertical, ZoomIn, ZoomOut, Search } from 'lucide-react';
import { BrainstormMap, MindMapNode, ChatMessage } from './data/types';
import DOMPurify from 'dompurify';

export function BrainstormModule({
    maps,
    onSaveMaps,
    activeMapId,
    setActiveMapId,
    sidebarMode,
    setSidebarMode
}: {
    maps: BrainstormMap[],
    onSaveMaps: (newMaps: BrainstormMap[]) => void,
    activeMapId: string | null,
    setActiveMapId: (id: string | null) => void,
    sidebarMode: 'expanded' | 'collapsed' | 'hidden',
    setSidebarMode: (m: 'expanded' | 'collapsed' | 'hidden') => void
}) {

    const activeMap = maps.find(m => m.id === activeMapId);

    const handleCreateMap = () => {
        const title = prompt("Título do mapa mental:");
        if (!title) return;

        const newMap: BrainstormMap = {
            id: `map_${Date.now()}`,
            title,
            nodes: [
                { id: 'root', parentId: null, text: 'Digite sua ideia...', position: { x: 0, y: 0 }, depth: 0 }
            ],
            chatMessages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const updatedMaps = [...maps, newMap];
        onSaveMaps(updatedMaps);
        setActiveMapId(newMap.id);
    };

    const updateMap = (updated: BrainstormMap, logAction?: string) => {
        if (logAction) {
            const history = updated.history || [];
            updated.history = [...history, { id: `hist_${Date.now()}`, action: logAction, userId: 'u1', timestamp: new Date().toISOString() }];
        }
        onSaveMaps(maps.map(m => m.id === updated.id ? updated : m));
    };

    const deleteMap = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Deseja excluir este mapa mental?")) {
            onSaveMaps(maps.filter(m => m.id !== id));
        }
    };

    if (activeMapId && activeMap) {
        return (
            <MindMapEditor
                map={activeMap}
                onClose={() => setActiveMapId(null)}
                onUpdate={updateMap}
                sidebarMode={sidebarMode}
                setSidebarMode={setSidebarMode}
            />
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-12 px-8">
            <div className="flex items-center justify-between mb-16">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-widest uppercase mb-2">Seus Mapas Mentais</h2>
                    <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">Organização Visual de Insights</p>
                </div>
                <button
                    onClick={handleCreateMap}
                    className="flex items-center gap-4 bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-2xl shadow-indigo-600/20 active:scale-95"
                >
                    <PlusCircle size={20} />
                    Novo Mapa Mental
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {maps.map(map => (
                    <div
                        key={map.id}
                        onClick={() => setActiveMapId(map.id)}
                        className="glass-panel p-10 rounded-[50px] border border-white/5 bg-black/40 hover:border-indigo-500/40 transition-all group cursor-pointer shadow-2xl flex flex-col min-h-[300px]"
                    >
                        <div className="flex justify-between items-start mb-10">
                            <div className="p-5 rounded-[24px] bg-indigo-600/10 text-indigo-400 group-hover:scale-110 transition-transform">
                                <Layout size={32} />
                            </div>
                            <button
                                onClick={(e) => deleteMap(map.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-3 text-zinc-700 hover:text-red-400 transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <h3 className="text-3xl font-black text-white mb-4 line-clamp-2 leading-tight group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{map.title}</h3>

                        <div className="mt-auto pt-8 border-t border-white/5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">{map.nodes.length} NÓS ATIVOS</span>
                            <span className="text-[9px] font-bold text-zinc-500">{new Date(map.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
                {maps.length === 0 && (
                    <div className="col-span-full py-40 flex flex-col items-center justify-center text-zinc-700 space-y-6">
                        <Layout size={80} className="opacity-10" />
                        <p className="font-black uppercase tracking-[0.3em] text-xl">Prepare seu próximo grande salto</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MindMapEditor({ map, onClose, onUpdate, sidebarMode, setSidebarMode }: { map: BrainstormMap, onClose: () => void, onUpdate: (m: BrainstormMap, log?: string) => void, sidebarMode: 'expanded' | 'collapsed' | 'hidden', setSidebarMode: (m: 'expanded' | 'collapsed' | 'hidden') => void }) {
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMsg, setChatMsg] = useState("");
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Initial Center
    useEffect(() => {
        setPanOffset({
            x: -2500 + window.innerWidth / 2,
            y: -2500 + window.innerHeight / 2
        });
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Start panning if clicking on background or canvas-area elements
        const target = e.target as HTMLElement;
        if (target.classList.contains('canvas-area') || target.tagName === 'svg' || target === canvasRef.current || target.parentElement?.classList.contains('canvas-area')) {
            setIsPanning(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (editingNodeId || (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')) return;

            const selectedNode = map.nodes.find(n => n.id === selectedNodeId) || map.nodes[0];

            if (e.key === 'Enter') {
                e.preventDefault();
                addSibling(selectedNode);
            } else if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                addChild(selectedNode);
            } else if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                goToParent(selectedNode);
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                deleteNode(selectedNode.id);
            } else if (e.key === 'Escape') {
                setEditingNodeId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [map.nodes, editingNodeId, selectedNodeId]);

    const addSibling = (node: MindMapNode) => {
        if (node.id === 'root') return;
        const newNode: MindMapNode = {
            id: `node_${Date.now()}`,
            parentId: node.parentId,
            text: 'Nova Ideia',
            position: { x: node.position.x, y: node.position.y + 120 },
            depth: node.depth
        };
        const updated = { ...map, nodes: [...map.nodes, newNode], updatedAt: new Date().toISOString() };
        onUpdate(updated, `Adicionou ideia: ${newNode.text}`);
        setSelectedNodeId(newNode.id);
        setEditingNodeId(newNode.id);
    };

    const addChild = (node: MindMapNode) => {
        const newNode: MindMapNode = {
            id: `node_${Date.now()}`,
            parentId: node.id,
            text: 'Sub-ideia',
            position: { x: node.position.x + 280, y: node.position.y + (Math.random() * 40 - 20) },
            depth: node.depth + 1
        };
        const updated = { ...map, nodes: [...map.nodes, newNode], updatedAt: new Date().toISOString() };
        onUpdate(updated, `Adicionou sub-ideia: ${newNode.text}`);
        setSelectedNodeId(newNode.id);
        setEditingNodeId(newNode.id);
    };

    const goToParent = (node: MindMapNode) => {
        if (node.parentId) setSelectedNodeId(node.parentId);
    };

    const updateNodeText = (id: string, text: string) => {
        const updated = {
            ...map,
            nodes: map.nodes.map((n: MindMapNode) => n.id === id ? { ...n, text } : n),
            updatedAt: new Date().toISOString()
        };
        onUpdate(updated);
    };

    const deleteNode = (id: string) => {
        if (id === 'root') return;

        const getDescendants = (parentId: string): string[] => {
            const children = map.nodes.filter(n => n.parentId === parentId);
            let ids = children.map(c => c.id);
            children.forEach(c => {
                ids = [...ids, ...getDescendants(c.id)];
            });
            return ids;
        };

        const toDelete = [id, ...getDescendants(id)];
        const updated = {
            ...map,
            nodes: map.nodes.filter(n => !toDelete.includes(n.id)),
            updatedAt: new Date().toISOString()
        };
        onUpdate(updated, `Excluiu ideia e seus ramos`);
        setSelectedNodeId('root');
    };

    const handleSendMessage = () => {
        if (!chatMsg.trim()) return;
        const newMsg: ChatMessage = {
            id: `msg_${Date.now()}`,
            userId: 'u1', // Default user
            text: chatMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const updated = {
            ...map,
            chatMessages: [...map.chatMessages, { ...newMsg, text: DOMPurify.sanitize(chatMsg) }],
            updatedAt: new Date().toISOString()
        };
        onUpdate(updated);
        setChatMsg("");
    };

    return (
        <div className="flex h-full bg-[#09090b] overflow-hidden relative">
            {/* Sidebar UI remains? No, MindMap is full screen as specified */}

            <div className="flex-1 relative overflow-hidden flex flex-col cursor-grab active:cursor-grabbing">
                {/* Header toolbar */}
                <header className="px-12 py-10 flex items-center justify-between z-[210] bg-[#09090b]/80 backdrop-blur-md border-b border-white/5">
                    <div className="flex items-center gap-10">
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-white/5 text-zinc-400 hover:text-white transition-all group"
                            title="Voltar para Dashboard"
                        >
                            <ArrowLeft size={36} className="group-hover:scale-110 transition-transform" />
                        </button>
                        <div>
                            <h2 className="text-4xl font-black text-white tracking-widest uppercase">{map.title}</h2>
                            <p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em]">Laboratório de Insights</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pointer-events-auto">
                        {/* Zoom Controls */}
                        <div className="flex bg-white/5 rounded-full p-1 border border-white/5 mr-4 backdrop-blur-md shadow-2xl">
                            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-3 text-zinc-400 hover:text-white" title="Zoom Out">
                                <ZoomOut size={20} />
                            </button>
                            <div className="w-[1px] h-6 bg-white/5 self-center mx-1" />
                            <span className="text-[10px] font-black text-zinc-300 w-12 text-center uppercase tracking-widest">{Math.round(zoom * 100)}%</span>
                            <div className="w-[1px] h-6 bg-white/5 self-center mx-1" />
                            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-3 text-zinc-400 hover:text-white" title="Zoom In">
                                <ZoomIn size={20} />
                            </button>
                        </div>

                        <div className="flex bg-white/5 rounded-full p-1 border border-white/5 mr-4 backdrop-blur-md shadow-2xl">
                            <button onClick={() => setSidebarMode('collapsed')} className={`p-3 rounded-full transition-all ${sidebarMode === 'collapsed' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'}`} title="Compactar Sidebar">
                                <ChevronRight size={20} />
                            </button>
                            <button onClick={() => setSidebarMode('expanded')} className={`p-3 rounded-full transition-all ${sidebarMode === 'expanded' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'}`} title="Expandir Sidebar">
                                <Maximize2 size={20} />
                            </button>
                        </div>
                        <button onClick={onClose} className="p-5 glass-panel rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-all group">
                            <X size={32} className="group-hover:rotate-90 transition-transform" />
                        </button>
                    </div>
                </header>

                {/* Mind Map Canvas */}
                <div
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="flex-1 bg-[radial-gradient(#1e1e24_1px,transparent_1px)] bg-[size:40px_40px] relative cursor-grab active:cursor-grabbing overflow-hidden selection:bg-indigo-500/30 canvas-area"
                >
                    <div
                        className="absolute inset-0 canvas-area"
                        style={{
                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                            width: '5000px',
                            height: '5000px',
                            cursor: isPanning ? 'grabbing' : 'grab'
                        }}
                    >
                        {/* Render Edges (Lines) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible canvas-area">
                            {map.nodes.map((node: MindMapNode) => {
                                if (!node.parentId) return null;
                                const parent = map.nodes.find((n: MindMapNode) => n.id === node.parentId);
                                if (!parent) return null;

                                // Center relative to 2500, 2500 (middle of 5000x5000)
                                const px = 2500 + parent.position.x;
                                const py = 2500 + parent.position.y;
                                const nx = 2500 + node.position.x;
                                const ny = 2500 + node.position.y;

                                return (
                                    <motion.line
                                        key={`${parent.id}-${node.id}`}
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        x1={px + 90} y1={py + 30} x2={nx + 90} y2={ny + 30}
                                        stroke="#4f46e5"
                                        strokeWidth="3"
                                        strokeOpacity="0.3"
                                        strokeDasharray="8 4"
                                    />
                                );
                            })}
                        </svg>

                        {/* Render Nodes */}
                        <div className="absolute top-[2500px] left-[2500px]">
                            {map.nodes.map((node: MindMapNode) => (
                                <motion.div
                                    key={node.id}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    style={{
                                        position: 'absolute',
                                        left: node.position.x,
                                        top: node.position.y,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                    className={`min-w-[180px] p-6 rounded-[30px] border shadow-2xl group transition-all cursor-pointer ${node.id === 'root'
                                        ? 'bg-indigo-600 border-indigo-400 text-white scale-110 z-50'
                                        : 'bg-[#0f0f12] border-white/5 text-zinc-200 hover:border-indigo-500/40 z-20'
                                        } ${selectedNodeId === node.id ? 'ring-4 ring-indigo-500/60 shadow-[0_0_30px_rgba(79,70,229,0.3)]' : ''}`}
                                    onClick={() => setSelectedNodeId(node.id)}
                                    onDoubleClick={() => { setSelectedNodeId(node.id); setEditingNodeId(node.id); }}
                                >
                                    <div className="relative">
                                        {editingNodeId === node.id ? (
                                            <input
                                                autoFocus
                                                value={node.text}
                                                onChange={(e) => updateNodeText(node.id, e.target.value)}
                                                onBlur={() => setEditingNodeId(null)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') setEditingNodeId(null);
                                                    if (e.key === 'Escape') setEditingNodeId(null);
                                                }}
                                                className="w-full bg-white/10 text-white rounded-lg px-2 py-1 outline-none border border-white/20 text-center font-bold"
                                            />
                                        ) : (
                                            <div className="text-center font-bold text-sm tracking-tight">{node.text}</div>
                                        )}

                                        <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex flex-col gap-2">
                                            <button
                                                onClick={() => {
                                                    // Child addition relative logic
                                                    const newNode: MindMapNode = {
                                                        id: `node_${Date.now()}`,
                                                        parentId: node.id,
                                                        text: 'Nova Ideia',
                                                        position: { x: node.position.x + 240, y: node.position.y + (Math.random() * 40 - 20) },
                                                        depth: node.depth + 1
                                                    };
                                                    onUpdate({ ...map, nodes: [...map.nodes, newNode], updatedAt: new Date().toISOString() });
                                                }}
                                                className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                                            >
                                                <Plus size={16} />
                                            </button>
                                            {node.id !== 'root' && (
                                                <button
                                                    onClick={() => deleteNode(node.id)}
                                                    className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-500 hover:text-red-400 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all border border-white/5"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Shortcuts Legend */}
                <div className="absolute bottom-8 left-8 glass-panel px-6 py-4 rounded-[24px] pointer-events-none flex gap-8 items-center border border-white/5 shadow-2xl bg-black/40 backdrop-blur-md">
                    <div className="flex gap-2 items-center">
                        <span className="bg-white/10 text-[9px] font-black text-white px-2 py-1 rounded-lg border border-white/10 uppercase tracking-widest">Enter</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Irmão</span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="bg-white/10 text-[9px] font-black text-white px-2 py-1 rounded-lg border border-white/10 uppercase tracking-widest">Tab</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Filho</span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="bg-white/10 text-[9px] font-black text-white px-2 py-1 rounded-lg border border-white/10 uppercase tracking-widest">Double Click</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Editar</span>
                    </div>
                </div>

                {/* Floating Chat Panel */}
                <AnimatePresence>
                    {chatOpen && (
                        <motion.div
                            initial={{ opacity: 0, x: 100, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.9 }}
                            className="absolute right-10 bottom-32 w-[450px] h-[600px] glass-panel flex flex-col z-[300] shadow-[0_30px_100px_rgba(0,0,0,0.8)] border border-white/10 rounded-[40px] overflow-hidden"
                        >
                            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-indigo-600/5 backdrop-blur-xl">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
                                        <MessageSquare size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white uppercase tracking-widest text-xs">Notas do Mapa</h3>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Histórico de Insights</p>
                                    </div>
                                </div>
                                <button onClick={() => setChatOpen(false)} className="p-3 text-zinc-500 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6 bg-[#09090b]/50">
                                {map.chatMessages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-4">
                                        <MessageSquare size={48} className="opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-[.3em]">Silêncio Criativo Absoluto</p>
                                    </div>
                                ) : (
                                    map.chatMessages.map(msg => (
                                        <div key={msg.id} className="flex flex-col">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                                    {msg.userId === 'u1' ? 'Marco' : 'AI Assistant'}
                                                </span>
                                                <span className="text-[10px] font-bold text-zinc-600">{msg.timestamp}</span>
                                            </div>
                                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-sm text-zinc-300 leading-relaxed">
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-8 border-t border-white/5 bg-black/40">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (chatMsg.trim()) {
                                            const newMessage: ChatMessage = {
                                                id: `msg_${Date.now()}`,
                                                userId: 'u1',
                                                text: chatMsg,
                                                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            };
                                            onUpdate({
                                                ...map,
                                                chatMessages: [...map.chatMessages, { ...newMessage, text: DOMPurify.sanitize(chatMsg) }],
                                                updatedAt: new Date().toISOString()
                                            }, `Enviou insight: ${DOMPurify.sanitize(chatMsg).substring(0, 20)}...`);
                                            setChatMsg("");
                                        }
                                    }}
                                    className="relative"
                                >
                                    <input
                                        type="text"
                                        value={chatMsg}
                                        onChange={(e) => setChatMsg(e.target.value)}
                                        placeholder="Anote um insight..."
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 pr-16 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-zinc-600"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all shadow-lg active:scale-95"
                                    >
                                        <Send size={18} />
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating Chat Button */}
                <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className={`fixed right-10 bottom-10 p-6 rounded-full shadow-2xl transition-all z-[310] group active:scale-95 ${chatOpen ? 'bg-zinc-800 text-white translate-y-[-10px]' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                >
                    {chatOpen ? <X size={28} /> : <MessageSquare size={28} className="group-hover:scale-110 transition-transform" />}
                </button>
            </div>
        </div>
    );
}
