-- Auto-sync Property Finder on a recurring schedule (every 30 minutes).
-- Uses pg_cron + pg_net to call the existing edge function.

-- Seed secret used by the cron caller (edge function validates x-cron-secret).
INSERT INTO public.integration_secrets (slug, label, description, value)
VALUES (
  'pf_sync_cron_secret',
  'Property Finder sync cron secret',
  'Internal secret used by scheduled jobs to call sync-property-finder securely.',
  encode(gen_random_bytes(32), 'hex')
)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.run_property_finder_sync_cron()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pf_active boolean := false;
  v_secret text;
  v_supabase_url text;
  v_project_ref text;
  v_target_url text;
  v_req_id bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.ingestion_sources
    WHERE platform = 'property_finder'
      AND COALESCE(is_active, false) = true
  )
  INTO v_pf_active;

  IF NOT v_pf_active THEN
    RETURN 'skipped: property_finder source inactive or missing';
  END IF;

  SELECT NULLIF(trim(value), '')
  INTO v_secret
  FROM public.integration_secrets
  WHERE slug = 'pf_sync_cron_secret';

  IF v_secret IS NULL THEN
    RETURN 'skipped: pf_sync_cron_secret not configured';
  END IF;

  v_supabase_url := NULLIF(current_setting('app.settings.supabase_url', true), '');
  v_project_ref := NULLIF(current_setting('app.settings.project_ref', true), '');
  v_target_url := COALESCE(
    v_supabase_url,
    CASE
      WHEN v_project_ref IS NOT NULL THEN format('https://%s.supabase.co', v_project_ref)
      ELSE NULL
    END
  );

  IF v_target_url IS NULL THEN
    RETURN 'skipped: could not resolve supabase url';
  END IF;

  v_req_id := net.http_post(
    url := v_target_url || '/functions/v1/sync-property-finder',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );

  INSERT INTO public.audit_log (action, entity, user_name, details)
  VALUES (
    'sync',
    'property_finder_cron',
    'System',
    format('Scheduled PF sync triggered (request_id=%s)', v_req_id)
  );

  RETURN format('queued: request_id=%s', v_req_id);
END;
$$;

REVOKE ALL ON FUNCTION public.run_property_finder_sync_cron() FROM PUBLIC;

-- Idempotent schedule setup: remove any prior job with same name.
DO $$
DECLARE
  v_cron_schema text;
  v_job_id bigint;
BEGIN
  SELECT n.nspname
  INTO v_cron_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_cron'
  LIMIT 1;

  -- If pg_cron is unavailable, skip scheduling instead of failing migration.
  IF v_cron_schema IS NULL THEN
    RAISE NOTICE 'pg_cron extension not available; skipping PF auto-sync schedule';
    RETURN;
  END IF;

  -- Preferred path: unschedule by name (works on most pg_cron variants).
  BEGIN
    EXECUTE format('SELECT %I.unschedule(%L)', v_cron_schema, 'pf_auto_sync_every_30m');
  EXCEPTION
    WHEN undefined_function THEN
      -- Fallback path for variants that only support unschedule(jobid).
      BEGIN
        EXECUTE format('SELECT jobid FROM %I.job WHERE jobname = %L LIMIT 1', v_cron_schema, 'pf_auto_sync_every_30m')
        INTO v_job_id;

        IF v_job_id IS NOT NULL THEN
          EXECUTE format('SELECT %I.unschedule(%s)', v_cron_schema, v_job_id);
        END IF;
      EXCEPTION
        WHEN undefined_table THEN
          -- No job table exposed in this setup; continue to schedule.
          NULL;
      END;
  END;

  EXECUTE format(
    'SELECT %I.schedule(%L, %L, %L)',
    v_cron_schema,
    'pf_auto_sync_every_30m',
    '*/30 * * * *',
    'SELECT public.run_property_finder_sync_cron();'
  );
END $$;
