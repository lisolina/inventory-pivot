-- Create forwarded_emails table for emails forwarded to the system
CREATE TABLE public.forwarded_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_from TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  email_body TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.forwarded_emails ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to forwarded emails"
  ON public.forwarded_emails
  FOR SELECT
  USING (true);

-- Allow service role to insert
CREATE POLICY "Allow service role to insert forwarded emails"
  ON public.forwarded_emails
  FOR INSERT
  WITH CHECK (true);

-- Allow public to update status
CREATE POLICY "Allow public to update forwarded emails"
  ON public.forwarded_emails
  FOR UPDATE
  USING (true);