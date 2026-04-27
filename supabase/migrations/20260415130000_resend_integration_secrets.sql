-- Seed Resend-related integration secret keys (idempotent).
INSERT INTO public.integration_secrets (slug, label, description, value)
VALUES
  ('resend_api_key', 'Resend API key', 'API key used for outbound lead emails through Resend', ''),
  ('resend_from_domain', 'Resend from domain', 'Verified sending domain, e.g. yourcompany.com', ''),
  ('resend_reply_inbox', 'Resend reply inbox', 'Mailbox on your domain that receives lead replies, e.g. inbox@yourcompany.com', ''),
  ('resend_inbound_token', 'Resend inbound webhook token', 'Shared token for securing the email inbound webhook URL', '')
ON CONFLICT (slug) DO NOTHING;
