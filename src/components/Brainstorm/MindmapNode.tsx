import { Handle, Position } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

export function MindmapNode({ data, selected, id }: any) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setEditing(false);
      data.onEdit?.(id, value);
      // Create sibling if not editing
      if (!editing) {
        data.onAddSibling?.(id);
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      data.onAddChild?.(id);
    }
    if (e.key === "Escape") {
      setEditing(false);
      setValue(data.label);
    }
  };

  const isMain = data.isMain;

  return (
    <div className={cn(
      "group relative px-6 py-3 rounded-full font-bold transition-all duration-300 border-2",
      selected ? "ring-4 ring-primary/30 scale-105 border-white" : "border-transparent",
      isMain ? "text-lg shadow-[0_0_20px_rgba(59,130,246,0.5)] bg-blue-600" : "bg-[#1A1A1A] text-white/90 shadow-lg",
      "text-white flex items-center gap-2"
    )}
    style={{ backgroundColor: isMain ? "#3b82f6" : (data.color || "#1A1A1A") }}>
      
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-white border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { setEditing(false); data.onEdit?.(id, value); }}
          className="bg-transparent border-none outline-none text-center w-full min-w-[80px]"
        />
      ) : (
        <div 
          className="min-w-[60px] max-w-[200px] text-center outline-none cursor-text break-words select-none"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {data.label || "Novo nó"}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-white border-none opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Action Buttons */}
      <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); data.onAddChild?.(id); }}
          className="bg-white text-primary rounded-full p-1 shadow-xl hover:scale-110 transition-transform"
        >
          <Plus className="h-3 w-3" />
        </button>
        {!isMain && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
            className="bg-white text-destructive rounded-full p-1 shadow-xl hover:scale-110 transition-transform"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
