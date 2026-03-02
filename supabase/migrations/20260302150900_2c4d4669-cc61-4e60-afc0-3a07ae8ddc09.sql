
-- recurring_expenses table
CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  next_due_date timestamp with time zone,
  category text NOT NULL DEFAULT 'subscription',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view recurring_expenses" ON public.recurring_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert recurring_expenses" ON public.recurring_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update recurring_expenses" ON public.recurring_expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete recurring_expenses" ON public.recurring_expenses FOR DELETE TO authenticated USING (true);

-- launch_products table
CREATE TABLE public.launch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit_price numeric DEFAULT 0,
  tube_cost numeric DEFAULT 0,
  ingredient_cost numeric DEFAULT 0,
  production_cost numeric DEFAULT 0,
  target_launch_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.launch_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view launch_products" ON public.launch_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert launch_products" ON public.launch_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update launch_products" ON public.launch_products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete launch_products" ON public.launch_products FOR DELETE TO authenticated USING (true);

-- launch_milestones table
CREATE TABLE public.launch_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.launch_products(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'ordering',
  deadline timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  cash_impact numeric DEFAULT 0,
  lead_time_days integer DEFAULT 0,
  payment_terms text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.launch_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view launch_milestones" ON public.launch_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert launch_milestones" ON public.launch_milestones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update launch_milestones" ON public.launch_milestones FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete launch_milestones" ON public.launch_milestones FOR DELETE TO authenticated USING (true);
