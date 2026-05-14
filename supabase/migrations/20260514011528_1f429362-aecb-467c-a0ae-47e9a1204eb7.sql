
DELETE FROM public.brainstorm_connections;
DELETE FROM public.brainstorm_nodes;

CREATE TABLE public.mindmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.mindmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mm_select_own" ON public.mindmaps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mm_insert_own" ON public.mindmaps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mm_update_own" ON public.mindmaps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "mm_delete_own" ON public.mindmaps FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.brainstorm_nodes ADD COLUMN mindmap_id UUID;
ALTER TABLE public.brainstorm_connections ADD COLUMN mindmap_id UUID;

INSERT INTO public.mindmaps (user_id, name)
SELECT user_id, 'Principal' FROM public.profiles;

-- update handle_new_user to also create a default mindmap
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

  INSERT INTO public.kanban_boards (user_id, name, "order")
  VALUES (NEW.id, 'Geral', 1)
  RETURNING id INTO v_board_id;

  INSERT INTO public.kanban_categories (user_id, board_id, name, color, "order") VALUES
    (NEW.id, v_board_id, 'A Fazer', '#9CA3AF', 1),
    (NEW.id, v_board_id, 'Em Andamento', '#F59E0B', 2),
    (NEW.id, v_board_id, 'Concluído', '#10B981', 3);

  INSERT INTO public.mindmaps (user_id, name) VALUES (NEW.id, 'Principal');

  RETURN NEW;
END;
$function$;
