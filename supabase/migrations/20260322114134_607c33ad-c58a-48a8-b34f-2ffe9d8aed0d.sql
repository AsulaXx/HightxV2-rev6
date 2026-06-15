
-- Drop old restrictive policies
DROP POLICY IF EXISTS "Authenticated users can upload music" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own music" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own music" ON storage.objects;

-- Allow anyone to upload to music bucket
CREATE POLICY "Anyone can upload music"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'music');

-- Allow anyone to update music files
CREATE POLICY "Anyone can update music"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'music');

-- Allow anyone to delete music files
CREATE POLICY "Anyone can delete music"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'music');
