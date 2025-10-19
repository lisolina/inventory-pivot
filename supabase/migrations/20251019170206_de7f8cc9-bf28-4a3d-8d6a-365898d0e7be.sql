-- Create table for email orders
CREATE TABLE public.email_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_from TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  po_number TEXT,
  product_name TEXT,
  quantity INTEGER,
  date_received TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  raw_email_body TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_orders ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (since this is an internal tool)
CREATE POLICY "Allow public read access to email orders" 
ON public.email_orders 
FOR SELECT 
USING (true);

-- Create policy for edge functions to insert
CREATE POLICY "Allow service role to insert email orders" 
ON public.email_orders 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_email_orders_processed ON public.email_orders(processed);
CREATE INDEX idx_email_orders_date ON public.email_orders(date_received DESC);