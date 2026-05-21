-- 1. push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own push subs"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own push subs"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own push subs"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own push subs"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Seed VAPID keys + push hook config (admin-only via existing site_settings policies; public key is readable safely too)
INSERT INTO public.site_settings (key, value, description)
VALUES (
  'vapid_keys',
  jsonb_build_object(
    'public_key', 'BC5mVnAt3vALfuHcLsm4KZVLmV1PtmvYTeQ02i8-xla4SkIZHjzeey5_c18Nve9hXsgRLXd6FXwlyitx78zAFYI',
    'private_key', 'mCXuLKf9ItVGfCK4T4ZhtqqY2cD8TBiCiydBX-uaKyo',
    'subject', 'mailto:contact@toutsuitannonce.com'
  ),
  'VAPID keypair for Web Push notifications'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value, description)
VALUES (
  'push_hook',
  jsonb_build_object(
    'url', 'https://yyendbkedzfnsmjiclhg.supabase.co/functions/v1/send-push',
    'secret', encode(gen_random_bytes(24), 'hex')
  ),
  'Internal hook for fan-out push notifications'
) ON CONFLICT (key) DO NOTHING;

-- Allow anon/authenticated to read the public part via a dedicated policy (re-using existing public moderation_config pattern)
CREATE POLICY "Public read vapid_keys public part"
  ON public.site_settings FOR SELECT
  USING (key = 'vapid_keys');

-- 3. Trigger: after a notification row is inserted, fire-and-forget call to send-push edge function
CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT value->>'url', value->>'secret' INTO v_url, v_secret
    FROM public.site_settings WHERE key = 'push_hook';

  IF v_url IS NULL OR length(v_url) = 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-push-secret', COALESCE(v_secret,'')
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.body,
        'link', NEW.link,
        'type', NEW.type,
        'notification_id', NEW.id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_push_on_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_push_on_notification ON public.notifications;
CREATE TRIGGER trg_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_notification();