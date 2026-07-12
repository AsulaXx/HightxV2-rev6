-- Storage RLS: public read, service_role only writes
-- Buckets 'music' and 'product-images' are already public (read via CDN).
-- We lock write/update/delete to service_role so all mutations go through
-- edge functions that validate Firebase Owner/Admin role.

-- Drop any pre-existing policies with the same names (idempotent)
DROP POLICY IF EXISTS "tenant_public_read_music" ON storage.objects;
DROP POLICY IF EXISTS "tenant_public_read_product_images" ON storage.objects;
DROP POLICY IF EXISTS "tenant_service_write_music" ON storage.objects;
DROP POLICY IF EXISTS "tenant_service_write_product_images" ON storage.objects;

-- Public read (anon + authenticated)
CREATE POLICY "tenant_public_read_music"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'music');

CREATE POLICY "tenant_public_read_product_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- Writes: service_role only (edge functions).
-- No anon/authenticated INSERT/UPDATE/DELETE policies → denied by default.
CREATE POLICY "tenant_service_write_music"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'music')
WITH CHECK (bucket_id = 'music');

CREATE POLICY "tenant_service_write_product_images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');