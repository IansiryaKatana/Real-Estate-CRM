
DROP INDEX IF EXISTS leads_pf_lead_id_unique;
ALTER TABLE public.leads ADD CONSTRAINT leads_pf_lead_id_unique UNIQUE (pf_lead_id);
