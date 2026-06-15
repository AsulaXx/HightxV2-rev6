
-- ─── topup_admins: admin-only via membership self-check ───
CREATE POLICY "topup_admins read self" ON public.topup_admins
  FOR SELECT TO authenticated, anon USING (false);
CREATE POLICY "topup_admins block writes" ON public.topup_admins
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- ─── topup_provider_config: block all client access (service role bypasses RLS) ───
CREATE POLICY "topup_provider_config block reads" ON public.topup_provider_config
  FOR SELECT TO authenticated, anon USING (false);
CREATE POLICY "topup_provider_config block writes" ON public.topup_provider_config
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- ─── Storage: lock down music + product-images write paths ───
-- Keep public SELECT (legitimate public reads). Restrict INSERT/UPDATE/DELETE to authenticated users.
DROP POLICY IF EXISTS "Public can upload music" ON storage.objects;
DROP POLICY IF EXISTS "Public can update music" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete music" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload music" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update music" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete music" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete product images" ON storage.objects;

CREATE POLICY "music authenticated upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'music');
CREATE POLICY "music authenticated update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'music') WITH CHECK (bucket_id = 'music');
CREATE POLICY "music authenticated delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'music');

CREATE POLICY "product-images authenticated upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product-images authenticated update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product-images authenticated delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');
