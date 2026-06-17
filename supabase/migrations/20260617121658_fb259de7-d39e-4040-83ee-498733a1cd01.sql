
-- 1) schema_versions table (admin-only visibility)
CREATE TABLE IF NOT EXISTS public.schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  name text NOT NULL,
  notes text,
  applied_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.schema_versions TO authenticated;
GRANT ALL ON public.schema_versions TO service_role;

ALTER TABLE public.schema_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view schema versions"
ON public.schema_versions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- Seed known migrations
INSERT INTO public.schema_versions (version, name, notes) VALUES
  ('20260410120053','initial schema','Initial tables & RLS'),
  ('20260411101659','sales & returns base',NULL),
  ('20260423071224','rpc & helpers',NULL),
  ('20260617112710','validation & error boundaries',NULL),
  ('20260617120424','branch-scoped RLS hardening','Removed permissive policies; scoped sales/products/customers to branch; profile branch-change trigger'),
  ('20260617_audit','security audit log & onboarding','schema_versions + log_access_denied + claim_branch')
ON CONFLICT (version) DO NOTHING;

-- 2) log_access_denied RPC — any authenticated user can record their own denial
CREATE OR REPLACE FUNCTION public.log_access_denied(
  p_action text,
  p_table_name text,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  INSERT INTO public.audit_logs(user_id, user_email, action, table_name, new_data)
  VALUES (v_user_id, v_email, 'ACCESS_DENIED:'||p_action, p_table_name, p_details);
END;
$$;

REVOKE ALL ON FUNCTION public.log_access_denied(text,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_access_denied(text,text,jsonb) TO authenticated;

-- 3) Onboarding: claim_branch (one-time self-assignment for non-admins)
CREATE OR REPLACE FUNCTION public.claim_branch(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'লগইন প্রয়োজন'; END IF;
  IF p_branch_id IS NULL THEN RAISE EXCEPTION 'শাখা নির্বাচন করুন'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id) THEN
    RAISE EXCEPTION 'অবৈধ শাখা';
  END IF;

  SELECT branch_id INTO v_current FROM public.profiles WHERE user_id = v_user_id;
  IF v_current IS NOT NULL THEN
    RAISE EXCEPTION 'শাখা ইতিমধ্যে নির্ধারিত — পরিবর্তনের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন';
  END IF;

  -- Bypass the prevent_profile_branch_change trigger via SECURITY DEFINER + session flag
  UPDATE public.profiles
  SET branch_id = p_branch_id
  WHERE user_id = v_user_id AND branch_id IS NULL;

  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_data)
  VALUES (v_user_id, 'CLAIM_BRANCH', 'profiles', v_user_id::text,
          jsonb_build_object('branch_id', p_branch_id));
END;
$$;

REVOKE ALL ON FUNCTION public.claim_branch(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_branch(uuid) TO authenticated;

-- The prevent_profile_branch_change trigger fires on UPDATE and checks auth.uid().
-- For non-admins claiming their first branch we must allow OLD.branch_id IS NULL.
CREATE OR REPLACE FUNCTION public.prevent_profile_branch_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id
     AND OLD.branch_id IS NOT NULL
     AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'শাখা পরিবর্তনের অনুমতি নেই';
  END IF;
  RETURN NEW;
END;
$$;
