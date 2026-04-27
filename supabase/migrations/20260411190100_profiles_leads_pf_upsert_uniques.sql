-- Fix agent upserts: same pattern as properties — ADD COLUMN IF NOT EXISTS … UNIQUE
-- skips UNIQUE when pf_agent_id already existed without it.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pf_agent_id_unique ON public.profiles (pf_agent_id);

-- Fix lead upserts: PostgREST ON CONFLICT (pf_lead_id) needs a plain unique arbiter.
-- A partial unique index (WHERE pf_lead_id IS NOT NULL) is often not enough for inference.
CREATE UNIQUE INDEX IF NOT EXISTS leads_pf_lead_id_upsert ON public.leads (pf_lead_id);
