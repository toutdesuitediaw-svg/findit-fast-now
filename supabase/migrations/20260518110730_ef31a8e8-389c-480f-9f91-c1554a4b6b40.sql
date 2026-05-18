
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgent_until timestamptz;

CREATE OR REPLACE FUNCTION public.activate_premium_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  duration_days int;
  boost_type text;
BEGIN
  IF NEW.type = 'listing_boost'
     AND NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.listing_id IS NOT NULL
  THEN
    duration_days := COALESCE((NEW.metadata ->> 'duration_days')::int, 30);
    boost_type := COALESCE(NEW.metadata ->> 'boost_type', 'premium');

    IF boost_type = 'urgent' THEN
      UPDATE public.listings
         SET is_urgent    = true,
             urgent_until = COALESCE(urgent_until, now()) + (duration_days || ' days')::interval
       WHERE id = NEW.listing_id;
    ELSE
      UPDATE public.listings
         SET is_premium   = true,
             is_featured  = true,
             premium_until = COALESCE(premium_until, now()) + (duration_days || ' days')::interval
       WHERE id = NEW.listing_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_premium_listings()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.listings
     SET is_premium  = false,
         is_featured = false
   WHERE is_premium = true
     AND premium_until IS NOT NULL
     AND premium_until < now();

  UPDATE public.listings
     SET is_urgent = false
   WHERE is_urgent = true
     AND urgent_until IS NOT NULL
     AND urgent_until < now();
$function$;
