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

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnon || !serviceKey) return json({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey);
  const token = await resolveSecret(admin, "whatsapp_access_token", "WHATSAPP_ACCESS_TOKEN");
  const phoneId = await resolveSecret(admin, "whatsapp_phone_number_id", "WHATSAPP_PHONE_NUMBER_ID");

  if (!token || !phoneId) {
    return json({
      error:
        "WhatsApp Cloud API not configured. Set WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID (secrets) or add whatsapp_access_token / whatsapp_phone_number_id in Settings → Secrets.",
    }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let payload: { lead_id?: string; message?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const leadId = payload.lead_id;
  const text = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!leadId || !text) return json({ error: "lead_id and message are required" }, 400);

  const { data: lead, error: leadErr } = await userClient
    .from("leads")
    .select("id, phone")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr || !lead?.phone) {
    return json({ error: "Lead not found or missing phone number" }, 400);
  }

  const to = digitsOnly(String(lead.phone));
  if (to.length < 8) return json({ error: "Invalid phone number on lead" }, 400);

  const { data: prof } = await admin.from("profiles").select("id, full_name").eq("user_id", user.id).maybeSingle();

  const graphUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const graphRes = await fetch(graphUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  const graphJson = await graphRes.json().catch(() => ({}));
  if (!graphRes.ok) {
    console.error("WhatsApp Graph error", graphRes.status, graphJson);
    return json({ error: "WhatsApp send failed", details: graphJson }, 502);
  }

  const waMid =
    (graphJson as { messages?: { id?: string }[] })?.messages?.[0]?.id ?? null;

  const { data: inserted, error: insErr } = await admin
    .from("whatsapp_messages")
    .insert({
      lead_id: leadId,
      direction: "outbound",
      body: text,
      wa_message_id: waMid,
      contact_wa_id: to,
      sent_by_profile_id: prof?.id ?? null,
      provider_status: "sent",
    })
    .select("id")
    .maybeSingle();

  if (insErr) console.error("whatsapp_messages insert", insErr);

  await admin.from("lead_activities").insert({
    lead_id: leadId,
    type: "whatsapp",
    description: `Outbound WhatsApp: ${text.slice(0, 500)}`,
    user_name: prof?.full_name?.trim() || "Agent",
  });

  return json({ ok: true, message_id: inserted?.id ?? null, wa_message_id: waMid });
});
