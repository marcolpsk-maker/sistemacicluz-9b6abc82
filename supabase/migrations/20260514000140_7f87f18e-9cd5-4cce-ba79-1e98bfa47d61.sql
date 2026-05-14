
-- ========== TABLES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'layout-dashboard',
  color TEXT DEFAULT '#4F46E5',
  route TEXT,
  "order" INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.kanban_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4F46E5',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.kanban_categories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  status TEXT DEFAULT 'todo',
  due_date TIMESTAMPTZ,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.lembretes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  participants TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  type TEXT DEFAULT 'event',
  color TEXT DEFAULT '#4F46E5',
  reuniao_id UUID REFERENCES public.reunioes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.brainstorm_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.brainstorm_nodes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'idea',
  status TEXT DEFAULT 'todo',
  color TEXT DEFAULT '#4F46E5',
  icon TEXT DEFAULT 'lightbulb',
  position JSONB DEFAULT '{"x":0,"y":0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.brainstorm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_id UUID REFERENCES public.brainstorm_nodes(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES public.brainstorm_nodes(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== ENABLE RLS ==========
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainstorm_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainstorm_connections ENABLE ROW LEVEL SECURITY;

-- ========== RLS POLICIES (per-operation) ==========
-- profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- areas
CREATE POLICY "areas_select_own" ON public.areas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "areas_insert_own" ON public.areas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "areas_update_own" ON public.areas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "areas_delete_own" ON public.areas FOR DELETE USING (auth.uid() = user_id);

-- kanban_categories
CREATE POLICY "kc_select_own" ON public.kanban_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kc_insert_own" ON public.kanban_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kc_update_own" ON public.kanban_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kc_delete_own" ON public.kanban_categories FOR DELETE USING (auth.uid() = user_id);

-- kanban_cards
CREATE POLICY "kcards_select_own" ON public.kanban_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kcards_insert_own" ON public.kanban_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kcards_update_own" ON public.kanban_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kcards_delete_own" ON public.kanban_cards FOR DELETE USING (auth.uid() = user_id);

-- lembretes
CREATE POLICY "lembretes_select_own" ON public.lembretes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lembretes_insert_own" ON public.lembretes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lembretes_update_own" ON public.lembretes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lembretes_delete_own" ON public.lembretes FOR DELETE USING (auth.uid() = user_id);

-- reunioes
CREATE POLICY "reunioes_select_own" ON public.reunioes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reunioes_insert_own" ON public.reunioes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reunioes_update_own" ON public.reunioes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reunioes_delete_own" ON public.reunioes FOR DELETE USING (auth.uid() = user_id);

-- eventos
CREATE POLICY "eventos_select_own" ON public.eventos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "eventos_insert_own" ON public.eventos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "eventos_update_own" ON public.eventos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "eventos_delete_own" ON public.eventos FOR DELETE USING (auth.uid() = user_id);

-- chat_messages
CREATE POLICY "chat_select_own" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_insert_own" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_update_own" ON public.chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "chat_delete_own" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- brainstorm_nodes
CREATE POLICY "bnodes_select_own" ON public.brainstorm_nodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bnodes_insert_own" ON public.brainstorm_nodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bnodes_update_own" ON public.brainstorm_nodes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bnodes_delete_own" ON public.brainstorm_nodes FOR DELETE USING (auth.uid() = user_id);

-- brainstorm_connections
CREATE POLICY "bconn_select_own" ON public.brainstorm_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bconn_insert_own" ON public.brainstorm_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bconn_update_own" ON public.brainstorm_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bconn_delete_own" ON public.brainstorm_connections FOR DELETE USING (auth.uid() = user_id);

-- ========== UPDATED_AT TRIGGER ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== HANDLE_NEW_USER ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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

  -- default kanban columns
  INSERT INTO public.kanban_categories (user_id, name, color, "order") VALUES
    (NEW.id, 'A Fazer', '#9CA3AF', 1),
    (NEW.id, 'Em Andamento', '#F59E0B', 2),
    (NEW.id, 'Concluído', '#10B981', 3);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== STORAGE BUCKET ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========== REALTIME ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lembretes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reunioes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brainstorm_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brainstorm_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.areas;
