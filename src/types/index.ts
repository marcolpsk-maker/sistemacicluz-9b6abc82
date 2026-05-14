import type { Database } from "@/integrations/supabase/types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Profile = Tables<"profiles">;
export type Area = Tables<"areas">;
export type KanbanBoard = Tables<"kanban_boards">;
export type KanbanCategory = Tables<"kanban_categories">;
export type KanbanCard = Tables<"kanban_cards">;
export type Lembrete = Tables<"lembretes">;
export type Reuniao = Tables<"reunioes">;
export type Evento = Tables<"eventos">;
export type ChatMessage = Tables<"chat_messages">;
export type BrainstormNode = Tables<"brainstorm_nodes">;
export type BrainstormConnection = Tables<"brainstorm_connections">;

export type Priority = "low" | "medium" | "high";
