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

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function parseResendEmail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return normalizeEmail(m?.[0] ?? value);
  }
  if (typeof value === "object" && value !== null) {
    const email = (value as { email?: string }).email;
    if (typeof email === "string") return normalizeEmail(email);
  }
  return null;
}

function firstEmailFromAny(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseResendEmail(item);
      if (parsed) return parsed;
    }
    return null;
  }
  return parseResendEmail(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey);
  const webhookToken = await resolveSecret(admin, "resend_inbound_token", "RESEND_INBOUND_TOKEN");
  if (webhookToken) {
    const tokenFromUrl = new URL(req.url).searchParams.get("token");
    if (!tokenFromUrl || tokenFromUrl !== webhookToken) return json({ error: "Unauthorized" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  const maybeData = payload.data as Record<string, unknown> | undefined;
  const root = maybeData ?? payload;

  const fromEmail =
    firstEmailFromAny(root.from) ??
    firstEmailFromAny((root as { from_email?: unknown }).from_email) ??
    firstEmailFromAny((root as { sender?: unknown }).sender);
  const toEmail =
    firstEmailFromAny(root.to) ??
    firstEmailFromAny((root as { to_email?: unknown }).to_email) ??
    firstEmailFromAny((root as { recipients?: unknown }).recipients);
  const subject = String((root.subject as string | undefined) ?? "Inbound email").trim() || "Inbound email";
  const textBody = String((root.text as string | undefined) ?? (root.html as string | undefined) ?? "").trim();

  if (!fromEmail || !textBody) return json({ ok: true, skipped: "missing_sender_or_body" });

  const { data: lead } = await admin
    .from("leads")
    .select("id, name")
    .ilike("email", fromEmail)
    .limit(1)
    .maybeSingle();
  if (!lead) return json({ ok: true, skipped: "unmatched_lead" });

  let threadId: string | null = null;
  const headerThreadId = typeof root["X-CRM-Thread-Id"] === "string" ? (root["X-CRM-Thread-Id"] as string).trim() : "";
  if (headerThreadId) {
    const { data: byHeader } = await admin
      .from("email_threads")
      .select("id")
      .eq("id", headerThreadId)
      .eq("lead_id", lead.id)
      .maybeSingle();
    if (byHeader?.id) threadId = byHeader.id;
  }

  if (!threadId) {
    const { data: latestThread } = await admin
      .from("email_threads")
      .select("id")
      .eq("lead_id", lead.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestThread?.id) threadId = latestThread.id;
  }

  if (!threadId) {
    const { data: created, error: createErr } = await admin
      .from("email_threads")
      .insert({ lead_id: lead.id, subject, is_unread: true, last_message_at: new Date().toISOString() })
      .select("id")
      .maybeSingle();
    if (createErr || !created?.id) return json({ error: "Failed to create thread" }, 500);
    threadId = created.id;
  }

  const fromAddress = fromEmail;
  const toAddress = toEmail ?? "crm@local";
  const dedupeSinceIso = new Date(Date.now() - 60_000).toISOString();
  const { data: existingInbound } = await admin
    .from("email_messages")
    .select("id")
    .eq("thread_id", threadId)
    .eq("direction", "inbound")
    .eq("from_address", fromAddress)
    .eq("to_address", toAddress)
    .eq("body", textBody)
    .gte("created_at", dedupeSinceIso)
    .limit(1)
    .maybeSingle();
  if (existingInbound?.id) return json({ ok: true, deduped: true });

  const { error: msgErr } = await admin.from("email_messages").insert({
    thread_id: threadId,
    direction: "inbound",
    from_address: fromAddress,
    to_address: toAddress,
    body: textBody,
  });
  if (msgErr) return json({ error: msgErr.message }, 500);

  await admin
    .from("email_threads")
    .update({ last_message_at: new Date().toISOString(), is_unread: true, subject })
    .eq("id", threadId);

  await admin.from("lead_activities").insert({
    lead_id: lead.id,
    type: "email",
    description: `Inbound email: ${textBody.slice(0, 500)}`,
    user_name: fromEmail,
  });

  return json({ ok: true, lead_id: lead.id, thread_id: threadId });
});
