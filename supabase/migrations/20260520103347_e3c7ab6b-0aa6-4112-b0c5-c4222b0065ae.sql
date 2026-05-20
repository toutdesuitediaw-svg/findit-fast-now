-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notifications"
  ON public.notifications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: notify on boost transaction status changes
CREATE OR REPLACE FUNCTION public.notify_on_boost_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boost_type text;
  v_listing_title text;
  v_link text;
BEGIN
  IF NEW.type <> 'listing_boost' OR NEW.listing_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_listing_title FROM public.listings WHERE id = NEW.listing_id;
  v_boost_type := COALESCE(NEW.metadata->>'boost_type', 'premium');
  v_link := '/dashboard';

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id,
      'boost_approved',
      'Boost approuvé ✅',
      'Votre boost ' || v_boost_type || ' pour « ' || COALESCE(v_listing_title, 'votre annonce') || ' » est maintenant actif.',
      v_link,
      jsonb_build_object('transaction_id', NEW.id, 'listing_id', NEW.listing_id, 'boost_type', v_boost_type)
    );
  ELSIF NEW.status IN ('failed', 'cancelled') AND OLD.status NOT IN ('failed', 'cancelled') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id,
      'boost_rejected',
      'Boost refusé ❌',
      'Votre demande de boost ' || v_boost_type || ' pour « ' || COALESCE(v_listing_title, 'votre annonce') || ' » a été refusée.',
      v_link,
      jsonb_build_object('transaction_id', NEW.id, 'listing_id', NEW.listing_id, 'boost_type', v_boost_type)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_boost_status_change
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_boost_status_change();