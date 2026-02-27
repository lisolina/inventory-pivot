
-- Add category and sku columns to inventory_items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS sku text;

-- Add file_url to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS file_url text;

-- Add file_url to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS file_url text;

-- Create document-uploads bucket (public for viewing)
INSERT INTO storage.buckets (id, name, public) VALUES ('document-uploads', 'document-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to document-uploads
CREATE POLICY "Auth users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'document-uploads');

-- Allow public read access to document-uploads
CREATE POLICY "Public can view documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'document-uploads');
