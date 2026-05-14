
-- 1) Listings lifecycle columns
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS published_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewed_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_renewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_notified_30d boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_notified_7d boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_notified_0d boolean NOT NULL DEFAULT false;

-- Backfill expires_at for legacy rows
UPDATE public.listings
   SET expires_at = COALESCE(expires_at, COALESCE(published_at, created_at, now()) + interval '365 days')
 WHERE expires_at IS NULL;

ALTER TABLE public.listings ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE public.listings ALTER COLUMN expires_at SET DEFAULT (now() + interval '365 days');

CREATE INDEX IF NOT EXISTS idx_listings_expires_at_active
  ON public.listings (expires_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_listings_archived_at
  ON public.listings (archived_at)
  WHERE archived_at IS NOT NULL;

-- 2) Lifecycle guard trigger: prevent client-side manipulation of lifecycle fields
CREATE OR REPLACE FUNCTION public.guard_listing_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;

  IF TG_OP = 'INSERT' THEN
    IF NOT is_admin THEN
      NEW.published_at := COALESCE(now(), NEW.published_at);
      NEW.expires_at := now() + interval '365 days';
      NEW.archived_at := NULL;
      NEW.renewed_count := 0;
      NEW.last_renewed_at := NULL;
      NEW.expiry_notified_30d := false;
      NEW.expiry_notified_7d := false;
      NEW.expiry_notified_0d := false;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT is_admin THEN
      NEW.published_at := OLD.published_at;
      NEW.expires_at := OLD.expires_at;
      NEW.archived_at := OLD.archived_at;
      NEW.renewed_count := OLD.renewed_count;
      NEW.last_renewed_at := OLD.last_renewed_at;
      NEW.expiry_notified_30d := OLD.expiry_notified_30d;
      NEW.expiry_notified_7d := OLD.expiry_notified_7d;
      NEW.expiry_notified_0d := OLD.expiry_notified_0d;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_listing_lifecycle ON public.listings;
CREATE TRIGGER trg_guard_listing_lifecycle
BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.guard_listing_lifecycle();

-- 3) Renew listing RPC
CREATE OR REPLACE FUNCTION public.renew_listing(_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing record;
  v_yearly_renews int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = _listing_id;
  IF v_listing IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_listing.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Cooldown: max 1 renew / 24h
  IF v_listing.last_renewed_at IS NOT NULL
     AND v_listing.last_renewed_at > now() - interval '24 hours' THEN
    RAISE EXCEPTION 'Renouvellement déjà effectué dans les dernières 24h';
  END IF;

  -- Yearly cap for non-premium: 6 renews per rolling 365d
  IF NOT v_listing.is_premium THEN
    SELECT count(*) INTO v_yearly_renews
      FROM public.listings
     WHERE id = _listing_id
       AND last_renewed_at > now() - interval '365 days';
    IF v_listing.renewed_count >= 6 THEN
      RAISE EXCEPTION 'Limite annuelle de renouvellement atteinte (premium requis)';
    END IF;
  END IF;

  UPDATE public.listings
     SET published_at = now(),
         expires_at = GREATEST(expires_at, now()) + interval '365 days',
         archived_at = NULL,
         is_active = true,
         renewed_count = renewed_count + 1,
         last_renewed_at = now(),
         expiry_notified_30d = false,
         expiry_notified_7d = false,
         expiry_notified_0d = false,
         updated_at = now()
   WHERE id = _listing_id;

  RETURN jsonb_build_object('ok', true, 'listing_id', _listing_id);
END;
$$;

REVOKE ALL ON FUNCTION public.renew_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_listing(uuid) TO authenticated;

-- 4) Moderation decisions history
CREATE TABLE IF NOT EXISTS public.moderation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid,
  listing_id uuid NOT NULL,
  admin_id uuid,
  action text NOT NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage moderation decisions"
ON public.moderation_decisions FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Listing owners view own decisions"
ON public.moderation_decisions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.listings l
  WHERE l.id = moderation_decisions.listing_id AND l.user_id = auth.uid()
));

CREATE INDEX IF NOT EXISTS idx_moderation_decisions_listing ON public.moderation_decisions(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_case ON public.moderation_decisions(case_id, created_at DESC);

-- 5) Default moderation_config in site_settings
INSERT INTO public.site_settings (key, value, description)
VALUES (
  'moderation_config',
  jsonb_build_object(
    'min_distinct_reports', 2,
    'auto_remove_below', 25,
    'quarantine_below', 55,
    'ai_weight', 0.7,
    'behavior_weight', 0.3,
    'max_reports_per_day', 5
  ),
  'Paramètres de modération IA configurables'
)
ON CONFLICT (key) DO NOTHING;

-- Ensure non-admin clients can read moderation_config (read-only) so the UI can show settings
DROP POLICY IF EXISTS "Public read moderation_config" ON public.site_settings;
CREATE POLICY "Public read moderation_config"
ON public.site_settings FOR SELECT
USING (key = 'moderation_config');

-- 6) Update handle_new_report to use configurable threshold
CREATE OR REPLACE FUNCTION public.handle_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_owner uuid;
  v_distinct_count int;
  v_case_id uuid;
  v_secret text;
  v_url text;
  v_min_reports int;
BEGIN
  IF NEW.target_type::text <> 'listing' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_valid IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  v_listing_id := NEW.target_id;

  SELECT user_id INTO v_owner FROM public.listings WHERE id = v_listing_id;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((value->>'min_distinct_reports')::int, 2) INTO v_min_reports
    FROM public.site_settings WHERE key = 'moderation_config';
  v_min_reports := COALESCE(v_min_reports, 2);

  SELECT COUNT(DISTINCT reporter_id) INTO v_distinct_count
    FROM public.reports
   WHERE target_type = NEW.target_type
     AND target_id = v_listing_id
     AND is_valid = true;

  IF v_distinct_count < v_min_reports THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.moderation_cases (listing_id, user_id, status, reports_count)
  VALUES (v_listing_id, v_owner, 'pending', v_distinct_count)
  ON CONFLICT (listing_id) DO UPDATE
    SET reports_count = EXCLUDED.reports_count,
        updated_at = now()
  RETURNING id INTO v_case_id;

  BEGIN
    SELECT value->>'url' INTO v_url FROM public.site_settings WHERE key = 'moderation_hook';
    SELECT value->>'secret' INTO v_secret FROM public.site_settings WHERE key = 'moderation_hook';
    IF v_url IS NOT NULL AND length(v_url) > 0 THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-moderation-secret', COALESCE(v_secret,'')
        ),
        body := jsonb_build_object('case_id', v_case_id, 'listing_id', v_listing_id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- 7) Allow service role to insert into moderation_notifications (used by edge functions)
DROP POLICY IF EXISTS "Service role inserts notifications" ON public.moderation_notifications;
CREATE POLICY "Service role inserts notifications"
ON public.moderation_notifications FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 8) Ensure handle_new_report trigger is attached
DROP TRIGGER IF EXISTS trg_handle_new_report ON public.reports;
CREATE TRIGGER trg_handle_new_report
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.handle_new_report();
