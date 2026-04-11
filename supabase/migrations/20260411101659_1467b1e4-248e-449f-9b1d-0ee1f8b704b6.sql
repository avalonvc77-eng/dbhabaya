
-- Sales table
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  customer_name text NOT NULL,
  customer_mobile text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert sales for their branch" ON public.sales FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR branch_id = get_user_branch(auth.uid()));
CREATE POLICY "Users can update sales for their branch or admin" ON public.sales FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR branch_id = get_user_branch(auth.uid()));
CREATE POLICY "Admins can delete sales" ON public.sales FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sale items table
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete sale items" ON public.sale_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Product images table
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product images" ON public.product_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert product images" ON public.product_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete product images" ON public.product_images FOR DELETE TO authenticated USING (true);

-- Generate invoice number function
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_branch_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  branch_prefix text;
  next_num integer;
  invoice text;
BEGIN
  SELECT UPPER(LEFT(name, 3)) INTO branch_prefix FROM branches WHERE id = p_branch_id;
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS integer)), 0) + 1
    INTO next_num FROM sales WHERE branch_id = p_branch_id;
  invoice := branch_prefix || '-INV-' || LPAD(next_num::text, 6, '0');
  RETURN invoice;
END;
$$;
