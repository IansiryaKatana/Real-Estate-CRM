-- Tighten PF auto-sync cadence from every 30 minutes to every 1 minute.
-- Keeps compatibility with varying pg_cron schema locations.

DO $$
DECLARE
  v_cron_schema text;
  v_old_job_id bigint;
  v_new_job_id bigint;
BEGIN
  SELECT n.nspname
  INTO v_cron_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_cron'
  LIMIT 1;

  IF v_cron_schema IS NULL THEN
    RAISE NOTICE 'pg_cron extension not available; skipping PF cadence update';
    RETURN;
  END IF;

  -- Unschedule known prior job names (ignore if absent).
  BEGIN
    EXECUTE format('SELECT %I.unschedule(%L)', v_cron_schema, 'pf_auto_sync_every_30m');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    EXECUTE format('SELECT %I.unschedule(%L)', v_cron_schema, 'pf_auto_sync_every_1m');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Fallback by job table if name-based unschedule is not supported.
  BEGIN
    EXECUTE format(
      'SELECT jobid FROM %I.job WHERE jobname IN (%L, %L) ORDER BY jobid DESC LIMIT 1',
      v_cron_schema,
      'pf_auto_sync_every_30m',
      'pf_auto_sync_every_1m'
    )
    INTO v_old_job_id;
    IF v_old_job_id IS NOT NULL THEN
      EXECUTE format('SELECT %I.unschedule(%s)', v_cron_schema, v_old_job_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Schedule near-live cadence.
  EXECUTE format(
    'SELECT %I.schedule(%L, %L, %L)',
    v_cron_schema,
    'pf_auto_sync_every_1m',
    '* * * * *',
    'SELECT public.run_property_finder_sync_cron();'
  )
  INTO v_new_job_id;

  INSERT INTO public.audit_log (action, entity, user_name, details)
  VALUES (
    'update',
    'property_finder_cron',
    'System',
    format('PF auto-sync cadence set to every minute (job_id=%s)', v_new_job_id)
  );
END $$;

