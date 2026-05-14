
DROP FUNCTION IF EXISTS public.renew_listing(uuid);
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
