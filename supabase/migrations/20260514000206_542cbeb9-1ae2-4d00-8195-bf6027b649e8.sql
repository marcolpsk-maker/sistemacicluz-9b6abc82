
-- Drop overly broad SELECT on avatars (files are still publicly accessible via signed/public URL because bucket.public = true)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Allow only authenticated users to list/select files in their own folder
CREATE POLICY "Users can list own avatar folder"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
