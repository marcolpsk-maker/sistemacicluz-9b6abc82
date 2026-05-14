import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Bell, Calendar, Bot, Video, Brain, User, Settings,
  Folder, FileText, ChartBar, Target, Zap, Star, Heart, KanbanSquare,
  ClipboardList, Lightbulb, Rocket, Briefcase, MessageSquare, Globe,
} from "lucide-react";

const ICONS = [
  { name: "layout-dashboard", Icon: LayoutDashboard },
  { name: "kanban-square", Icon: KanbanSquare },
  { name: "bell", Icon: Bell },
  { name: "calendar", Icon: Calendar },
  { name: "bot", Icon: Bot },
  { name: "video", Icon: Video },
  { name: "brain", Icon: Brain },
  { name: "user", Icon: User },
  { name: "settings", Icon: Settings },
  { name: "folder", Icon: Folder },
  { name: "file-text", Icon: FileText },
  { name: "chart-bar", Icon: ChartBar },
  { name: "target", Icon: Target },
  { name: "zap", Icon: Zap },
  { name: "star", Icon: Star },
  { name: "heart", Icon: Heart },
  { name: "clipboard-list", Icon: ClipboardList },
  { name: "lightbulb", Icon: Lightbulb },
  { name: "rocket", Icon: Rocket },
  { name: "briefcase", Icon: Briefcase },
  { name: "message-square", Icon: MessageSquare },
  { name: "globe", Icon: Globe },
];

const COLORS = [
  "#4F46E5", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

export interface AreaDialogValue {
  name: string;
  icon: string;
  color: string;
}

interface AreaDialogProps {
  open: boolean;
  title?: string;
  initial?: Partial<AreaDialogValue>;
  onConfirm: (value: AreaDialogValue) => void | Promise<void>;
  onCancel: () => void;
}

export function AreaDialog({
  open, title = "Nova área", initial, onConfirm, onCancel,
}: AreaDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "folder");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setIcon(initial?.icon ?? "folder");
      setColor(initial?.color ?? COLORS[0]);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="area-name">Nome</Label>
            <Input id="area-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex: Marketing" />
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="grid grid-cols-8 gap-1.5 p-2 border rounded-md max-h-48 overflow-y-auto">
              {ICONS.map(({ name: n, Icon }) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIcon(n)}
                  className={cn(
                    "h-9 w-9 flex items-center justify-center rounded-md transition-colors hover:bg-muted",
                    icon === n && "bg-primary-light ring-2 ring-primary"
                  )}
                  aria-label={n}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full transition-transform hover:scale-110",
                    color === c && "ring-2 ring-offset-2 ring-foreground"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!name.trim()} onClick={() => onConfirm({ name: name.trim(), icon, color })}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
