-- Create profiles table for user data
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update email_orders RLS policies to require authentication
DROP POLICY IF EXISTS "Allow public read access to email orders" ON public.email_orders;

CREATE POLICY "Authenticated users can view email orders"
ON public.email_orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update email orders"
ON public.email_orders
FOR UPDATE
TO authenticated
USING (true);

-- Update forwarded_emails RLS policies to require authentication
DROP POLICY IF EXISTS "Allow public read access to forwarded emails" ON public.forwarded_emails;

CREATE POLICY "Authenticated users can view forwarded emails"
ON public.forwarded_emails
FOR SELECT
TO authenticated
USING (true);

-- Keep the existing update policy but ensure it's for authenticated users
DROP POLICY IF EXISTS "Allow public to update forwarded emails" ON public.forwarded_emails;

CREATE POLICY "Authenticated users can update forwarded emails"
ON public.forwarded_emails
FOR UPDATE
TO authenticated
USING (true);