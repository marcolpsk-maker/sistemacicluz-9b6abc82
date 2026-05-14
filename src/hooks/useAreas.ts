import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Area } from "@/types";
import { toast } from "sonner";

export function useAreas(userId: string | undefined) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("areas")
      .select("*")
      .order("order", { ascending: true });
    if (error) {
      toast.error("Falha ao carregar áreas");
      return;
    }
    setAreas(data ?? []);
  }, [userId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    refresh().finally(() => setLoading(false));

    const channel = supabase
      .channel("areas-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "areas" },
        () => refresh()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, refresh]);

  const createArea = async (input: { name: string; icon: string; color: string; route?: string }) => {
    if (!userId) return;
    const nextOrder = areas.length + 1;
    const route = input.route ?? `/area/${input.name.toLowerCase().replace(/\s+/g, "-")}`;
    const { error } = await supabase.from("areas").insert({
      user_id: userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      route,
      order: nextOrder,
    });
    if (error) { toast.error("Falha ao criar área"); throw error; }
    toast.success("Área criada");
  };

  const updateArea = async (id: string, patch: Partial<Pick<Area, "name" | "icon" | "color">>) => {
    const { error } = await supabase.from("areas").update(patch).eq("id", id);
    if (error) { toast.error("Falha ao atualizar área"); throw error; }
    toast.success("Área atualizada");
  };

  const deleteArea = async (id: string) => {
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) { toast.error("Falha ao excluir área"); throw error; }
    toast.success("Área excluída");
  };

  const reorderAreas = async (ordered: Area[]) => {
    setAreas(ordered.map((a, i) => ({ ...a, order: i + 1 })));
    await Promise.all(
      ordered.map((a, i) =>
        supabase.from("areas").update({ order: i + 1 }).eq("id", a.id)
      )
    );
  };

  return { areas, loading, createArea, updateArea, deleteArea, reorderAreas, refresh };
}
