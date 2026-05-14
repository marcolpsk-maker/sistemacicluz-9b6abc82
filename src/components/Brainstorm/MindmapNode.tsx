import { Handle, Position, NodeProps } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

export interface MindmapNodeData {
  label: string;
  isMain?: boolean;
  autoEdit?: boolean;
  onEdit?: (id: string, value: string) => void;
  onDelete?: (id: string) => void;
  onAddChild?: (id: string) => void;
}

export function MindmapNode({ data, selected, id }: NodeProps) {
  const d = data as unknown as MindmapNodeData;
  const [editing, setEditing] = useState<boolean>(!!d.autoEdit);
  const [value, setValue] = useState(d.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(d.label); }, [d.label]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = value.trim();
    if (v && v !== d.label) d.onEdit?.(id, v);
    else setValue(d.label);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); setEditing(false); setValue(d.label); }
  };

  const isMain = !!d.isMain;

  return (
    <div className={cn(
      "group relative px-5 py-2.5 rounded-2xl font-medium transition-all border flex items-center gap-2 select-none",
      selected
        ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
        : "shadow-sm hover:shadow-md",
      isMain
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-card-foreground border-border hover:border-primary/40",
    )}>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-primary !border-0 opacity-0" />

      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className={cn(
            "bg-transparent border-none outline-none text-center min-w-[100px] max-w-[220px]",
            isMain ? "text-primary-foreground placeholder:text-primary-foreground/60" : "text-foreground",
          )}
        />
      ) : (
        <div
          className={cn("min-w-[60px] max-w-[220px] text-center break-words text-sm", isMain && "text-base")}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
        >
          {d.label || "Nova ideia"}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-primary !border-0 opacity-0" />

      <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); d.onAddChild?.(id); }}
          className="bg-primary text-primary-foreground rounded-full p-1 shadow hover:scale-110 transition-transform"
          aria-label="Adicionar filho"
          title="Adicionar filho (Tab)"
        >
          <Plus className="h-3 w-3" />
        </button>
        {!isMain && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); d.onDelete?.(id); }}
            className="bg-card text-destructive rounded-full p-1 shadow hover:scale-110 transition-transform border border-border"
            aria-label="Excluir"
            title="Excluir (Delete)"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
