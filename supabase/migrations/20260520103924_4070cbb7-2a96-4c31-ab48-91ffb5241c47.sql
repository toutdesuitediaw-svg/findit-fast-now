-- Préférences de notifications
CREATE TABLE public.notification_preferences (
  user_id UUID NOT NULL PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  premium_only BOOLEAN NOT NULL DEFAULT true,
  categories UUID[] NOT NULL DEFAULT '{}',
  city TEXT,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own prefs" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prefs" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prefs" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own prefs" ON public.notification_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Création automatique au signup
CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_default_notification_prefs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_create_default_notif_prefs ON public.profiles;
CREATE TRIGGER trg_create_default_notif_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_prefs();

-- Seed pour utilisateurs existants
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Trigger : notifier sur nouvelle annonce premium
CREATE OR REPLACE FUNCTION public.notify_new_premium_listing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_notify boolean := false;
  v_body text;
  v_price text;
BEGIN
  -- Seulement quand l'annonce devient premium + active
  IF TG_OP = 'INSERT' THEN
    v_should_notify := NEW.is_premium = true AND NEW.is_active = true AND NEW.moderation_status = 'approved';
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_notify := NEW.is_premium = true AND NEW.is_active = true AND NEW.moderation_status = 'approved'
                   AND (OLD.is_premium = false OR OLD.is_active = false);
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  v_price := CASE
    WHEN NEW.price IS NOT NULL THEN '💰 ' || NEW.price::text || ' ' || COALESCE(NEW.currency, 'FCFA')
    ELSE ''
  END;
  v_body := '"' || NEW.title || '"'
            || CASE WHEN NEW.location IS NOT NULL THEN E'\n📍 ' || NEW.location ELSE '' END
            || CASE WHEN v_price <> '' THEN E'\n' || v_price ELSE '' END;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT
    p.user_id,
    'new_premium_listing',
    '🔥 Nouvelle annonce premium',
    v_body,
    '/annonces/' || NEW.id,
    jsonb_build_object('listing_id', NEW.id, 'category_id', NEW.category_id, 'city', NEW.location)
  FROM public.notification_preferences p
  WHERE p.enabled = true
    AND p.user_id <> NEW.user_id
    AND (array_length(p.categories, 1) IS NULL OR NEW.category_id = ANY(p.categories))
    AND (p.city IS NULL OR p.city = '' OR NEW.location ILIKE '%' || p.city || '%');

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_new_premium_listing() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_new_premium_listing
  AFTER INSERT OR UPDATE OF is_premium, is_active, moderation_status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_premium_listing();