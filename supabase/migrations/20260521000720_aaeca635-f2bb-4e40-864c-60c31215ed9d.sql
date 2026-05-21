-- Drop the over-permissive public read policy
DROP POLICY IF EXISTS "Public read vapid_keys public part" ON public.site_settings;

-- Remove the row that bundled public + private
DELETE FROM public.site_settings WHERE key = 'vapid_keys';

-- Split into two rows
INSERT INTO public.site_settings (key, value, description)
VALUES (
  'vapid_public_key',
  jsonb_build_object('key', 'BC5mVnAt3vALfuHcLsm4KZVLmV1PtmvYTeQ02i8-xla4SkIZHjzeey5_c18Nve9hXsgRLXd6FXwlyitx78zAFYI'),
  'Public VAPID key (safe to expose to clients)'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value, description)
VALUES (
  'vapid_private',
  jsonb_build_object(
    'private_key', 'mCXuLKf9ItVGfCK4T4ZhtqqY2cD8TBiCiydBX-uaKyo',
    'subject', 'mailto:contact@toutsuitannonce.com'
  ),
  'Private VAPID key (server only)'
) ON CONFLICT (key) DO NOTHING;

-- Public read policy for ONLY the public key row
CREATE POLICY "Public read vapid_public_key"
  ON public.site_settings FOR SELECT
  USING (key = 'vapid_public_key');