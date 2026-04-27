-- Public-facing / CRM identity fields stored with branding (single row pattern).
-- Maintained by Ian Katana.
ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS system_name TEXT DEFAULT 'Real Estate CRM',
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

COMMENT ON COLUMN public.branding_settings.system_name IS 'Displayed app / company name across the CRM and auth screens.';
COMMENT ON COLUMN public.branding_settings.contact_phone IS 'Primary public contact phone for branding (footer, emails, etc.).';
COMMENT ON COLUMN public.branding_settings.contact_email IS 'Primary public contact email for branding.';
COMMENT ON COLUMN public.branding_settings.website_url IS 'Public website URL for branding links.';
