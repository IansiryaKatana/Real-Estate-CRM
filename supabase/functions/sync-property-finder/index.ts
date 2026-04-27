import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveSecret } from "../_shared/integrationSecrets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PF_BASE = "https://atlas.propertyfinder.com";

async function getAccessToken(admin: ReturnType<typeof createClient>): Promise<string> {
  const apiKey = await resolveSecret(admin, "pf_client_id", "PF_CLIENT_ID");
  const apiSecret = await resolveSecret(admin, "pf_client_secret", "PF_CLIENT_SECRET");
  if (!apiKey || !apiSecret) {
    throw new Error("PF credentials not configured (env or integration_secrets: pf_client_id, pf_client_secret)");
  }

  const res = await fetch(`${PF_BASE}/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ apiKey, apiSecret }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PF OAuth failed [${res.status}]: ${body}`);
  }

  const data = await res.json();
  const at = data.accessToken ?? data.access_token;
  if (!at || typeof at !== "string") {
    throw new Error("PF auth response missing accessToken");
  }
  return at;
}

async function pfGet(token: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${PF_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PF API ${path} failed [${res.status}]: ${body}`);
  }

  return res.json();
}

/** Atlas responses vary (`data` vs `results`). Skip empty arrays so a stale `results: []` does not hide `data`. */
function extractPagedItems(payload: any, preferredKey: string): any[] {
  if (!payload || typeof payload !== "object") return [];
  const tryOrder = [...new Set([preferredKey, "results", "data", "listings", "items"])];
  for (const k of tryOrder) {
    const v = payload[k];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return [];
}

async function fetchAllPages(token: string, path: string, resultKey: string, maxPerPage = 100) {
  const allItems: any[] = [];
  let page = 1;

  while (true) {
    const data = await pfGet(token, path, { page: String(page), perPage: String(maxPerPage) });
    const items = extractPagedItems(data, resultKey);
    if (!Array.isArray(items) || items.length === 0) break;
    allItems.push(...items);

    const pagination = data.pagination;
    if (pagination && page >= (pagination.totalPages ?? 1)) break;
    if (items.length < maxPerPage) break;
    page++;
  }

  return allItems;
}

/** Best-effort display name from listing.assignedTo (Atlas often embeds name here before /v1/users resolves). */
function extractAssignedAgentDisplayName(assignedTo: any): string | null {
  if (!assignedTo || typeof assignedTo !== "object") return null;
  const pp = assignedTo.publicProfile ?? assignedTo.profile;
  const nameObj = assignedTo.name;
  const localizedName =
    typeof nameObj === "string"
      ? nameObj.trim()
      : nameObj && typeof nameObj === "object"
        ? String(nameObj.en ?? nameObj.ar ?? "").trim()
        : "";
  const ppNameObj = pp?.name;
  const ppLocalized =
    typeof ppNameObj === "string"
      ? ppNameObj.trim()
      : ppNameObj && typeof ppNameObj === "object"
        ? String(ppNameObj.en ?? ppNameObj.ar ?? "").trim()
        : "";
  const direct = [assignedTo.fullName, localizedName, ppLocalized, pp?.fullName]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .find((s) => s.length > 0);
  const fromParts = `${assignedTo.firstName ?? pp?.firstName ?? ""} ${assignedTo.lastName ?? pp?.lastName ?? ""}`.trim();
  const best = direct || fromParts;
  return best.length > 0 ? best : null;
}

function mergeAgentDisplayName(map: Map<string, string>, pfAgentId: string, name: string | null) {
  const t = name?.trim();
  if (!t) return;
  const cur = map.get(pfAgentId);
  if (!cur || t.length > cur.length) map.set(pfAgentId, t);
}

/** Prefer real names from API or listing; avoid leaving generic "Agent <id>" when listing has a proper name. */
function pickAgentDisplayName(pfAgentId: string, apiName: string | undefined, listingName: string | undefined): string {
  const api = apiName?.trim() ?? "";
  const list = listingName?.trim() ?? "";
  const generic = (s: string) =>
    !s || s === `Agent ${pfAgentId}` || /^Agent\s+\d+$/i.test(s);
  if (!generic(api)) return api;
  if (!generic(list)) return list;
  if (api) return api;
  if (list) return list;
  return `Agent ${pfAgentId}`;
}

/** Atlas listings may expose the assignee under assignedTo, agent, or user. */
function getListingAssignee(listing: any): { raw: any; pfAgentId: string | null } {
  const raw =
    listing?.assignedTo ??
    listing?.agent ??
    listing?.assignedUser ??
    listing?.assigned_to ??
    listing?.user ??
    null;
  const id = raw?.id;
  const pfAgentId = id != null ? String(id).trim() : null;
  return { raw, pfAgentId };
}

/** PF lead assignee only — do not use lead.publicProfile (that is usually the sender/contact). */
function getLeadAgentPfId(lead: any): string | null {
  const listing = lead?.listing ?? lead?.property ?? lead?.listingInfo ?? null;
  const fromListing = getListingAssignee(listing).pfAgentId;

  const raw =
    lead?.assignedTo ??
    lead?.agent ??
    lead?.assignedUser ??
    lead?.assignee ??
    lead?.user ??
    null;
  if (raw && typeof raw === "object" && raw.id != null) {
    const id = String(raw.id).trim();
    if (id) return id;
  }
  if (fromListing) return fromListing;
  return null;
}

/** All strings we can try to match a synced property (pf_id / listing reference / Atlas variants). */
function collectLeadListingLookupKeys(lead: any): string[] {
  const keys: string[] = [];
  const add = (v: unknown) => {
    if (v == null) return;
    const s = String(v).trim();
    if (s) keys.push(s);
  };
  const listing = lead?.listing ?? lead?.property ?? lead?.listingInfo ?? null;
  add(listing?.id);
  add(listing?.listingId);
  add(listing?.listing_id);
  add(listing?.reference);
  add(listing?.listingReference);
  add(listing?.slug);
  const inner = listing?.listing;
  if (inner && typeof inner === "object") {
    add(inner.id);
    add(inner.reference);
  }
  add(lead?.listingReference);
  add(lead?.listing_reference);
  add(lead?.listingId);
  add(lead?.listing_id);
  add(lead?.listingRef);
  add(lead?.propertyId);
  add(lead?.property_id);
  return [...new Set(keys)];
}

function resolvePropertyIdForLead(
  lead: any,
  propMapByPfId: Map<string, string>,
  propMapByRef: Map<string, string>,
): string | null {
  for (const k of collectLeadListingLookupKeys(lead)) {
    const a = propMapByPfId.get(k) ?? propMapByRef.get(k) ?? null;
    if (a) return a;
    const ku = k.toUpperCase();
    const kl = k.toLowerCase();
    const b = propMapByRef.get(ku) ?? propMapByRef.get(kl) ?? null;
    if (b) return b;
  }
  return null;
}

function normalizePfKey(id: string | null | undefined): string | null {
  if (id == null) return null;
  const s = String(id).trim();
  return s.length > 0 ? s : null;
}

/** Resolve `Agent 123` style rows via GET /v1/users/:id (PF roster is often smaller than all assignees). */
async function fetchAllProfilesBasic(sb: any): Promise<{ id: string; pf_agent_id: string | null; full_name: string | null }[]> {
  const PAGE = 500;
  let from = 0;
  const acc: { id: string; pf_agent_id: string | null; full_name: string | null }[] = [];
  while (true) {
    const { data, error } = await sb
      .from("profiles")
      .select("id, pf_agent_id, full_name")
      .not("pf_agent_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data as { id: string; pf_agent_id: string | null; full_name: string | null }[] | null;
    if (!rows?.length) break;
    acc.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

/** Full pf_agent_id → profile UUID map (PostgREST returns max ~1000 rows per request). */
async function buildPfAgentResolveMap(sb: any): Promise<Map<string, string>> {
  const PAGE = 500;
  let from = 0;
  const m = new Map<string, string>();
  while (true) {
    const { data, error } = await sb
      .from("profiles")
      .select("id, pf_agent_id")
      .not("pf_agent_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data as { id: string; pf_agent_id: string | null }[] | null;
    if (!rows?.length) break;
    for (const a of rows) {
      const k = normalizePfKey(a.pf_agent_id);
      if (k) m.set(k, a.id);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return m;
}

async function enrichGenericAgentNamesFromPfUser(
  sb: any,
  token: string,
  hints: Map<string, string>,
  maxCalls: number,
): Promise<number> {
  const rows = await fetchAllProfilesBasic(sb);
  const targets = rows.filter((r: { full_name?: string | null; pf_agent_id?: string | null }) => {
    const fn = (r.full_name ?? "").trim();
    const pid = String(r.pf_agent_id ?? "").trim();
    return /^Agent\s+\d+$/i.test(fn) || fn === `Agent ${pid}`;
  });

  let updated = 0;
  let calls = 0;
  for (const row of targets) {
    if (calls >= maxCalls) break;
    const pid = String(row.pf_agent_id).trim();
    calls++;
    try {
      const user = await pfGet(token, `/v1/users/${pid}`, {});
      const apiLine =
        extractAssignedAgentDisplayName(user) ||
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
        undefined;
      const next = pickAgentDisplayName(pid, apiLine, hints.get(pid));
      if (next && next !== row.full_name && !/^Agent\s+\d+$/i.test(next)) {
        const { error } = await sb.from("profiles").update({ full_name: next }).eq("id", row.id);
        if (!error) updated++;
      }
    } catch {
      /* PF may 404 for users outside token scope */
    }
  }
  return updated;
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret")?.trim();

    if (!anonKey) {
      console.error("SUPABASE_ANON_KEY is not set on the Edge Function");
      return jsonResponse({ success: false, error: "Server misconfiguration" }, 500);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const sb = createClient(supabaseUrl, serviceKey);
    const cronSecret = (await resolveSecret(sb, "pf_sync_cron_secret", "PF_SYNC_CRON_SECRET"))?.trim();
    const cronAuthorized = !!cronSecret && !!cronSecretHeader && cronSecretHeader === cronSecret;

    if (!cronAuthorized) {
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, error: "Missing or invalid Authorization header" }, 401);
      }
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        return jsonResponse(
          { success: false, error: userErr?.message ?? "Unauthorized — sign in again." },
          401,
        );
      }
    }

    const pfAccessToken = await getAccessToken(sb);
    const results = { properties: 0, agents: 0, leads: 0, errors: [] as string[] };

    let allListings: any[] = [];
    let pfLeads: any[] = [];
    const pfAgentDisplayNames = new Map<string, string>();

    // ── 1. Sync Listings (Properties) ──
    let locationMap = new Map<number, string>();
    try {
      allListings = await fetchAllPages(pfAccessToken, "/v1/listings", "results");
      const listings = allListings;
      console.log(`Fetched ${listings.length} listings from PF`);

      // Resolve locations
      const locationIds = [...new Set(listings.map((l: any) => l.location?.id).filter(Boolean))];
      if (locationIds.length > 0) {
        try {
          const locRes = await fetch(`${PF_BASE}/v1/locations?id=${locationIds.join(",")}`, {
            headers: { Authorization: `Bearer ${pfAccessToken}`, Accept: "application/json" },
          });
          if (locRes.ok) {
            const locData = await locRes.json();
            for (const loc of (Array.isArray(locData.data) ? locData.data : [])) {
              if (loc.id && loc.name) locationMap.set(loc.id, loc.name);
            }
          } else {
            for (const term of ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"]) {
              try {
                const sRes = await fetch(`${PF_BASE}/v1/locations?search=${encodeURIComponent(term)}&perPage=100`, {
                  headers: { Authorization: `Bearer ${pfAccessToken}`, Accept: "application/json" },
                });
                if (sRes.ok) {
                  const sData = await sRes.json();
                  for (const loc of (sData.data ?? [])) {
                    if (loc.id && loc.name) locationMap.set(loc.id, loc.name);
                  }
                } else { await sRes.text(); }
              } catch (_) {}
            }
          }
        } catch (e) {
          console.warn("Location fetch error:", (e as Error).message);
        }
      }
      console.log(`Resolved ${locationMap.size} location names from ${locationIds.length} IDs`);

      for (const listing of listings) {
        const pfId = String(listing.id);
        const priceAmounts = listing.price?.amounts ?? {};
        const price = priceAmounts.sale ?? priceAmounts.yearly ?? priceAmounts.monthly ?? 0;
        const locationId = listing.location?.id;
        const locationName = locationMap.get(locationId) ?? listing.location?.fullName?.en ?? listing.location?.path ?? "Unknown";
        const { raw: assigneeRaw, pfAgentId: assigneePfId } = getListingAssignee(listing);
        if (assigneePfId && assigneeRaw) {
          const dn = extractAssignedAgentDisplayName(assigneeRaw);
          if (dn) mergeAgentDisplayName(pfAgentDisplayNames, assigneePfId, dn);
        }

        const propertyData = {
          pf_id: pfId,
          title: listing.title?.en ?? listing.title?.ar ?? `PF Listing ${pfId}`,
          location: locationName,
          price: Number(price),
          type: mapPropertyType(listing.type),
          bedrooms: mapBedrooms(listing.bedrooms),
          bathrooms: mapBedrooms(listing.bathrooms),
          area: Number(listing.size ?? listing.builtUpArea ?? 0),
          description: listing.description?.en ?? listing.description?.ar ?? null,
          pf_url: listing.portals?.propertyfinder?.isLive
            ? `https://www.propertyfinder.ae/en/plp/buy/search/?c=${pfId}`
            : null,
          images: extractImages(listing.media),
          listing_id: listing.reference ?? pfId,
          status: mapListingStatus(listing.state),
          commission_rate: 2,
          // New PF fields
          furnishing_type: listing.furnishingType ?? null,
          category: listing.category ?? null,
          amenities: Array.isArray(listing.amenities) ? listing.amenities : [],
          available_from: listing.availableFrom ?? null,
          project_status: listing.projectStatus ?? null,
          quality_score: listing.qualityScore?.value ?? 0,
          verification_status: listing.verificationStatus ?? null,
          emirate: listing.uaeEmirate ?? null,
          price_type: listing.price?.type ?? null,
          rera_number: listing.compliance?.listingAdvertisementNumber ?? null,
          pf_assigned_agent_id: assigneePfId,
          pf_created_at: listing.createdAt ?? null,
          pf_updated_at: listing.updatedAt ?? null,
        };

        const { error } = await sb.from("properties").upsert(propertyData, { onConflict: "pf_id" });
        if (error) results.errors.push(`Property ${pfId}: ${error.message}`);
        else results.properties++;
      }
    } catch (e) {
      results.errors.push(`Properties sync: ${(e as Error).message}`);
    }

    // Enrich agent display names from leads before syncing profiles (same payload often includes assignedTo).
    try {
      pfLeads = await fetchAllPages(pfAccessToken, "/v1/leads", "data", 50);
      console.log(`Fetched ${pfLeads.length} leads from PF`);
      for (const lead of pfLeads) {
        const pid = getLeadAgentPfId(lead);
        if (!pid) continue;
        const listing = lead?.listing ?? lead?.property ?? lead?.listingInfo ?? null;
        const raw = lead?.assignedTo ?? lead?.agent ?? getListingAssignee(listing).raw;
        if (raw) {
          const dn = extractAssignedAgentDisplayName(raw);
          if (dn) mergeAgentDisplayName(pfAgentDisplayNames, pid, dn);
        }
      }
    } catch (e) {
      results.errors.push(`Leads fetch (names): ${(e as Error).message}`);
    }

    // ── 2. Sync Users/Agents (PF as source of truth: only assignees on listings + leads) ──
    // Do not import the full /v1/users directory — that over-counts vs your PF roster on listings/leads.
    const neededAgentPfIds = new Set<string>();
    for (const l of allListings) {
      const k = normalizePfKey(getListingAssignee(l).pfAgentId);
      if (k) neededAgentPfIds.add(k);
    }
    for (const lead of pfLeads) {
      const k = normalizePfKey(getLeadAgentPfId(lead));
      if (k) neededAgentPfIds.add(k);
    }
    const rosterAgentPfIdCount = neededAgentPfIds.size;

    try {
      for (const pfAgentId of neededAgentPfIds) {
        let agentRes: any;
        try {
          agentRes = await pfGet(pfAccessToken, `/v1/users/${pfAgentId}`, {});
        } catch (_) {
          agentRes = null;
        }

        const fromListing = pfAgentDisplayNames.get(pfAgentId);
        const profile = agentRes?.publicProfile;
        let apiName: string | undefined;
        if (agentRes) {
          apiName =
            extractAssignedAgentDisplayName(agentRes) ??
            extractAssignedAgentDisplayName(profile) ??
            undefined;
          if (!apiName) {
            const fullName = `${agentRes.firstName ?? ""} ${agentRes.lastName ?? ""}`.trim();
            if (fullName) apiName = fullName;
          }
        }

        const agentName = pickAgentDisplayName(pfAgentId, apiName, fromListing);

        if (agentRes) {
          const agentData = {
            pf_agent_id: pfAgentId,
            full_name: agentName,
            email: agentRes.email ?? `agent_${pfAgentId}@pf.local`,
            phone: agentRes.mobile ?? profile?.phone ?? null,
            avatar_url: profile?.imageVariants?.large?.default ?? profile?.imageVariants?.large?.webp ?? null,
            department: "Sales",
            is_active: agentRes.status === "active",
            brn: agentRes.brn ?? profile?.brn ?? null,
            nationality: agentRes.nationality ?? profile?.nationality ?? null,
            languages: Array.isArray(agentRes.languages)
              ? agentRes.languages.map((l: any) => (typeof l === "string" ? l : l.name ?? l.code ?? String(l)))
              : [],
            title: agentRes.title ?? profile?.title ?? null,
            pf_status: agentRes.status ?? null,
            pf_url: profile?.url ?? profile?.link ?? null,
            specializations: Array.isArray(profile?.specializations) ? profile.specializations : [],
            experience_since: agentRes.experienceSince ?? profile?.experienceSince ?? null,
          };
          const { error } = await sb.from("profiles").upsert(agentData, { onConflict: "pf_agent_id" });
          if (error) results.errors.push(`Agent ${pfAgentId}: ${error.message}`);
          else results.agents++;
        } else {
          const stubRow: Record<string, unknown> = {
            pf_agent_id: pfAgentId,
            full_name: agentName,
            email: `agent_${pfAgentId}@pf.local`,
            department: "Sales",
            is_active: true,
          };
          const { error } = await sb.from("profiles").upsert(stubRow, { onConflict: "pf_agent_id" });
          if (error) results.errors.push(`Stub agent ${pfAgentId}: ${error.message}`);
          else results.agents++;
        }
      }

      // Remove PF-only profiles no longer referenced on any listing/lead (keeps roster aligned with PF data)
      const { data: pfOnlyRows, error: pfSelErr } = await sb
        .from("profiles")
        .select("id, pf_agent_id")
        .not("pf_agent_id", "is", null)
        .is("user_id", null);
      if (pfSelErr) {
        results.errors.push(`PF orphan scan: ${pfSelErr.message}`);
      } else {
        for (const row of pfOnlyRows ?? []) {
          const key = normalizePfKey(row.pf_agent_id);
          if (!key || neededAgentPfIds.has(key)) continue;
          await sb.from("leads").update({ assigned_agent_id: null }).eq("assigned_agent_id", row.id);
          await sb.from("deals").update({ assigned_agent_id: null }).eq("assigned_agent_id", row.id);
          await sb.from("commissions").update({ agent_id: null }).eq("agent_id", row.id);
          await sb.from("assignment_rules").update({ assign_to_agent_id: null }).eq("assign_to_agent_id", row.id);
          const { error: delErr } = await sb.from("profiles").delete().eq("id", row.id);
          if (delErr) results.errors.push(`Remove orphan agent ${key}: ${delErr.message}`);
        }
      }
    } catch (e) {
      results.errors.push(`Agents sync: ${(e as Error).message}`);
    }

    // ── 3. Sync Leads ──
    try {
      if (pfLeads.length === 0) {
        try {
          pfLeads = await fetchAllPages(pfAccessToken, "/v1/leads", "data", 50);
          console.log(`Fetched ${pfLeads.length} leads from PF (retry)`);
        } catch (e) {
          results.errors.push(`Leads fetch (upsert): ${(e as Error).message}`);
        }
      }

      // Pre-fetch mappings (case variants — PF refs often differ only by case)
      const { data: allProps } = await sb.from("properties").select("id, pf_id, listing_id").not("pf_id", "is", null);
      const propMapByPfId = new Map((allProps ?? []).map((p) => [String(p.pf_id!).trim(), p.id]));
      const propMapByRef = new Map<string, string>();
      for (const p of allProps ?? []) {
        const pf = p.pf_id != null ? String(p.pf_id).trim() : "";
        if (pf) {
          propMapByPfId.set(pf, p.id);
          propMapByRef.set(pf, p.id);
        }
        if (p.listing_id) {
          const lid = String(p.listing_id).trim();
          if (lid) {
            propMapByRef.set(lid, p.id);
            propMapByRef.set(lid.toLowerCase(), p.id);
            propMapByRef.set(lid.toUpperCase(), p.id);
          }
        }
      }

      const agentMap = await buildPfAgentResolveMap(sb);

      // Build lead records using pf_lead_id for upsert dedup
      const leadsToUpsert: any[] = [];
      for (const lead of pfLeads) {
        const pfLeadId = String(lead.id);
        
        // Extract contact info from sender.contacts array
        const rawContacts = [...(lead.sender?.contacts ?? []), ...(lead.contacts ?? [])];
        let phone: string | null = null;
        let email: string | null = null;
        for (const c of rawContacts) {
          const t = String(c?.type ?? "").toLowerCase();
          const v = typeof c?.value === "string" ? c.value.trim() : "";
          if (!v) continue;
          if ((t === "phone" || t === "mobile" || t === "whatsapp") && !phone) phone = v;
          if ((t === "email" || t === "e-mail" || t === "mail") && !email) email = v;
        }
        for (const e of lead.sender?.emails ?? []) {
          if (typeof e === "string" && e.includes("@") && !email) email = e.trim();
          else if (e && typeof e === "object" && typeof (e as any).value === "string" && (e as any).value.includes("@")) {
            if (!email) email = String((e as any).value).trim();
          }
        }
        email =
          email ??
          lead.sender?.email ??
          lead.email ??
          lead.contactEmail ??
          lead.contact_email ??
          null;
        phone = phone ?? lead.sender?.phone ?? lead.phone ?? lead.contactPhone ?? lead.contact_phone ?? null;

        const listingKeys = collectLeadListingLookupKeys(lead);
        const propertyId = resolvePropertyIdForLead(lead, propMapByPfId, propMapByRef);
        let pfListingRef: string | null = null;
        for (const k of listingKeys) {
          if (
            propMapByPfId.has(k) ||
            propMapByRef.has(k) ||
            propMapByRef.has(k.toUpperCase()) ||
            propMapByRef.has(k.toLowerCase())
          ) {
            pfListingRef = k;
            break;
          }
        }
        if (!pfListingRef && listingKeys.length > 0) pfListingRef = listingKeys[0];

        const agentPfId = normalizePfKey(getLeadAgentPfId(lead));
        const agentId = agentPfId ? agentMap.get(agentPfId) ?? null : null;

        leadsToUpsert.push({
          pf_lead_id: pfLeadId,
          name: lead.sender?.name ?? lead.name ?? lead.contactName ?? `PF Lead ${pfLeadId}`,
          email,
          phone,
          source: "property_finder" as const,
          status: mapLeadStatus(lead.status),
          property_id: propertyId,
          assigned_agent_id: agentId,
          notes: lead.message ? `PF Lead #${pfLeadId}. ${lead.message}`.trim() : null,
          // New PF fields
          channel: lead.channel ?? null,
          pf_status: lead.status ?? null,
          pf_response_link: lead.responseLink ?? null,
          pf_listing_ref: pfListingRef,
          pf_created_at: lead.createdAt ?? null,
        });
      }

      // Batch upsert in chunks of 200
      for (let i = 0; i < leadsToUpsert.length; i += 200) {
        const chunk = leadsToUpsert.slice(i, i + 200);
        const { error, data } = await sb.from("leads").upsert(chunk, { onConflict: "pf_lead_id" }).select("id");
        if (error) results.errors.push(`Leads batch ${i}: ${error.message}`);
        else results.leads += (data?.length ?? chunk.length);
      }

      // Older rows or ref-only payloads: attach property_id from stored pf_listing_ref
      const { data: missingPropLeads } = await sb
        .from("leads")
        .select("id, pf_listing_ref")
        .eq("source", "property_finder")
        .is("property_id", null)
        .not("pf_listing_ref", "is", null);
      for (const row of missingPropLeads ?? []) {
        const ref = row.pf_listing_ref?.trim();
        if (!ref) continue;
        const found =
          propMapByPfId.get(ref) ??
          propMapByRef.get(ref) ??
          propMapByRef.get(ref.toUpperCase()) ??
          propMapByRef.get(ref.toLowerCase());
        if (found) {
          const { error } = await sb.from("leads").update({ property_id: found }).eq("id", row.id);
          if (error) results.errors.push(`Lead property backfill ${row.id}: ${error.message}`);
        }
      }
    } catch (e) {
      results.errors.push(`Leads sync: ${(e as Error).message}`);
    }

    // Re-merge lead agent hints (e.g. leads loaded only on retry) and upgrade generic "Agent <id>" labels.
    try {
      for (const lead of pfLeads) {
        const pid = getLeadAgentPfId(lead);
        if (!pid) continue;
        const listing = lead?.listing ?? lead?.property ?? lead?.listingInfo ?? null;
        const raw = lead?.assignedTo ?? lead?.agent ?? getListingAssignee(listing).raw;
        if (raw) {
          const dn = extractAssignedAgentDisplayName(raw);
          if (dn) mergeAgentDisplayName(pfAgentDisplayNames, pid, dn);
        }
      }
      const prows = await fetchAllProfilesBasic(sb);
      for (const row of prows) {
        const pfKey = normalizePfKey(row.pf_agent_id);
        if (!pfKey) continue;
        const hint = pfAgentDisplayNames.get(pfKey);
        if (!hint) continue;
        const next = pickAgentDisplayName(pfKey, row.full_name ?? undefined, hint);
        if (next !== row.full_name) {
          const { error } = await sb.from("profiles").update({ full_name: next }).eq("id", row.id);
          if (error) results.errors.push(`Profile name patch ${row.id}: ${error.message}`);
        }
      }
    } catch (e) {
      results.errors.push(`Profile name patch: ${(e as Error).message}`);
    }

    try {
      const enriched = await enrichGenericAgentNamesFromPfUser(sb, pfAccessToken, pfAgentDisplayNames, 200);
      if (enriched > 0) console.log(`Enriched ${enriched} agent profile names from PF /v1/users/:id`);
    } catch (e) {
      results.errors.push(`Agent name enrichment: ${(e as Error).message}`);
    }

    let pfResolveMap = new Map<string, string>();
    try {
      pfResolveMap = await buildPfAgentResolveMap(sb);
    } catch (e) {
      results.errors.push(`Profile resolve map: ${(e as Error).message}`);
    }

    // ── 4. Post-sync: resolve pf_assigned_agent_id → profiles UUID for properties ──
    try {
      const { data: propsToFix } = await sb.from("properties").select("id, pf_assigned_agent_id").not("pf_assigned_agent_id", "is", null);
      for (const prop of (propsToFix ?? [])) {
        const key = normalizePfKey(prop.pf_assigned_agent_id);
        const agentUuid = key ? pfResolveMap.get(key) : undefined;
        if (agentUuid) {
          const { error } = await sb.from("property_agents").upsert(
            { property_id: prop.id, agent_id: agentUuid },
            { onConflict: "property_id,agent_id" },
          );
          if (error && !error.message.includes("duplicate")) {
            results.errors.push(`Property agent link ${prop.id}: ${error.message}`);
          }
        }
      }
    } catch (e) {
      results.errors.push(`Property agent resolve: ${(e as Error).message}`);
    }

    // ── 5. PF leads with no assignee: inherit from property_agents, else property.pf_assigned_agent_id (paginated — PostgREST max ~1000)
    try {
      const PAGE = 400;
      let offset = 0;
      while (true) {
        const { data: batch, error: qe } = await sb
          .from("leads")
          .select("id, property_id")
          .eq("source", "property_finder")
          .is("assigned_agent_id", null)
          .not("property_id", "is", null)
          .order("id", { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (qe) {
          results.errors.push(`Lead agent backfill query: ${qe.message}`);
          break;
        }
        const rows = batch ?? [];
        if (rows.length === 0) break;

        const propIds = [...new Set(rows.map((r: { property_id: string }) => r.property_id))];
        const { data: paRows } = await sb.from("property_agents").select("property_id, agent_id").in("property_id", propIds);
        const firstAgentByProp = new Map<string, string>();
        for (const row of paRows ?? []) {
          if (!firstAgentByProp.has(row.property_id)) firstAgentByProp.set(row.property_id, row.agent_id);
        }
        const { data: propRows } = await sb.from("properties").select("id, pf_assigned_agent_id").in("id", propIds);
        const pfAssignByProp = new Map<string, string | null>();
        for (const pr of propRows ?? []) {
          pfAssignByProp.set(pr.id, pr.pf_assigned_agent_id ?? null);
        }

        for (const row of rows) {
          let aid: string | undefined = firstAgentByProp.get(row.property_id);
          if (!aid) {
            const pfa = pfAssignByProp.get(row.property_id);
            const k = normalizePfKey(pfa);
            if (k) aid = pfResolveMap.get(k);
          }
          if (aid) {
            const { error } = await sb.from("leads").update({ assigned_agent_id: aid }).eq("id", row.id);
            if (error) results.errors.push(`Lead agent backfill ${row.id}: ${error.message}`);
          }
        }
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
    } catch (e) {
      results.errors.push(`Lead agent backfill: ${(e as Error).message}`);
    }

    const { data: pfSource } = await sb.from("ingestion_sources").select("id").eq("platform", "property_finder").maybeSingle();
    const { count: pfLeadCount } = await sb.from("leads").select("id", { count: "exact", head: true }).eq(
      "source",
      "property_finder",
    );
    if (pfSource) {
      await sb.from("ingestion_sources").update({
        last_sync: new Date().toISOString(),
        leads_ingested: pfLeadCount ?? 0,
      }).eq("id", pfSource.id);
    }

    // Audit log
    await sb.from("audit_log").insert({
      action: "sync", entity: "property_finder", user_name: "System",
      details: `Synced ${results.properties} properties, ${results.agents} agents, ${results.leads} leads. ${results.errors.length} errors.${results.errors.length > 0 ? " Errors: " + results.errors.slice(0, 5).join("; ") : ""}`,
    });

    const diagnostics = {
      fetched_listings: allListings.length,
      fetched_leads: pfLeads.length,
      wrote_properties: results.properties,
      wrote_agents: results.agents,
      wrote_leads: results.leads,
      roster_unique_pf_agent_ids: rosterAgentPfIdCount,
      roster_scope: "listing_and_lead_assignees_only",
      error_count: results.errors.length,
      error_preview: results.errors.slice(0, 8),
    };

    return new Response(JSON.stringify({ success: true, results, diagnostics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PF Sync error:", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapPropertyType(pfType: string | undefined): string {
  if (!pfType) return "apartment";
  const t = pfType.toLowerCase();
  if (t.includes("villa")) return "villa";
  if (t.includes("office") || t.includes("commercial") || t.includes("retail") || t.includes("shop") || t.includes("warehouse")) return "office";
  if (t.includes("penthouse")) return "penthouse";
  if (t.includes("townhouse") || t.includes("town")) return "townhouse";
  return "apartment";
}

function mapBedrooms(value: any): number {
  if (value === "studio" || value === "none") return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function mapListingStatus(state: any): string {
  const stage = state?.type ?? state?.stage ?? "";
  if (stage === "live") return "available";
  if (stage === "takendown" || stage === "archived") return "off_market";
  return "available";
}

function mapLeadStatus(pfStatus: string | undefined): string {
  if (!pfStatus) return "new";
  const s = pfStatus.toLowerCase();
  if (s === "replied" || s === "contacted") return "contacted";
  if (s === "closed" || s === "converted") return "closed_won";
  if (s === "rejected" || s === "spam") return "closed_lost";
  return "new";
}

function extractImages(media: any): string[] {
  if (!media) return [];
  const images = media.images ?? media.photos ?? media;
  if (!Array.isArray(images)) return [];
  return images
    .map((img: any) => {
      if (typeof img === "string") return img;
      return img.original?.url ?? img.url ?? img.large?.url ?? img.main?.url ??
        img.medium?.url ?? img.thumbnail?.url ??
        img.variants?.original?.url ?? img.variants?.large?.url ?? null;
    })
    .filter(Boolean)
    .slice(0, 20);
}
