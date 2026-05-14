import { Handle, Position } from "@xyflow/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function MindmapNode({ data, selected, id }: any) {
  return (
    <div className={cn(
      "group relative px-4 py-2.5 rounded-lg font-medium shadow-sm transition-all border-2",
      selected ? "border-white ring-2 ring-primary/60 scale-105" : "border-transparent",
      "text-white"
    )}
    style={{ backgroundColor: data.color || "#4F46E5" }}>
      
      {/* Target handle handles incoming connections */}
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-white border-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div 
        className="min-w-[60px] max-w-[200px] text-center outline-none cursor-text break-words"
        onDoubleClick={(e) => {
          e.stopPropagation();
          data.onEdit?.(id, data.label);
        }}
      >
        {data.label || "Novo nó"}
      </div>

      {/* Source handle handles outgoing connections */}
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-white border-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Botão + para adicionar filho rapidamente (estilo MindMeister) */}
      <button
        type="button"
        onClick={(e) => { 
          e.stopPropagation(); 
          data.onAddChild?.(id); 
        }}
        className="absolute -right-3 top-1/2 -translate-y-1/2 bg-background text-primary border border-primary/20 rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-primary hover:text-white z-10"
        title="Adicionar ideia filha"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
