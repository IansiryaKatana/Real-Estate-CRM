-- Operational defaults (used app-wide when wired to formatters).
ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'aed',
  ADD COLUMN IF NOT EXISTS default_timezone TEXT DEFAULT 'Asia/Dubai';

COMMENT ON COLUMN public.branding_settings.default_currency IS 'ISO-style lowercase code: aed, usd, eur, gbp.';
COMMENT ON COLUMN public.branding_settings.default_timezone IS 'IANA timezone e.g. Asia/Dubai.';
