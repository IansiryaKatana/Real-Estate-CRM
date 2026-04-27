# Email Communication Setup Guide (Resend + CRM)

Developer: Ian Katana

This guide explains how to enable lead email sending and receiving inside the CRM using Resend.

## 1) What this integration does

- Sales users send lead emails from `Communications`.
- Outbound emails are delivered through Resend using each salesperson identity on your verified domain.
- Lead replies are received by webhook and stored in CRM threads.
- Full history is stored in `email_threads` and `email_messages`.

## 2) Required secrets (Settings -> Secrets)

Add these values:

- `resend_api_key`
- `resend_from_domain` (example: `yourcompany.com`)
- `resend_reply_inbox` (example: `inbox@yourcompany.com`)
- `resend_inbound_token` (long random token)

## 3) Deploy and migrate

1. Run database migration:
   - `npx supabase db push`
2. Deploy edge functions:
   - `npx supabase functions deploy email-send`
   - `npx supabase functions deploy email-webhook`

## 4) Resend dashboard setup

### A) Verify your sending domain

In Resend:

1. Add your domain.
2. Configure DNS records exactly as Resend provides.
3. Wait until domain status is verified.

### B) Configure inbound route/webhook

Set inbound webhook URL to:

- `https://<your-project-ref>.supabase.co/functions/v1/email-webhook?token=<resend_inbound_token>`

Use the same token value from CRM secret `resend_inbound_token`.

### C) Reply mailbox

Use a valid mailbox on your verified domain as `resend_reply_inbox` (for example `inbox@yourcompany.com`).

## 5) Sender identity behavior

- CRM creates sender from salesperson identity on your domain.
- Example: salesperson profile email `john@yourcompany.com` -> sender `john@yourcompany.com`.
- If salesperson profile email is not on your verified domain, CRM falls back to a generated local-part on your domain.

Important:

- Resend will reject sending from unverified external domains (for example personal Gmail addresses).

## 6) CRM data requirements

For each lead conversation:

- Lead must have a valid email in `leads.email`.
- Email thread must exist in `email_threads` (the UI uses existing threads).

## 7) Security checklist

- Never hardcode API keys in frontend code.
- Keep `resend_api_key` only in Supabase secrets / integration secrets table.
- Protect inbound endpoint with `resend_inbound_token`.
- Rotate token/API key immediately if exposed.

## 8) Production DNS checklist

- SPF configured for your sending domain.
- DKIM configured and verified.
- DMARC policy configured (at minimum monitoring policy).
- Domain verification status is green in Resend.

## 9) End-to-end test checklist

1. Open CRM `Communications` -> Email tab.
2. Select a lead thread with valid lead email.
3. Send outbound email from CRM.
4. Confirm message appears in thread as outbound.
5. Reply from lead mailbox.
6. Confirm webhook records inbound message in same thread.
7. Confirm thread unread state updates and activity appears in `lead_activities`.

## 10) Common blockers

- `resend_from_domain` not verified in Resend.
- Missing `resend_api_key` or invalid key.
- Inbound webhook URL/token mismatch.
- Lead email missing/invalid.
- Reply sent to wrong inbox not connected to Resend route.
