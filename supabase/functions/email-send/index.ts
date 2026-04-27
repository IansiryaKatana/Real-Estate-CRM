import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveSecret } from "../_shared/integrationSecrets.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function sanitizeLocalPart(value: string): string {
  const local = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
  return local || "agent";
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let payload: {
    thread_id?: string;
    message?: string;
    html?: string;
    attachments?: Array<{ name?: string; type?: string; content?: string; size?: number }>;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const threadId = payload.thread_id?.trim();
  const message = payload.message?.trim() ?? "";
  const html = payload.html?.trim() ?? "";
  const plainFromHtml = html ? htmlToText(html) : "";
  const bodyText = message || plainFromHtml;
  if (!threadId || !bodyText) return json({ error: "thread_id and message/html are required" }, 400);

  const { data: thread, error: threadErr } = await userClient
    .from("email_threads")
    .select("id, subject, lead_id, leads(email, name)")
    .eq("id", threadId)
    .maybeSingle();
  if (threadErr || !thread) return json({ error: "Thread not found or not accessible" }, 404);

  const leadEmail = (thread as { leads?: { email?: string | null } }).leads?.email?.trim() ?? "";
  if (!isValidEmail(leadEmail)) return json({ error: "Lead does not have a valid email address" }, 400);

  const resendApiKey = await resolveSecret(admin, "resend_api_key", "RESEND_API_KEY");
  const resendFromDomain = await resolveSecret(admin, "resend_from_domain", "RESEND_FROM_DOMAIN");
  const resendReplyInbox = await resolveSecret(admin, "resend_reply_inbox", "RESEND_REPLY_INBOX");
  if (!resendApiKey || !resendFromDomain) {
    return json(
      {
        error:
          "Resend is not configured. Set resend_api_key and resend_from_domain in Settings -> Secrets.",
      },
      503,
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileEmail = profile?.email?.trim() ?? "";
  const senderLocal = profileEmail.includes("@")
    ? sanitizeLocalPart(profileEmail.split("@")[0] ?? "agent")
    : sanitizeLocalPart(profile?.full_name ?? "agent");
  const fromAddress = `${senderLocal}@${resendFromDomain.trim().toLowerCase()}`;

  const subject = thread.subject?.trim() || "Lead follow-up";
  const resendPayload: Record<string, unknown> = {
    from: fromAddress,
    to: [leadEmail],
    subject,
    text: bodyText,
    headers: { "X-CRM-Thread-Id": thread.id },
  };
  if (html) resendPayload.html = html;
  if (Array.isArray(payload.attachments) && payload.attachments.length > 0) {
    const mapped = payload.attachments
      .map((a) => ({
        filename: (a.name ?? "").trim(),
        content: (a.content ?? "").trim(),
        type: (a.type ?? "application/octet-stream").trim(),
      }))
      .filter((a) => a.filename.length > 0 && a.content.length > 0);
    if (mapped.length > 0) {
      resendPayload.attachments = mapped;
    }
  }
  if (isValidEmail(resendReplyInbox)) {
    resendPayload.reply_to = [resendReplyInbox.trim()];
  }

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendPayload),
  });
  const sendJson = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) {
    console.error("resend send error", sendRes.status, sendJson);
    return json({ error: "Resend send failed", details: sendJson }, 502);
  }

  const { error: messageErr } = await admin.from("email_messages").insert({
    thread_id: thread.id,
    direction: "outbound",
    from_address: fromAddress,
    to_address: leadEmail,
    body: bodyText,
  });
  if (messageErr) {
    console.error("email_messages insert error", messageErr);
    return json({ error: "Email sent but CRM logging failed" }, 500);
  }

  await admin
    .from("email_threads")
    .update({ last_message_at: new Date().toISOString(), is_unread: false })
    .eq("id", thread.id);

  await admin.from("lead_activities").insert({
    lead_id: thread.lead_id,
    type: "email",
    description: `Outbound email: ${bodyText.slice(0, 500)}`,
    user_name: profile?.full_name?.trim() || "Agent",
  });

  return json({ ok: true, from_address: fromAddress, to_address: leadEmail });
});
