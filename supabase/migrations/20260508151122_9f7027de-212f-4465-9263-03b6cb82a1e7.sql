-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_listings_on_status_change()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_premium_on_payment()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_premium_listings()          FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies; authenticated users must keep EXECUTE,
-- but anonymous visitors should not be able to call it directly.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;