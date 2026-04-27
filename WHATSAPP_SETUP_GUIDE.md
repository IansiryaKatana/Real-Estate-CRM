# WhatsApp Cloud API Setup Guide (CRM)

Developer: Ian Katana

This guide explains how to enable WhatsApp in the CRM using Meta WhatsApp Cloud API.

## 1) What this integration does

- Sales users send WhatsApp messages from `Communications` in CRM.
- Lead replies are received via webhook and saved in CRM.
- Full thread history is stored in `whatsapp_messages` (inbound + outbound).

## 2) Required credentials

Add these 4 values in CRM Settings -> Integration Secrets (or Supabase secrets):

- `whatsapp_access_token`
- `whatsapp_phone_number_id`
- `whatsapp_verify_token`
- `whatsapp_app_secret` (recommended for signature verification)

## 3) Where each value comes from

### `whatsapp_access_token`
- Meta Developer App -> WhatsApp -> API Setup -> Generate Access Token.

### `whatsapp_phone_number_id`
- Meta Developer App -> WhatsApp -> API Setup -> Phone Number ID.

### `whatsapp_verify_token`
- You create this manually (custom secret string).
- Use the exact same value in:
  - Meta webhook config `Verify token`
  - CRM secret `whatsapp_verify_token`

Example format:
- `your_company_wh_verify_random_string`

### `whatsapp_app_secret`
- Meta Developer App -> App settings -> Basic -> App Secret -> Show.

## 4) Meta app setup flow

1. Go to [https://developers.facebook.com](https://developers.facebook.com).
2. Create app using use case: **Connect with customers through WhatsApp**.
3. Select the correct business portfolio.
4. Open WhatsApp product (`Quickstart` / `API Setup`).
5. Generate access token and collect IDs.

## 5) Configure webhook

In Meta -> WhatsApp -> Configuration:

- Callback URL:
  - `https://<your-supabase-project-ref>.supabase.co/functions/v1/whatsapp-webhook`
- Verify token:
  - Must match `whatsapp_verify_token` secret exactly.
- Subscribe field:
  - `messages`

If verification fails, check callback URL and verify token match.

## 6) CRM/Supabase side requirements

Ensure these functions are deployed:

- `whatsapp-send`
- `whatsapp-webhook`

Ensure DB and policies are applied (includes `whatsapp_messages` table and RLS).

## 7) End-to-end test checklist

1. In CRM, open `Communications`.
2. Select a lead with valid phone number.
3. Send a WhatsApp message from CRM.
4. Confirm outbound success.
5. Reply from recipient WhatsApp.
6. Confirm inbound message appears in CRM thread.
7. Confirm `lead_activities` has WhatsApp entries.

## 8) Test number vs production number

- Meta test number works for initial validation only.
- Production requires a real WhatsApp Business number under the correct business portfolio/WABA ownership.

## 9) Common blockers

- Real number linked to another Business Manager.
- Wrong business portfolio selected during setup.
- Verify token mismatch.
- Missing `messages` webhook subscription.
- Invalid/missing lead phone causing no lead match.

## 10) Security notes

- Never hardcode access tokens/secrets in frontend code.
- Store sensitive values only in secrets storage.
- Rotate token/secret immediately if exposed.

## 11) Closed-tab web push notifications (optional, recommended)

This project now supports browser push notifications even when CRM tab is closed.

### A) Set backend secrets (Settings -> Secrets)

Add:

- `webpush_vapid_public_jwk` (JSON object string)
- `webpush_vapid_private_jwk` (JSON object string)
- `webpush_vapid_contact` (example: `mailto:ops@yourcompany.com`)

Generate VAPID keys (JWK pair + application server key) using:

- [https://github.com/negrel/webpush](https://github.com/negrel/webpush)

### B) Set frontend public key

In `.env` (frontend), set:

- `VITE_WEBPUSH_VAPID_PUBLIC_KEY=<application_server_public_key>`

This is public-safe and required for browser subscription.

### C) Service worker

`public/push-sw.js` is used to display push notifications and open CRM on click.

### D) Subscription storage

Browser/device subscriptions are stored in:

- `public.push_subscriptions`

### E) Trigger path

On inbound WhatsApp webhook:

1. Message stored in `whatsapp_messages`
2. Notification row inserted in `notifications`
3. Web push sent to active subscriptions of recipient profiles
