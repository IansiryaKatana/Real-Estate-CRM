
-- Properties: add PF fields
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS furnishing_type text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_from date,
  ADD COLUMN IF NOT EXISTS project_status text,
  ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS emirate text,
  ADD COLUMN IF NOT EXISTS price_type text,
  ADD COLUMN IF NOT EXISTS rera_number text,
  ADD COLUMN IF NOT EXISTS pf_assigned_agent_id text,
  ADD COLUMN IF NOT EXISTS pf_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS pf_updated_at timestamptz;

-- Leads: add PF fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pf_lead_id text,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS pf_status text,
  ADD COLUMN IF NOT EXISTS pf_response_link text,
  ADD COLUMN IF NOT EXISTS pf_listing_ref text,
  ADD COLUMN IF NOT EXISTS pf_created_at timestamptz;

-- Unique index on pf_lead_id for upsert dedup
CREATE UNIQUE INDEX IF NOT EXISTS leads_pf_lead_id_unique ON public.leads (pf_lead_id) WHERE pf_lead_id IS NOT NULL;
