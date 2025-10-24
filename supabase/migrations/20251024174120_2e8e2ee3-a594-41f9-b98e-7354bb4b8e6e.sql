-- Create inventory_items table to persist inventory data
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name text NOT NULL,
  reorder_level text,
  units_on_hand text,
  cases_on_hand text,
  stock_value text,
  reorder text,
  last_synced timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view inventory items"
ON public.inventory_items
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert inventory items"
ON public.inventory_items
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory items"
ON public.inventory_items
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete inventory items"
ON public.inventory_items
FOR DELETE
USING (true);

-- Create index for faster queries
CREATE INDEX idx_inventory_items_last_synced ON public.inventory_items(last_synced DESC);