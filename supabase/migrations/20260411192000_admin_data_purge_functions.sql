-- Destructive admin helpers (SECURITY DEFINER bypasses RLS). Called from Settings UI only.

CREATE OR REPLACE FUNCTION public.admin_delete_all_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.commissions;
  DELETE FROM public.deals;
  DELETE FROM public.email_messages;
  DELETE FROM public.email_threads;
  DELETE FROM public.lead_activities;
  DELETE FROM public.leads;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_all_properties()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.properties;
END;
$$;

-- PF-synced agent rows only (no auth account). Preserves logged-in CRM users.
CREATE OR REPLACE FUNCTION public.admin_delete_pf_agent_profiles_only()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles
  WHERE pf_agent_id IS NOT NULL
    AND user_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_all_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_properties() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_pf_agent_profiles_only() TO authenticated;
