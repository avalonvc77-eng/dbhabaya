
-- 1. sales_returns: remove permissive INSERT, enforce branch scope
DROP POLICY IF EXISTS "Users can insert sales_returns" ON public.sales_returns;
DROP POLICY IF EXISTS "Users can insert sales_return_items" ON public.sales_return_items;

CREATE POLICY "Branch users can insert sales_returns"
ON public.sales_returns FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.has_role(auth.uid(),'admin') OR branch_id = public.get_user_branch(auth.uid()))
);

-- 2. Branch-scope SELECT on sales / sales_returns
DROP POLICY IF EXISTS "Authenticated users can view sales" ON public.sales;
CREATE POLICY "Branch users can view sales"
ON public.sales FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR branch_id = public.get_user_branch(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view sales_returns" ON public.sales_returns;
CREATE POLICY "Branch users can view sales_returns"
ON public.sales_returns FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR branch_id = public.get_user_branch(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view sale items" ON public.sale_items;
CREATE POLICY "Branch users can view sale items"
ON public.sale_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = sale_items.sale_id
    AND (public.has_role(auth.uid(),'admin') OR s.branch_id = public.get_user_branch(auth.uid()))
));

DROP POLICY IF EXISTS "Authenticated users can view sales_return_items" ON public.sales_return_items;
CREATE POLICY "Branch users can view sales_return_items"
ON public.sales_return_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sales_returns r
  WHERE r.id = sales_return_items.return_id
    AND (public.has_role(auth.uid(),'admin') OR r.branch_id = public.get_user_branch(auth.uid()))
));

-- 3. Branch-scope products SELECT (protects buy_price)
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Branch users can view products"
ON public.products FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR branch_id = public.get_user_branch(auth.uid()));

-- 4. Restrict customer PII to admins or creator
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
CREATE POLICY "Admins or creator can view customers"
ON public.customers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Admins or creator can update customers"
ON public.customers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid());

-- 5. Prevent non-admins from changing their profile branch_id (privilege escalation)
CREATE OR REPLACE FUNCTION public.prevent_profile_branch_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id
     AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'শাখা পরিবর্তনের অনুমতি নেই';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_branch_change ON public.profiles;
CREATE TRIGGER profiles_prevent_branch_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_branch_change();
