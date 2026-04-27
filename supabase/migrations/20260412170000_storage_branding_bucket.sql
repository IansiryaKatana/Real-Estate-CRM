-- Public logo assets for CRM branding (small images, read by anonymous users on /auth).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone can read branding bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update branding objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete branding objects" ON storage.objects;

CREATE POLICY "Anyone can read branding bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

CREATE POLICY "Authenticated users can upload branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'branding');

CREATE POLICY "Authenticated users can update branding objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'branding')
WITH CHECK (bucket_id = 'branding');

CREATE POLICY "Authenticated users can delete branding objects"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'branding');
