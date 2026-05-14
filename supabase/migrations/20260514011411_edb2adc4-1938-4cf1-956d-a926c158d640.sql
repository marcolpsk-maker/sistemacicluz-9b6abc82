
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#FEF3C7';
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- migrate existing 'completed' boolean → status
UPDATE public.lembretes SET status = 'done' WHERE completed = true AND (status IS NULL OR status = 'pending');
