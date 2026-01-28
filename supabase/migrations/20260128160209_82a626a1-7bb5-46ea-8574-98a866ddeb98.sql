-- Create storage bucket for PO uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('po-uploads', 'po-uploads', false);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload PO files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'po-uploads' AND auth.role() = 'authenticated');

-- Allow authenticated users to read their uploads
CREATE POLICY "Authenticated users can read PO files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'po-uploads' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete PO files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'po-uploads' AND auth.role() = 'authenticated');