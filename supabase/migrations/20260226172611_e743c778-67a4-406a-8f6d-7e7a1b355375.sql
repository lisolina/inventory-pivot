
-- Products catalog
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'pasta', -- pasta, dust
  sku TEXT UNIQUE,
  unit_cost NUMERIC(10,2),
  sale_price NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Auth users can insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete products" ON public.products FOR DELETE USING (true);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Finished product inventory
CREATE TABLE public.inventory_finished (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id),
  location TEXT NOT NULL DEFAULT 'sabah',
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 100,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_finished ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view inventory_finished" ON public.inventory_finished FOR SELECT USING (true);
CREATE POLICY "Auth users can insert inventory_finished" ON public.inventory_finished FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update inventory_finished" ON public.inventory_finished FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete inventory_finished" ON public.inventory_finished FOR DELETE USING (true);

-- Packaging & components inventory
CREATE TABLE public.inventory_packaging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'aes', -- aes, sfoglini, sabah
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 50,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_packaging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view inventory_packaging" ON public.inventory_packaging FOR SELECT USING (true);
CREATE POLICY "Auth users can insert inventory_packaging" ON public.inventory_packaging FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update inventory_packaging" ON public.inventory_packaging FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete inventory_packaging" ON public.inventory_packaging FOR DELETE USING (true);

-- Shipping supplies inventory
CREATE TABLE public.inventory_shipping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'sabah',
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 20,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_shipping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view inventory_shipping" ON public.inventory_shipping FOR SELECT USING (true);
CREATE POLICY "Auth users can insert inventory_shipping" ON public.inventory_shipping FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update inventory_shipping" ON public.inventory_shipping FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete inventory_shipping" ON public.inventory_shipping FOR DELETE USING (true);

-- Inventory transactions log
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT NOT NULL, -- finished, packaging, shipping
  item_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  direction TEXT NOT NULL, -- in, out
  counterparty TEXT,
  notes TEXT,
  source TEXT, -- manual, command_bar, po_upload
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view inventory_transactions" ON public.inventory_transactions FOR SELECT USING (true);
CREATE POLICY "Auth users can insert inventory_transactions" ON public.inventory_transactions FOR INSERT WITH CHECK (true);

-- Orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'distributor', -- faire, shopify, distributor
  customer_name TEXT NOT NULL,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new', -- new, processing, shipped, delivered, invoiced, paid
  po_number TEXT,
  total_value NUMERIC(10,2),
  tracking_number TEXT,
  carrier TEXT,
  ship_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  invoice_number TEXT,
  invoice_status TEXT DEFAULT 'not_invoiced', -- not_invoiced, invoiced, paid
  payment_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Auth users can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete orders" ON public.orders FOR DELETE USING (true);
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Order line items
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view order_items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Auth users can insert order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update order_items" ON public.order_items FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete order_items" ON public.order_items FOR DELETE USING (true);

-- Invoices / Receivables
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id),
  invoice_number TEXT,
  customer TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date_issued TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue
  payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Auth users can insert invoices" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update invoices" ON public.invoices FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete invoices" ON public.invoices FOR DELETE USING (true);
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Expenses
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'one-time', -- recurring, one-time
  status TEXT NOT NULL DEFAULT 'upcoming', -- paid, upcoming
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Auth users can insert expenses" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update expenses" ON public.expenses FOR UPDATE USING (true);
CREATE POLICY "Auth users can delete expenses" ON public.expenses FOR DELETE USING (true);
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cash entries
CREATE TABLE public.cash_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL, -- in, out, balance_update
  amount NUMERIC(10,2) NOT NULL,
  category TEXT,
  description TEXT,
  balance_after NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view cash_entries" ON public.cash_entries FOR SELECT USING (true);
CREATE POLICY "Auth users can insert cash_entries" ON public.cash_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update cash_entries" ON public.cash_entries FOR UPDATE USING (true);
