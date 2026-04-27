-- PostgREST: void-returning RPCs often respond 400; use json + explicit empty-arg shape.
-- Profile purge: clear dependents first to avoid 409 / FK edge cases.

DROP FUNCTION IF EXISTS public.admin_delete_all_leads();
DROP FUNCTION IF EXISTS public.admin_delete_all_properties();
DROP FUNCTION IF EXISTS public.admin_delete_pf_agent_profiles_only();

CREATE OR REPLACE FUNCTION public.admin_delete_all_leads()
RETURNS json
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
  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_all_properties()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.properties;
  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_pf_agent_profiles_only()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE pf_agent_id IS NOT NULL AND user_id IS NULL
  ) THEN
    RETURN json_build_object('ok', true, 'deleted', 0);
  END IF;

  DELETE FROM public.property_agents pa
  USING public.profiles p
  WHERE pa.agent_id = p.id AND p.pf_agent_id IS NOT NULL AND p.user_id IS NULL;

  UPDATE public.leads l
  SET assigned_agent_id = NULL
  FROM public.profiles p
  WHERE l.assigned_agent_id = p.id AND p.pf_agent_id IS NOT NULL AND p.user_id IS NULL;

  UPDATE public.deals d
  SET assigned_agent_id = NULL
  FROM public.profiles p
  WHERE d.assigned_agent_id = p.id AND p.pf_agent_id IS NOT NULL AND p.user_id IS NULL;

  UPDATE public.commissions c
  SET agent_id = NULL
  FROM public.profiles p
  WHERE c.agent_id = p.id AND p.pf_agent_id IS NOT NULL AND p.user_id IS NULL;

  UPDATE public.assignment_rules r
  SET assign_to_agent_id = NULL
  FROM public.profiles p
  WHERE r.assign_to_agent_id = p.id AND p.pf_agent_id IS NOT NULL AND p.user_id IS NULL;

  UPDATE public.documents doc
  SET uploaded_by = NULL
  FROM public.profiles p
  WHERE doc.uploaded_by = p.id AND p.pf_agent_id IS NOT NULL AND p.user_id IS NULL;

  DELETE FROM public.notifications nt
  USING public.profiles p
  WHERE nt.user_id = p.id AND p.pf_agent_id IS NOT NULL AND p.user_id IS NULL;

  DELETE FROM public.profiles WHERE pf_agent_id IS NOT NULL AND user_id IS NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN json_build_object('ok', true, 'deleted', deleted_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_all_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_properties() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_pf_agent_profiles_only() TO authenticated;
