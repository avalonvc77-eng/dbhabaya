
-- Customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text,
  email text,
  address text,
  notes text,
  total_purchases numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update customers" ON public.customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Sales returns table
CREATE TABLE public.sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  return_number text NOT NULL,
  customer_name text NOT NULL,
  customer_mobile text,
  total_refund numeric NOT NULL DEFAULT 0,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales_returns" ON public.sales_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert sales_returns" ON public.sales_returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete sales_returns" ON public.sales_returns FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Sales return items
CREATE TABLE public.sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales_return_items" ON public.sales_return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert sales_return_items" ON public.sales_return_items FOR INSERT TO authenticated WITH CHECK (true);

-- Product variants table
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text NOT NULL,
  size text,
  color text,
  quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 2,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_variants" ON public.product_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert product_variants" ON public.product_variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update product_variants" ON public.product_variants FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete product_variants" ON public.product_variants FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add customer_id to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- Generate return number function
CREATE OR REPLACE FUNCTION public.generate_return_number(p_branch_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  branch_prefix text;
  next_num integer;
BEGIN
  SELECT UPPER(LEFT(name, 3)) INTO branch_prefix FROM branches WHERE id = p_branch_id;
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM '[0-9]+$') AS integer)), 0) + 1
    INTO next_num FROM sales_returns WHERE branch_id = p_branch_id;
  RETURN branch_prefix || '-RET-' || LPAD(next_num::text, 6, '0');
END;
$$;
