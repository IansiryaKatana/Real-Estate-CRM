-- Fix: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- `ADD COLUMN IF NOT EXISTS pf_id text UNIQUE` does NOT add UNIQUE if the column already existed
-- without it, so PostgREST upserts (onConflict: pf_id) fail.

CREATE UNIQUE INDEX IF NOT EXISTS properties_pf_id_unique ON public.properties (pf_id);
