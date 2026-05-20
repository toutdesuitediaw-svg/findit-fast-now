CREATE OR REPLACE FUNCTION public.notify_new_premium_listing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_notify boolean := false;
  v_body text;
  v_price text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_notify := NEW.is_premium = true AND NEW.is_active = true AND NEW.moderation_status = 'approved';
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_notify := NEW.is_premium = true AND NEW.is_active = true AND NEW.moderation_status = 'approved'
                   AND (OLD.is_premium = false OR OLD.is_active = false);
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  v_price := CASE
    WHEN NEW.price IS NOT NULL THEN '💰 ' || NEW.price::text || ' ' || COALESCE(NEW.currency, 'FCFA')
    ELSE ''
  END;
  v_body := '"' || NEW.title || '"'
            || CASE WHEN NEW.location IS NOT NULL THEN E'\n📍 ' || NEW.location ELSE '' END
            || CASE WHEN v_price <> '' THEN E'\n' || v_price ELSE '' END;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT
    p.user_id,
    'new_premium_listing',
    '🔥 Nouvelle annonce premium',
    v_body,
    '/annonce/' || NEW.id,
    jsonb_build_object('listing_id', NEW.id, 'category_id', NEW.category_id, 'city', NEW.location)
  FROM public.notification_preferences p
  WHERE p.enabled = true
    AND p.user_id <> NEW.user_id
    AND (array_length(p.categories, 1) IS NULL OR NEW.category_id = ANY(p.categories))
    AND (p.city IS NULL OR p.city = '' OR NEW.location ILIKE '%' || p.city || '%');

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_new_premium_listing() FROM PUBLIC, anon, authenticated;