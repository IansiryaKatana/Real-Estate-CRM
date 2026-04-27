-- Integration secrets (WhatsApp, Property Finder, etc.) — managed in-app by management roles.
-- Edge Functions read Deno.env first, then fall back to this table (service role).

CREATE TABLE public.integration_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  description text,
  value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_secrets_slug ON public.integration_secrets(slug);

CREATE TRIGGER integration_secrets_updated_at
  BEFORE UPDATE ON public.integration_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;

-- Super admin, admin, manager (same as can_manage_team_data in app)
CREATE POLICY "integration_secrets_select_mgmt" ON public.integration_secrets
  FOR SELECT TO authenticated
  USING (public.can_manage_team_data());

CREATE POLICY "integration_secrets_insert_mgmt" ON public.integration_secrets
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team_data());

CREATE POLICY "integration_secrets_update_mgmt" ON public.integration_secrets
  FOR UPDATE TO authenticated
  USING (public.can_manage_team_data())
  WITH CHECK (public.can_manage_team_data());

CREATE POLICY "integration_secrets_delete_mgmt" ON public.integration_secrets
  FOR DELETE TO authenticated
  USING (public.can_manage_team_data());

-- Seed known keys (empty values; fill in Settings → Secrets)
INSERT INTO public.integration_secrets (slug, label, description, value) VALUES
  ('whatsapp_verify_token', 'WhatsApp verify token', 'Meta webhook verification (hub.verify_token)', ''),
  ('whatsapp_access_token', 'WhatsApp access token', 'Graph API permanent/system user token', ''),
  ('whatsapp_phone_number_id', 'WhatsApp phone number ID', 'Graph API phone_number_id for sends', ''),
  ('whatsapp_app_secret', 'WhatsApp app secret', 'Optional: X-Hub-Signature-256 verification', ''),
  ('pf_client_id', 'Property Finder client ID', 'Atlas API key (PF_CLIENT_ID)', ''),
  ('pf_client_secret', 'Property Finder client secret', 'Atlas API secret (PF_CLIENT_SECRET)', '')
ON CONFLICT (slug) DO NOTHING;
