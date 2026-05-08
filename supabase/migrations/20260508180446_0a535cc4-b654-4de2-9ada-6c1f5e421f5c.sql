DO $$
DECLARE uid uuid := 'a8e95aed-fc7d-4942-9402-2dd2f2c6128f';
BEGIN
  DELETE FROM public.favorites WHERE user_id = uid;
  DELETE FROM public.messages WHERE sender_id = uid OR recipient_id = uid;
  DELETE FROM public.listings WHERE user_id = uid;
  DELETE FROM public.transactions WHERE user_id = uid;
  DELETE FROM public.subscriptions WHERE user_id = uid;
  DELETE FROM public.reports WHERE reporter_id = uid OR resolved_by = uid;
  DELETE FROM public.activity_logs WHERE admin_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.identities WHERE user_id = uid;
  DELETE FROM auth.users WHERE id = uid;
END $$;