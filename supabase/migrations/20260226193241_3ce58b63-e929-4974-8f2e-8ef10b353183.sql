
-- CRM Accounts table
CREATE TABLE public.crm_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'prospect',
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_followup_date TIMESTAMP WITH TIME ZONE,
  followup_cadence_days INTEGER NOT NULL DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view crm_accounts" ON public.crm_accounts FOR SELECT USING (true);
CREATE POLICY "Auth users can insert crm_accounts" ON public.crm_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update crm_accounts" ON public.crm_accounts FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete crm_accounts" ON public.crm_accounts FOR DELETE USING (true);

CREATE TRIGGER update_crm_accounts_updated_at
  BEFORE UPDATE ON public.crm_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CRM Activities table
CREATE TABLE public.crm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view crm_activities" ON public.crm_activities FOR SELECT USING (true);
CREATE POLICY "Auth users can insert crm_activities" ON public.crm_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update crm_activities" ON public.crm_activities FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete crm_activities" ON public.crm_activities FOR DELETE USING (true);

-- Allow deleting cash_entries
CREATE POLICY "Auth users can delete cash_entries" ON public.cash_entries FOR DELETE USING (true);
