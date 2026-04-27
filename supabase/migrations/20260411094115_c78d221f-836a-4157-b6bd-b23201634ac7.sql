ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brn text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS pf_status text,
  ADD COLUMN IF NOT EXISTS pf_url text,
  ADD COLUMN IF NOT EXISTS specializations text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_since integer;