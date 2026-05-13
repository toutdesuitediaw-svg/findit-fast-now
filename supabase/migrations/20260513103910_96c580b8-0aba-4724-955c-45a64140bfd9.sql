
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

  BEGIN
    SELECT value->>'url' INTO v_url FROM public.site_settings WHERE key = 'moderation_hook';
    SELECT value->>'secret' INTO v_secret FROM public.site_settings WHERE key = 'moderation_hook';
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
    NULL;
  END;

  RETURN NEW;
END;
$$;
