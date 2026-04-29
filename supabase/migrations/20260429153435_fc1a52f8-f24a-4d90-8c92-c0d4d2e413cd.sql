-- Lock down SECURITY DEFINER functions (only triggers should call them)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Restrict bucket listing: replace broad SELECT policy with object-level access only
DROP POLICY IF EXISTS "Listing photos publicly readable" ON storage.objects;

-- Photos remain accessible via direct public URL (bucket is public),
-- but listing the bucket contents requires being the owner.
CREATE POLICY "Owners can list their listing photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'listing-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
