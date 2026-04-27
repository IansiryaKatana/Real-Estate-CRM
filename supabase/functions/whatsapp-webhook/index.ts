import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveSecret } from "../_shared/integrationSecrets.ts";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Match Meta `from` to CRM phone (handles country-code / formatting differences). */
function matchLeadId(
  rows: { id: string; phone: string | null }[] | null,
  fromWa: string,
): string | null {
  const a = digitsOnly(fromWa);
  if (a.length < 8) return null;
  for (const row of rows ?? []) {
    const b = digitsOnly(row.phone ?? "");
    if (!b) continue;
    if (a === b) return row.id;
    if (a.length >= 10 && b.length >= 10) {
      const sa = a.slice(-10);
      const sb = b.slice(-10);
      if (sa === sb) return row.id;
    }
    if (a.endsWith(b) || b.endsWith(a)) return row.id;
  }
  return null;
}

async function verifyMetaSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const expectedHex = signature.slice(7);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== expectedHex.length) return false;
  let ok = 0;
  for (let i = 0; i < hex.length; i++) ok |= hex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return ok === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceKey);
  const verifyToken = await resolveSecret(admin, "whatsapp_verify_token", "WHATSAPP_VERIFY_TOKEN");
  const appSecretResolved = await resolveSecret(admin, "whatsapp_app_secret", "WHATSAPP_APP_SECRET");
  const webPushPublicJwkRaw = await resolveSecret(admin, "webpush_vapid_public_jwk", "WEBPUSH_VAPID_PUBLIC_JWK");
  const webPushPrivateJwkRaw = await resolveSecret(admin, "webpush_vapid_private_jwk", "WEBPUSH_VAPID_PRIVATE_JWK");
  const webPushContactRaw = await resolveSecret(admin, "webpush_vapid_contact", "WEBPUSH_VAPID_CONTACT");

  let webPushServer: webpush.ApplicationServer | null = null;
  if (webPushPublicJwkRaw && webPushPrivateJwkRaw) {
    try {
      const vapidKeys = await webpush.importVapidKeys({
        publicKey: JSON.parse(webPushPublicJwkRaw) as JsonWebKey,
        privateKey: JSON.parse(webPushPrivateJwkRaw) as JsonWebKey,
      });
      const contact = webPushContactRaw?.trim()
        ? (webPushContactRaw.startsWith("mailto:") ? webPushContactRaw : `mailto:${webPushContactRaw}`)
        : "mailto:admin@example.com";
      webPushServer = await webpush.ApplicationServer.new({
        contactInformation: contact,
        vapidKeys,
      });
    } catch (e) {
      console.error("webpush vapid init failed", e);
    }
  }

  if (req.method === "GET") {
    const u = new URL(req.url);
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && verifyToken && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();

  if (appSecretResolved) {
    const sig = req.headers.get("X-Hub-Signature-256");
    const ok = await verifyMetaSignature(rawBody, sig, appSecretResolved);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const entries = body.entry as Record<string, unknown>[] | undefined;
  const supabase = admin;
  const allMessages: Record<string, unknown>[] = [];
  const allStatuses: Record<string, unknown>[] = [];
  const managementRoles = ["super_admin", "admin", "manager"];

  for (const entry of entries ?? []) {
    const changes = entry?.changes as Record<string, unknown>[] | undefined;
    for (const change of changes ?? []) {
      const value = change?.value as Record<string, unknown> | undefined;
      const messages = value?.messages as Record<string, unknown>[] | undefined;
      const statuses = value?.statuses as Record<string, unknown>[] | undefined;
      if (messages?.length) allMessages.push(...messages);
      if (statuses?.length) allStatuses.push(...statuses);
    }
  }

  // Outbound delivery/read/failed updates arrive in `statuses`.
  for (const st of allStatuses) {
    const waMessageId = String(st.id ?? "");
    if (!waMessageId) continue;
    const providerStatusRaw = st.status;
    const providerStatus =
      typeof providerStatusRaw === "string" && providerStatusRaw.trim().length > 0
        ? providerStatusRaw.trim().toLowerCase()
        : null;

    const { error: upErr } = await supabase
      .from("whatsapp_messages")
      .update({
        provider_status: providerStatus,
        raw_payload: body as unknown as Record<string, unknown>,
      })
      .eq("wa_message_id", waMessageId)
      .eq("direction", "outbound");
    if (upErr) console.error("whatsapp status update", waMessageId, upErr);
  }

  if (!allMessages.length) {
    if (allStatuses.length > 0) {
      console.log("whatsapp webhook statuses processed", { count: allStatuses.length });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: leadRows, error: leadErr } = await supabase.from("leads").select("id, phone, assigned_agent_id, name");
  if (leadErr) {
    console.error("whatsapp-webhook leads fetch", leadErr);
  }
  const leadById = new Map<string, { assigned_agent_id: string | null; name: string | null }>();
  for (const row of leadRows ?? []) {
    leadById.set(row.id, {
      assigned_agent_id: (row as { assigned_agent_id?: string | null }).assigned_agent_id ?? null,
      name: (row as { name?: string | null }).name ?? null,
    });
  }

  const { data: managerRoleRows, error: managerRoleErr } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", managementRoles);
  if (managerRoleErr) {
    console.error("whatsapp-webhook manager roles fetch", managerRoleErr);
  }
  const managerUserIds = [...new Set((managerRoleRows ?? []).map((r) => r.user_id).filter(Boolean))];
  const managerProfileIds = new Set<string>();
  if (managerUserIds.length > 0) {
    const { data: managerProfiles, error: managerProfilesErr } = await supabase
      .from("profiles")
      .select("id, user_id")
      .in("user_id", managerUserIds);
    if (managerProfilesErr) {
      console.error("whatsapp-webhook manager profiles fetch", managerProfilesErr);
    }
    for (const p of managerProfiles ?? []) {
      if (p.id) managerProfileIds.add(p.id);
    }
  }

  const seenInboundMessageIds = new Set<string>();
  for (const msg of allMessages) {
    const type = msg.type as string | undefined;
    if (type !== "text") continue;
    const from = String(msg.from ?? "");
    const textBody = (msg.text as { body?: string } | undefined)?.body ?? "";
    const waMessageId = String(msg.id ?? "");
    if (!waMessageId) continue;
    if (seenInboundMessageIds.has(waMessageId)) continue;
    seenInboundMessageIds.add(waMessageId);

    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();
    if (existing) continue;

    const leadId = matchLeadId(leadRows ?? [], from);
    if (!leadId) {
      console.warn("whatsapp inbound unmatched lead", { from, waMessageId });
    }

    const { error: insErr } = await supabase.from("whatsapp_messages").insert({
      lead_id: leadId,
      direction: "inbound",
      body: textBody,
      wa_message_id: waMessageId,
      contact_wa_id: from,
      raw_payload: body as unknown as Record<string, unknown>,
    });
    if (insErr) {
      if ((insErr as { code?: string }).code !== "23505") {
        console.error("whatsapp insert", insErr);
      }
      // If insert failed (duplicate/other), skip downstream side-effects to avoid double notifications.
      continue;
    }

    if (leadId && textBody) {
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        type: "whatsapp",
        description: `Inbound WhatsApp: ${textBody.slice(0, 500)}`,
        user_name: "WhatsApp",
      });
    }

    // Notify assigned agent + managers/admin/super-admin on inbound WhatsApp.
    const recipientIds = new Set<string>(managerProfileIds);
    if (leadId) {
      const assigned = leadById.get(leadId)?.assigned_agent_id ?? null;
      if (assigned) recipientIds.add(assigned);
    }
    if (recipientIds.size > 0) {
      const leadName = leadId ? (leadById.get(leadId)?.name?.trim() || "lead") : "unknown lead";
      const preview = textBody.trim() ? textBody.trim().slice(0, 120) : "New WhatsApp message received";
      const notifMessage = leadId ? preview : `${preview} (${from})`;
      const recipientList = [...recipientIds];

      // Guard against duplicate webhook deliveries creating duplicate notifications.
      // Keep a short window so two identical retries for the same inbound message are collapsed.
      const cutoffIso = new Date(Date.now() - 45_000).toISOString();
      const recentQuery = supabase
        .from("notifications")
        .select("user_id")
        .in("user_id", recipientList)
        .eq("type", "whatsapp")
        .eq("entity_type", "lead")
        .eq("message", notifMessage)
        .gte("created_at", cutoffIso);
      const { data: recentNotifs, error: recentNotifsErr } = leadId
        ? await recentQuery.eq("entity_id", leadId)
        : await recentQuery.is("entity_id", null);
      if (recentNotifsErr) {
        console.error("whatsapp notifications dedupe fetch", recentNotifsErr);
      }
      const alreadyNotifiedUserIds = new Set((recentNotifs ?? []).map((n) => n.user_id).filter(Boolean));
      const rows = recipientList
        .filter((profileId) => !alreadyNotifiedUserIds.has(profileId))
        .map((profileId) => ({
          user_id: profileId,
          title: leadId ? `WhatsApp reply from ${leadName}` : "Unmatched WhatsApp message",
          message: notifMessage,
          type: "whatsapp",
          is_read: false,
          entity_type: "lead",
          entity_id: leadId,
          external_event_id: `wa_inbound:${waMessageId}:recipient:${profileId}`,
        }));
      if (rows.length > 0) {
        const { error: notifErr } = await supabase.from("notifications").insert(rows);
        if (notifErr && (notifErr as { code?: string }).code !== "23505") {
          console.error("whatsapp notifications insert", notifErr);
        }
      }

      if (webPushServer) {
        const { data: subscriptions, error: subsErr } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .in("profile_id", [...recipientIds])
          .eq("is_active", true);
        if (subsErr) {
          console.error("webpush subscriptions fetch", subsErr);
        } else {
          for (const sub of subscriptions ?? []) {
            try {
              const subscriber = webPushServer.subscribe({
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              });
              await subscriber.pushTextMessage(
                JSON.stringify({
                  title: leadId ? `WhatsApp reply from ${leadName}` : "Unmatched WhatsApp message",
                  body: preview,
                  url: leadId ? `/communications?lead=${leadId}` : "/communications",
                }),
                { urgency: webpush.Urgency.High, ttl: 300 },
              );
            } catch (pushErr) {
              if (pushErr instanceof webpush.PushMessageError && pushErr.isGone()) {
                await supabase.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
              } else {
                console.error("webpush send failed", pushErr);
              }
            }
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
