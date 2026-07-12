
-- Drop existing broad storage policies
DROP POLICY IF EXISTS "Public can read music files" ON storage.objects;
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "music authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "music authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "music authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "product-images authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "product-images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "product-images authenticated upload" ON storage.objects;

-- ═══ MUSIC BUCKET ═══
-- Public bucket serves reads via getPublicUrl (no RLS needed for public URL access).
-- No SELECT policy means clients cannot .list() the bucket.

CREATE POLICY "music: users insert own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "music: users update own folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "music: users delete own folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'music'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ═══ PRODUCT-IMAGES BUCKET ═══
-- Public bucket serves reads via public URL. No SELECT policy → no listing.

CREATE POLICY "product-images: users insert own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "product-images: users update own folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "product-images: users delete own folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
