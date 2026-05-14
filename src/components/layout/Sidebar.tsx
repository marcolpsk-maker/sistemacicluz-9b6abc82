import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Pencil, Trash2, LogOut, Menu, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAreas } from "@/hooks/useAreas";
import { getIcon } from "@/lib/icons";
import { AreaDialog, type AreaDialogValue } from "@/components/modals/AreaDialog";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import type { Area } from "@/types";

function SortableArea({
  area, isActive, onEdit, onDelete,
}: { area: Area; isActive: boolean; onEdit: (a: Area) => void; onDelete: (a: Area) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: area.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = getIcon(area.icon);

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center">
      <button
        {...attributes} {...listeners}
        className="touch-none p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        aria-label="Arrastar"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <Link
        to={area.route ?? "/"}
        className={cn(
          "flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
          isActive ? "bg-primary-light text-primary" : "text-foreground hover:bg-muted"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color: isActive ? undefined : area.color ?? undefined }} />
        <span className="truncate">{area.name}</span>
      </Link>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1">
        <button onClick={() => onEdit(area)} className="p-1 rounded hover:bg-muted" aria-label="Editar">
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
        {!area.is_default && (
          <button onClick={() => onDelete(area)} className="p-1 rounded hover:bg-destructive-light" aria-label="Excluir">
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { areas, createArea, updateArea, deleteArea, reorderAreas } = useAreas(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [deleting, setDeleting] = useState<Area | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = areas.findIndex((a) => a.id === active.id);
    const newIdx = areas.findIndex((a) => a.id === over.id);
    reorderAreas(arrayMove(areas, oldIdx, newIdx));
  };

  const handleCreate = async (v: AreaDialogValue) => {
    await createArea(v);
    setCreating(false);
  };

  const handleEdit = async (v: AreaDialogValue) => {
    if (!editing) return;
    await updateArea(editing.id, v);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteArea(deleting.id);
    setDeleting(null);
  };

  const initials = (user?.user_metadata?.name as string | undefined)?.trim()?.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase()
    ?? user?.email?.[0]?.toUpperCase() ?? "?";

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 py-5 border-b">
        <Link to="/dashboard" className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-primary)" }}>
          CICLUZ
        </Link>
        <button className="md:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={areas.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }} className="space-y-0.5">
              {areas.map((a) => (
                <motion.div key={a.id} variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}>
                  <SortableArea
                    area={a}
                    isActive={pathname === a.route}
                    onEdit={(area) => setEditing(area)}
                    onDelete={(area) => setDeleting(area)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </SortableContext>
        </DndContext>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCreating(true)}
          className="w-full mt-3 justify-start text-muted-foreground hover:text-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar área
        </Button>
      </nav>

      <div className="border-t px-3 py-3 flex items-center gap-2.5">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {(user?.user_metadata?.name as string | undefined) ?? user?.email}
          </p>
        </div>
        <button
          onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        className="md:hidden fixed top-3 left-3 z-30 p-2 rounded-md bg-background border shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar border-r min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r flex flex-col"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AreaDialog
        open={creating}
        title="Nova área"
        onConfirm={handleCreate}
        onCancel={() => setCreating(false)}
      />
      <AreaDialog
        open={!!editing}
        title="Editar área"
        initial={editing ? { name: editing.name, icon: editing.icon, color: editing.color ?? "#4F46E5" } : undefined}
        onConfirm={handleEdit}
        onCancel={() => setEditing(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Excluir área"
        message={deleting ? `Tem certeza que deseja excluir a área "${deleting.name}"?` : ""}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
