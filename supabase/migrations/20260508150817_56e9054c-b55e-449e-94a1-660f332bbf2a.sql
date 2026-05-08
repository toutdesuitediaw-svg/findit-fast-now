-- 1) Add premium_until column
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS premium_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_listings_premium_until
  ON public.listings (premium_until)
  WHERE is_premium = true;

-- 2) Trigger: when a listing_boost transaction is marked completed, activate premium
CREATE OR REPLACE FUNCTION public.activate_premium_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duration_days int;
BEGIN
  IF NEW.type = 'listing_boost'
     AND NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.listing_id IS NOT NULL
  THEN
    duration_days := COALESCE((NEW.metadata ->> 'duration_days')::int, 30);
    UPDATE public.listings
       SET is_premium   = true,
           is_featured  = true,
           premium_until = COALESCE(premium_until, now()) + (duration_days || ' days')::interval
     WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_premium_on_payment ON public.transactions;
CREATE TRIGGER trg_activate_premium_on_payment
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.activate_premium_on_payment();

-- 3) Function to expire premium ads
CREATE OR REPLACE FUNCTION public.expire_premium_listings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.listings
     SET is_premium  = false,
         is_featured = false
   WHERE is_premium = true
     AND premium_until IS NOT NULL
     AND premium_until < now();
$$;

-- 4) Schedule hourly expiration via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-premium-listings-hourly') THEN
    PERFORM cron.unschedule('expire-premium-listings-hourly');
  END IF;
  PERFORM cron.schedule(
    'expire-premium-listings-hourly',
    '0 * * * *',
    $cron$ SELECT public.expire_premium_listings(); $cron$
  );
END$$;