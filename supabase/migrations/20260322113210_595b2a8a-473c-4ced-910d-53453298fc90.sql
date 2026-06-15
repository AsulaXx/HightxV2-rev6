
-- Create storage bucket for music files
INSERT INTO storage.buckets (id, name, public)
VALUES ('music', 'music', true);

-- Allow authenticated users to upload music files
CREATE POLICY "Authenticated users can upload music"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'music');

-- Allow authenticated users to update their own music files
CREATE POLICY "Authenticated users can update own music"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'music' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own music files
CREATE POLICY "Authenticated users can delete own music"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'music' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access to music files
CREATE POLICY "Public can read music files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'music');
