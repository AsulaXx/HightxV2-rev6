-- Remove broad SELECT policies. Public buckets serve files via CDN
-- without needing a SELECT policy on storage.objects — the SELECT policy
-- only matters for list/query via the API, which we do NOT want public.
DROP POLICY IF EXISTS "tenant_public_read_music" ON storage.objects;
DROP POLICY IF EXISTS "tenant_public_read_product_images" ON storage.objects;