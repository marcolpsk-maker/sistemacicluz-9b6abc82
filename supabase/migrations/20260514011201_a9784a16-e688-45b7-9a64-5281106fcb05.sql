
-- Drop existing data (destructive migration approved by user)
DELETE FROM public.kanban_cards;
DELETE FROM public.kanban_categories;

-- Create kanban_boards
CREATE TABLE public.kanban_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4F46E5',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_select_own" ON public.kanban_boards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kb_insert_own" ON public.kanban_boards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kb_update_own" ON public.kanban_boards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kb_delete_own" ON public.kanban_boards FOR DELETE USING (auth.uid() = user_id);

-- Add board_id to kanban_categories
ALTER TABLE public.kanban_categories ADD COLUMN board_id UUID;

-- Extend kanban_cards
ALTER TABLE public.kanban_cards ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.kanban_cards ADD COLUMN color TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN assigned_to UUID;

-- Create default board for each existing user
INSERT INTO public.kanban_boards (user_id, name, "order")
SELECT user_id, 'Geral', 1 FROM public.profiles;

-- Create default columns for each board
INSERT INTO public.kanban_categories (user_id, board_id, name, color, "order")
SELECT b.user_id, b.id, c.name, c.color, c."order"
FROM public.kanban_boards b
CROSS JOIN (VALUES
  ('A Fazer', '#9CA3AF', 1),
  ('Em Andamento', '#F59E0B', 2),
  ('Concluído', '#10B981', 3)
) AS c(name, color, "order");

-- Make board_id required going forward
ALTER TABLE public.kanban_categories ALTER COLUMN board_id SET NOT NULL;

-- Update handle_new_user to create a default board + columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_board_id UUID;
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.areas (user_id, name, icon, route, "order", is_default) VALUES
    (NEW.id, 'Dashboard', 'layout-dashboard', '/dashboard', 1, true),
    (NEW.id, 'Kanban', 'kanban-square', '/kanban', 2, true),
    (NEW.id, 'Chat IA', 'bot', '/chat', 3, true),
    (NEW.id, 'Lembretes', 'bell', '/lembretes', 4, true),
    (NEW.id, 'Reuniões', 'video', '/reunioes', 5, true),
    (NEW.id, 'Calendário', 'calendar', '/calendario', 6, true),
    (NEW.id, 'Brainstorm', 'brain', '/brainstorm', 7, true),
    (NEW.id, 'Perfil', 'user', '/perfil', 8, true),
    (NEW.id, 'Admin', 'settings', '/admin', 9, true);

  -- default board
  INSERT INTO public.kanban_boards (user_id, name, "order")
  VALUES (NEW.id, 'Geral', 1)
  RETURNING id INTO v_board_id;

  INSERT INTO public.kanban_categories (user_id, board_id, name, color, "order") VALUES
    (NEW.id, v_board_id, 'A Fazer', '#9CA3AF', 1),
    (NEW.id, v_board_id, 'Em Andamento', '#F59E0B', 2),
    (NEW.id, v_board_id, 'Concluído', '#10B981', 3);

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
