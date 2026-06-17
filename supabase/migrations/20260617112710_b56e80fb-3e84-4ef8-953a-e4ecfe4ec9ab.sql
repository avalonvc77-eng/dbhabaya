
-- ============ 1. AUDIT LOGS TABLE ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name, record_id);

-- ============ 2. TIGHTEN RLS POLICIES ============

-- sale_items: only same-branch users can insert/delete
DROP POLICY IF EXISTS "Users can insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Admins can delete sale items" ON public.sale_items;
CREATE POLICY "Branch users can insert sale items" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
        AND (public.has_role(auth.uid(),'admin') OR s.branch_id = public.get_user_branch(auth.uid()))
    )
  );
CREATE POLICY "Admins can delete sale items" ON public.sale_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- sales_return_items
DROP POLICY IF EXISTS "Users can insert sales return items" ON public.sales_return_items;
DROP POLICY IF EXISTS "Admins can delete sales return items" ON public.sales_return_items;
CREATE POLICY "Branch users can insert return items" ON public.sales_return_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_returns r
      WHERE r.id = return_id
        AND (public.has_role(auth.uid(),'admin') OR r.branch_id = public.get_user_branch(auth.uid()))
    )
  );
CREATE POLICY "Admins can delete return items" ON public.sales_return_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- stock_movements: branch scoped
DROP POLICY IF EXISTS "Users can insert stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Authenticated users can insert stock movements" ON public.stock_movements;
CREATE POLICY "Branch users can insert stock movements" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR branch_id = public.get_user_branch(auth.uid())
  );

-- product_images: scope by product branch
DROP POLICY IF EXISTS "Users can insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Users can delete product images" ON public.product_images;
CREATE POLICY "Branch users can insert product images" ON public.product_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (public.has_role(auth.uid(),'admin') OR p.branch_id = public.get_user_branch(auth.uid()))
    )
  );
CREATE POLICY "Branch users can delete product images" ON public.product_images
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (public.has_role(auth.uid(),'admin') OR p.branch_id = public.get_user_branch(auth.uid()))
    )
  );

-- product_variants
DROP POLICY IF EXISTS "Users can insert product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users can update product_variants" ON public.product_variants;
CREATE POLICY "Branch users can insert variants" ON public.product_variants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (public.has_role(auth.uid(),'admin') OR p.branch_id = public.get_user_branch(auth.uid()))
    )
  );
CREATE POLICY "Branch users can update variants" ON public.product_variants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (public.has_role(auth.uid(),'admin') OR p.branch_id = public.get_user_branch(auth.uid()))
    )
  );

-- customers: require authenticated (no anon)
DROP POLICY IF EXISTS "Users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers" ON public.customers;
CREATE POLICY "Authenticated users can insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============ 3. TRANSACTIONAL SALE FUNCTION ============
CREATE OR REPLACE FUNCTION public.create_sale(
  p_branch_id uuid,
  p_customer_name text,
  p_customer_mobile text,
  p_payment_method text,
  p_discount_percent numeric,
  p_notes text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invoice text;
  v_sale_id uuid;
  v_subtotal numeric := 0;
  v_discount numeric;
  v_total numeric;
  v_item jsonb;
  v_qty int;
  v_price numeric;
  v_product_id uuid;
  v_available int;
  v_product_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'লগইন প্রয়োজন';
  END IF;
  IF NOT (public.has_role(v_user_id,'admin') OR public.get_user_branch(v_user_id) = p_branch_id) THEN
    RAISE EXCEPTION 'এই শাখায় বিক্রয় করার অনুমতি নেই';
  END IF;
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) = 0 THEN
    RAISE EXCEPTION 'গ্রাহকের নাম প্রয়োজন';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'কমপক্ষে একটি প্রোডাক্ট প্রয়োজন';
  END IF;

  -- Lock & validate
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_price := (v_item->>'unit_price')::numeric;
    IF v_qty <= 0 OR v_price < 0 THEN
      RAISE EXCEPTION 'অবৈধ পরিমাণ বা মূল্য';
    END IF;
    SELECT quantity, name INTO v_available, v_product_name
      FROM products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'প্রোডাক্ট পাওয়া যায়নি'; END IF;
    IF v_available < v_qty THEN
      RAISE EXCEPTION 'স্টক অপর্যাপ্ত: % (আছে %, চাওয়া %)', v_product_name, v_available, v_qty;
    END IF;
    v_subtotal := v_subtotal + v_qty * v_price;
  END LOOP;

  v_discount := v_subtotal * COALESCE(p_discount_percent,0) / 100;
  v_total := v_subtotal - v_discount;
  v_invoice := public.generate_invoice_number(p_branch_id);

  INSERT INTO sales(invoice_number, branch_id, customer_name, customer_mobile,
                    subtotal, discount_percent, discount_amount, total_amount,
                    payment_method, notes, created_by)
  VALUES (v_invoice, p_branch_id, trim(p_customer_name), NULLIF(trim(COALESCE(p_customer_mobile,'')), ''),
          v_subtotal, COALESCE(p_discount_percent,0), v_discount, v_total,
          p_payment_method, NULLIF(trim(COALESCE(p_notes,'')), ''), v_user_id)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_price := (v_item->>'unit_price')::numeric;

    INSERT INTO sale_items(sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_product_id, v_item->>'product_name', v_qty, v_price, v_qty * v_price);

    UPDATE products SET quantity = quantity - v_qty WHERE id = v_product_id;

    INSERT INTO stock_movements(product_id, branch_id, movement_type, quantity, notes, created_by)
    VALUES (v_product_id, p_branch_id, 'out', v_qty, 'বিক্রয় - ইনভয়েস: ' || v_invoice, v_user_id);
  END LOOP;

  INSERT INTO audit_logs(user_id, action, table_name, record_id, new_data)
  VALUES (v_user_id, 'CREATE_SALE', 'sales', v_sale_id::text,
          jsonb_build_object('invoice', v_invoice, 'total', v_total));

  RETURN jsonb_build_object('sale_id', v_sale_id, 'invoice_number', v_invoice, 'total', v_total);
