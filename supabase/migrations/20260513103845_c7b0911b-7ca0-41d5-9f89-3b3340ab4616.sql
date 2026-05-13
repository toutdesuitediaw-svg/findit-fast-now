
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.moderation_case_status AS ENUM ('pending','quarantined','removed','cleared','appealed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_risk_level AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.appeal_status AS ENUM ('open','accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Listings additions
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS quarantined_at timestamptz,
  ADD COLUMN IF NOT EXISTS trust_score int,
  ADD COLUMN IF NOT EXISTS auto_removed boolean NOT NULL DEFAULT false;

-- Reports additions
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS is_valid boolean NOT NULL DEFAULT true;

-- Moderation cases
CREATE TABLE IF NOT EXISTS public.moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status public.moderation_case_status NOT NULL DEFAULT 'pending',
  trust_score int,
  risk_level public.moderation_risk_level,
  ai_verdict jsonb NOT NULL DEFAULT '{}'::jsonb,
  reports_count int NOT NULL DEFAULT 0,
  auto_action text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id)
);
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own cases" ON public.moderation_cases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all cases" ON public.moderation_cases
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update cases" ON public.moderation_cases
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete cases" ON public.moderation_cases
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert cases" ON public.moderation_cases
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_mod_cases_updated_at
  BEFORE UPDATE ON public.moderation_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Appeals
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.moderation_cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  status public.appeal_status NOT NULL DEFAULT 'open',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own appeals" ON public.moderation_appeals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create appeals on own cases" ON public.moderation_appeals
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.moderation_cases c WHERE c.id = case_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Admins view all appeals" ON public.moderation_appeals
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update appeals" ON public.moderation_appeals
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Notifications
CREATE TABLE IF NOT EXISTS public.moderation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.moderation_cases(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.moderation_notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications" ON public.moderation_notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all notifications" ON public.moderation_notifications
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_mod_notif_user_unread
  ON public.moderation_notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- Report rate limits
CREATE TABLE IF NOT EXISTS public.report_rate_limits (
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT (now()::date),
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.report_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own limit" ON public.report_rate_limits
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger: when a new report is inserted, count distinct valid reports for the listing
-- and trigger AI moderation if >= 2 distinct reporters.
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

  SELECT COUNT(DISTINCT reporter_id) INTO v_distinct_count
  FROM public.reports
  WHERE target_type = NEW.target_type
    AND target_id = v_listing_id
    AND is_valid = true;

  IF v_distinct_count < 2 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.moderation_cases (listing_id, user_id, status, reports_count)
  VALUES (v_listing_id, v_owner, 'pending', v_distinct_count)
  ON CONFLICT (listing_id) DO UPDATE
    SET reports_count = EXCLUDED.reports_count,
        updated_at = now()
  RETURNING id INTO v_case_id;

  -- Fire-and-forget HTTP call to edge function
  BEGIN
    v_secret := current_setting('app.moderation_secret', true);
    v_url := current_setting('app.moderation_url', true);
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
    -- Don't fail the report insert if hook fails
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_report ON public.reports;
CREATE TRIGGER trg_handle_new_report
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.handle_new_report();
