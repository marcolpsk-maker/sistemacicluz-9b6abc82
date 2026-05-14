import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import type { Lembrete } from "@/types";
import { toast } from "sonner";

export function useCalendarTasks(userId: string | undefined, date: Date | null) {
  const [tasks, setTasks] = useState<Lembrete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !date) {
      setTasks([]);
      setLoading(false);
      return;
    }

    let active = true;
    const loadTasks = async () => {
      setLoading(true);
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();
      
      const { data, error } = await supabase
        .from("lembretes")
        .select("*")
        .gte("due_date", start)
        .lte("due_date", end)
        .order("order");

      if (active) {
        if (!error && data) {
          // Normaliza status nulos
          setTasks(data.map(t => ({ ...t, status: t.status || "todo" })));
        } else {
          setTasks([]);
        }
        setLoading(false);
      }
    };

    loadTasks();

    const start = startOfDay(date).toISOString();
    const end = endOfDay(date).toISOString();

    const ch = supabase.channel(`calendar-tasks-${date.toISOString()}`)
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "lembretes" 
      }, loadTasks)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [userId, date]);

  const addTask = async (title: string, status: string = "todo") => {
    if (!userId || !date) return;
    const targetDate = startOfDay(date);
    // Add current time to the date so it doesn't default to midnight if needed, 
    // or just store the day. We'll store it at noon to be safe from timezone issues.
    targetDate.setHours(12);
    
    const { error } = await supabase.from("lembretes").insert({
      user_id: userId,
      title,
      due_date: targetDate.toISOString(),
      status,
      order: tasks.length
    });

    if (error) {
      toast.error("Erro ao criar tarefa");
    } else {
      toast.success("Tarefa criada");
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const { error } = await supabase.from("lembretes").update({ status: newStatus }).eq("id", taskId);
    if (error) {
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from("lembretes").delete().eq("id", taskId);
    if (error) {
      toast.error("Erro ao deletar tarefa");
    } else {
      toast.success("Tarefa deletada");
    }
  };

  const updateTaskTitle = async (taskId: string, newTitle: string) => {
    const { error } = await supabase.from("lembretes").update({ title: newTitle }).eq("id", taskId);
    if (error) {
      toast.error("Erro ao atualizar título");
    }
  };

  return { tasks, loading, addTask, updateTaskStatus, deleteTask, updateTaskTitle };
}
