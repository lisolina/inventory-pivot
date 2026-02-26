
-- Create quickbooks_tokens table to store OAuth tokens per user
CREATE TABLE public.quickbooks_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Each user has one QB connection
CREATE UNIQUE INDEX idx_quickbooks_tokens_user_id ON public.quickbooks_tokens (user_id);

-- Enable RLS
ALTER TABLE public.quickbooks_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only access their own tokens
CREATE POLICY "Users can view their own QB tokens"
  ON public.quickbooks_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own QB tokens"
  ON public.quickbooks_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own QB tokens"
  ON public.quickbooks_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own QB tokens"
  ON public.quickbooks_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_quickbooks_tokens_updated_at
  BEFORE UPDATE ON public.quickbooks_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
