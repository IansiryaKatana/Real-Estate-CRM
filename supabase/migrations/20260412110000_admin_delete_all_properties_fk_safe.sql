-- Fix 400 on admin_delete_all_properties: clear dependents first (handles RESTRICT drift / PostgREST).
-- property_agents & property_analytics reference properties; leads/deals use property_id (SET NULL in base schema).

DROP FUNCTION IF EXISTS public.admin_delete_all_properties();

CREATE OR REPLACE FUNCTION public.admin_delete_all_properties()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.property_agents;
  DELETE FROM public.property_analytics;
  UPDATE public.deals SET property_id = NULL WHERE property_id IS NOT NULL;
  UPDATE public.leads SET property_id = NULL WHERE property_id IS NOT NULL;
  DELETE FROM public.properties;
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_all_properties() TO authenticated;
