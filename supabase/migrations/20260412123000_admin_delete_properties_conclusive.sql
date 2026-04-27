-- Conclusive admin_delete_all_properties fix:
-- 1) Explicit text arg so PostgREST always maps JSON -> function (avoids 0-arg / overload issues).
-- 2) FK-safe delete order.
-- 3) EXCEPTION -> return json so PostgREST returns 200 with { ok: false, error: ... } instead of HTTP 400 for SQL errors.

DROP FUNCTION IF EXISTS public.admin_delete_all_properties();
DROP FUNCTION IF EXISTS public.admin_delete_all_properties(text);

CREATE OR REPLACE FUNCTION public.admin_delete_all_properties(p_confirm text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_confirm IS DISTINCT FROM 'DELETE' THEN
    RETURN json_build_object('ok', false, 'error', 'Confirmation token must be DELETE');
  END IF;

  BEGIN
    DELETE FROM public.property_agents;
    DELETE FROM public.property_analytics;
    UPDATE public.deals SET property_id = NULL WHERE property_id IS NOT NULL;
    UPDATE public.leads SET property_id = NULL WHERE property_id IS NOT NULL;
    DELETE FROM public.properties;
    RETURN json_build_object('ok', true);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object(
        'ok', false,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
      );
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_all_properties(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_properties(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_properties(text) TO service_role;

-- Ask PostgREST to reload the schema cache (safe to ignore if not permitted).
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
