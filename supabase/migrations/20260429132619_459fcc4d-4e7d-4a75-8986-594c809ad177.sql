
-- production_runs
CREATE TABLE public.production_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  run_name TEXT NOT NULL,
  product_line TEXT,
  skus TEXT[] DEFAULT '{}',
  target_units INTEGER DEFAULT 0,
  actual_units INTEGER DEFAULT 0,
  expected_revenue NUMERIC DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'planning',
  tubes_ordered_date TIMESTAMPTZ,
  tubes_landed_date TIMESTAMPTZ,
  ingredients_staged_date TIMESTAMPTZ,
  aes_pack_start TIMESTAMPTZ,
  aes_pack_complete TIMESTAMPTZ,
  shipped_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view production_runs" ON public.production_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert production_runs" ON public.production_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update production_runs" ON public.production_runs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete production_runs" ON public.production_runs FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_production_runs_updated_at BEFORE UPDATE ON public.production_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- production_run_costs
CREATE TABLE public.production_run_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES public.production_runs(run_id) ON DELETE CASCADE,
  expense_type TEXT,
  vendor TEXT,
  amount NUMERIC DEFAULT 0,
  date_incurred TIMESTAMPTZ,
  date_due TIMESTAMPTZ,
  date_paid TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_run_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view production_run_costs" ON public.production_run_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert production_run_costs" ON public.production_run_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update production_run_costs" ON public.production_run_costs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete production_run_costs" ON public.production_run_costs FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_run_costs_run_id ON public.production_run_costs(run_id);

-- channel_margins
CREATE TABLE public.channel_margins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_line TEXT NOT NULL,
  channel TEXT NOT NULL,
  landed_cogs NUMERIC DEFAULT 0,
  net_price_per_unit NUMERIC DEFAULT 0,
  fulfillment_fees_per_unit NUMERIC DEFAULT 0,
  cm_dollars NUMERIC DEFAULT 0,
  cm_percent NUMERIC DEFAULT 0,
  notes TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_margins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view channel_margins" ON public.channel_margins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert channel_margins" ON public.channel_margins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update channel_margins" ON public.channel_margins FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete channel_margins" ON public.channel_margins FOR DELETE TO authenticated USING (true);

-- cash_flows
CREATE TABLE public.cash_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_starting DATE NOT NULL,
  description TEXT,
  category TEXT,
  inflow NUMERIC DEFAULT 0,
  outflow NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'forecast',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view cash_flows" ON public.cash_flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert cash_flows" ON public.cash_flows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update cash_flows" ON public.cash_flows FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete cash_flows" ON public.cash_flows FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_cash_flows_week ON public.cash_flows(week_starting);
CREATE TRIGGER update_cash_flows_updated_at BEFORE UPDATE ON public.cash_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- cash_balance
CREATE TABLE public.cash_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  balance NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view cash_balance" ON public.cash_balance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert cash_balance" ON public.cash_balance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update cash_balance" ON public.cash_balance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete cash_balance" ON public.cash_balance FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_cash_balance_date ON public.cash_balance(date DESC);

-- recipes
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL,
  ingredient TEXT NOT NULL,
  amount_per_unit_grams NUMERIC DEFAULT 0,
  supplier TEXT,
  cost_per_unit NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view recipes" ON public.recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert recipes" ON public.recipes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update recipes" ON public.recipes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete recipes" ON public.recipes FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_recipes_sku ON public.recipes(sku);