END;
$$;

-- ============ 4. TRANSACTIONAL RETURN FUNCTION ============
CREATE OR REPLACE FUNCTION public.create_sales_return(
  p_sale_id uuid,
  p_reason text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale sales%ROWTYPE;
  v_return_id uuid;
  v_return_num text;
  v_refund numeric := 0;
  v_item jsonb;
  v_qty int;
  v_price numeric;
  v_product_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'লগইন প্রয়োজন'; END IF;
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'বিক্রয় রেকর্ড পাওয়া যায়নি'; END IF;
  IF NOT (public.has_role(v_user_id,'admin') OR public.get_user_branch(v_user_id) = v_sale.branch_id) THEN
    RAISE EXCEPTION 'এই শাখার রিটার্ন প্রক্রিয়ার অনুমতি নেই';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'কমপক্ষে একটি আইটেম প্রয়োজন';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    v_price := (v_item->>'unit_price')::numeric;
    IF v_qty <= 0 THEN RAISE EXCEPTION 'অবৈধ পরিমাণ'; END IF;
    v_refund := v_refund + v_qty * v_price;
  END LOOP;

  v_return_num := public.generate_return_number(v_sale.branch_id);

  INSERT INTO sales_returns(sale_id, branch_id, return_number, customer_name,
                            customer_mobile, total_refund, reason, created_by)
  VALUES (p_sale_id, v_sale.branch_id, v_return_num, v_sale.customer_name,
          v_sale.customer_mobile, v_refund, NULLIF(trim(COALESCE(p_reason,'')),''), v_user_id)
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_price := (v_item->>'unit_price')::numeric;

    INSERT INTO sales_return_items(return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, v_product_id, v_item->>'product_name', v_qty, v_price, v_qty * v_price);

    UPDATE products SET quantity = quantity + v_qty WHERE id = v_product_id;

    INSERT INTO stock_movements(product_id, branch_id, movement_type, quantity, notes, created_by)
    VALUES (v_product_id, v_sale.branch_id, 'in', v_qty,
            'রিটার্ন - ' || v_return_num || ' (ইনভয়েস: ' || v_sale.invoice_number || ')', v_user_id);
  END LOOP;

  INSERT INTO audit_logs(user_id, action, table_name, record_id, new_data)
  VALUES (v_user_id, 'CREATE_RETURN', 'sales_returns', v_return_id::text,
          jsonb_build_object('return_number', v_return_num, 'refund', v_refund));

  RETURN jsonb_build_object('return_id', v_return_id, 'return_number', v_return_num, 'total_refund', v_refund);
END;
$$;

-- ============ 5. LOCK DOWN SECURITY DEFINER FUNCTIONS ============
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_return_number(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_sale(uuid,text,text,text,numeric,text,jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_sales_return(uuid,text,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid,text,text,text,numeric,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sales_return(uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_return_number(uuid) TO authenticated;
