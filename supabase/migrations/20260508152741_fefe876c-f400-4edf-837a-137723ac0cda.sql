ALTER TABLE public.listings REPLICA IDENTITY FULL;
ALTER TABLE public.favorites REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.favorites;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;