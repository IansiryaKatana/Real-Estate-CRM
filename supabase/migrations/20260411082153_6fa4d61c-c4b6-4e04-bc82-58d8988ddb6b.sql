
-- Create property_analytics table for PF stats
CREATE TABLE public.property_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  pf_listing_id text,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  leads_count integer NOT NULL DEFAULT 0,
  calls_count integer NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(pf_listing_id, date)
);

ALTER TABLE public.property_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read property_analytics" ON public.property_analytics FOR SELECT USING (true);
CREATE POLICY "Auth insert property_analytics" ON public.property_analytics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update property_analytics" ON public.property_analytics FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_property_analytics_updated_at
  BEFORE UPDATE ON public.property_analytics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add pf_id column to properties for mapping
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS pf_id text UNIQUE;

-- Add pf_id column to profiles for agent mapping  
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pf_agent_id text UNIQUE;

-- Enable pg_cron and pg_net for scheduled syncing
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
