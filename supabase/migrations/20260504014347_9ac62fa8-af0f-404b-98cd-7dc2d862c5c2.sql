-- Trigger: when profile.status changes, sync listings.is_active
CREATE OR REPLACE FUNCTION public.sync_listings_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('suspended', 'banned') AND OLD.status = 'active' THEN
    UPDATE public.listings SET is_active = false WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_listings_on_profile_status ON public.profiles;
CREATE TRIGGER sync_listings_on_profile_status
AFTER UPDATE OF status ON public.profiles
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_listings_on_status_change();

-- Strengthen public visibility: hide listings from inactive owners
DROP POLICY IF EXISTS "Active listings viewable by everyone" ON public.listings;
CREATE POLICY "Active listings viewable by everyone"
ON public.listings
FOR SELECT
USING (
  (is_active = true AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = listings.user_id AND p.status = 'active'
  ))
  OR auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Apply retroactively to currently suspended/banned users
UPDATE public.listings l
SET is_active = false
FROM public.profiles p
WHERE p.id = l.user_id AND p.status IN ('suspended', 'banned');