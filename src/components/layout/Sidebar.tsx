import { useEffect, useState } from "react";
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
import { Plus, GripVertical, Pencil, Trash2, LogOut, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAreas } from "@/hooks/useAreas";
import { getIcon } from "@/lib/icons";
import { AreaDialog, type AreaDialogValue } from "@/components/modals/AreaDialog";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import type { Area } from "@/types";

const STORAGE_KEY = "cicluz:sidebar:collapsed";

function SortableArea({
  area, isActive, collapsed, onEdit, onDelete,
}: { area: Area; isActive: boolean; collapsed: boolean; onEdit: (a: Area) => void; onDelete: (a: Area) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: area.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = getIcon(area.icon);

  if (collapsed) {
    return (
      <div ref={setNodeRef} style={style}>
        <Link
          to={area.route ?? "/"}
          title={area.name}
          className={cn(
            "flex items-center justify-center h-10 w-10 mx-auto rounded-lg transition-colors",
            isActive ? "bg-primary text-white" : "text-foreground hover:bg-muted"
          )}
        >
          <Icon className="h-4 w-4" style={{ color: isActive ? undefined : area.color ?? undefined }} />
        </Link>
      </div>
    );
  }

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
        <button type="button" onClick={() => onEdit(area)} className="p-1 rounded hover:bg-muted" aria-label="Editar">
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
        {!area.is_default && (
          <button type="button" onClick={() => onDelete(area)} className="p-1 rounded hover:bg-destructive-light" aria-label="Excluir">
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
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Initialize collapsed state: localStorage > viewport default (collapsed under 1024px)
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved !== null) {
      setCollapsed(saved === "1");
    } else if (typeof window !== "undefined") {
      setCollapsed(window.innerWidth < 1024);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

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

  const handleCreate = async (v: AreaDialogValue) => { await createArea(v); setCreating(false); };
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

  const mainItems = [
    { to: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", color: "#6366f1" },
    { to: "/kanban", label: "Planejamentos", icon: "Kanban", color: "#3b82f6" },
    { to: "/calendario", label: "Agenda", icon: "Calendar", color: "#10b981" },
    { to: "/brainstorm", label: "Brainstorm", icon: "Brain", color: "#a855f7" },
    { to: "/lembretes", label: "Lembretes", icon: "StickyNote", color: "#f59e0b" },
    { to: "/reunioes", label: "Reuniões", icon: "Video", color: "#ef4444" },
  ];

  // forceExpanded: used by the mobile drawer where we always want the full UI
  const sidebarContent = (forceExpanded = false) => {
    const isCollapsed = collapsed && !forceExpanded;
    return (
      <>
        <div className={cn("flex items-center border-b py-5", isCollapsed ? "justify-center px-2" : "justify-between px-4")}>
          {isCollapsed ? (
            <Link to="/dashboard" className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-primary)" }} title="CICLUZ">
              C
            </Link>
          ) : (
            <Link to="/dashboard" className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-primary)" }}>
              CICLUZ
            </Link>
          )}
          {!forceExpanded && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className={cn("hidden md:inline-flex p-1.5 rounded-md hover:bg-muted text-muted-foreground", isCollapsed && "absolute -right-3 top-6 bg-background border shadow-sm rounded-full")}
              aria-label={isCollapsed ? "Expandir menu" : "Colapsar menu"}
              title={isCollapsed ? "Expandir" : "Colapsar"}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
          {forceExpanded && (
            <button className="md:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto py-3 space-y-4", isCollapsed ? "px-1.5" : "px-2")}>
          {/* Main Navigation */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Principal</p>
            )}
            {mainItems.map((item) => {
              const Icon = getIcon(item.icon);
              const isActive = pathname === item.to;
              if (isCollapsed) {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={cn(
                      "flex items-center justify-center h-10 w-10 mx-auto rounded-lg transition-colors",
                      isActive ? "bg-primary text-white shadow-md shadow-primary/20" : "text-foreground/70 hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" style={{ color: isActive ? undefined : item.color }} />
                  </Link>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 group",
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "")} style={{ color: isActive ? undefined : item.color }} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Areas Navigation */}
          <div className="space-y-1 pt-4 border-t border-muted/50">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Áreas de Foco</p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Nova área"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {isCollapsed && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center justify-center h-10 w-10 mx-auto rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                aria-label="Nova área"
                title="Nova área"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={areas.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {areas.map((a) => (
                    <SortableArea
                      key={a.id}
                      area={a}
                      collapsed={isCollapsed}
                      isActive={pathname === a.route}
                      onEdit={(area) => setEditing(area)}
                      onDelete={(area) => setDeleting(area)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </nav>

        <div className={cn("border-t flex items-center", isCollapsed ? "flex-col gap-2 px-2 py-3" : "gap-2.5 px-3 py-3")}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {(user?.user_metadata?.name as string | undefined) ?? user?.email}
              </p>
            </div>
          )}
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </>
    );
  };

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

      {/* Desktop / Tablet */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col bg-sidebar border-r min-h-screen relative transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {sidebarContent(false)}
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
              {sidebarContent(true)}
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
