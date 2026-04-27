import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";

export type Company = Tables<"companies">;
export type Portfolio = Tables<"portfolios">;
export type Property = Tables<"properties">;
export type Profile = Tables<"profiles">;
export type Lead = Tables<"leads">;
export type LeadActivity = Tables<"lead_activities">;
export type Deal = Tables<"deals">;
export type Commission = Tables<"commissions">;
export type EmailThread = Tables<"email_threads">;
export type EmailMessage = Tables<"email_messages">;
export type IngestionSource = Tables<"ingestion_sources">;
export type AssignmentRule = Tables<"assignment_rules">;
export type AuditEntry = Tables<"audit_log">;
export type Notification = Tables<"notifications">;
export type CatalogTemplate = Tables<"catalog_templates">;
export type BrandingSetting = Tables<"branding_settings">;

export function useBrandingSettings() {
  return useQuery({
    queryKey: ["branding_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branding_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function usePortfolios(companyId?: string | null) {
  return useQuery({
    queryKey: ["portfolios", companyId],
    queryFn: async () => {
      let q = supabase.from("portfolios").select("*").order("created_at");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*, property_agents(agent_id, profiles!property_agents_agent_id_fkey(full_name))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

/** Map PF agent id → display name from synced profiles (covers property.pf_assigned_agent_id when no junction row). */
export function buildPfAgentFullNameMap(
  profiles: { pf_agent_id?: string | null; full_name?: string | null }[] | null | undefined,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of profiles ?? []) {
    const k = p.pf_agent_id != null ? String(p.pf_agent_id).trim() : "";
    const n = p.full_name != null ? String(p.full_name).trim() : "";
    if (k && n) m.set(k, n);
  }
  return m;
}

/** Map profile UUID → full_name (any profile row, for when PostgREST embed is missing). */
export function buildProfileIdToFullNameMap(
  profiles: { id?: string; full_name?: string | null }[] | null | undefined,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of profiles ?? []) {
    const id = p.id != null ? String(p.id).trim() : "";
    const n = p.full_name != null ? String(p.full_name).trim() : "";
    if (id && n) m.set(id, n);
  }
  return m;
}

/** Property list/detail: junction agent → PF assignee id → profile map. */
export function resolvePropertyAssignedAgentName(
  property: Record<string, unknown>,
  pfAgentNames: Map<string, string>,
  profileIdToName?: Map<string, string>,
): string {
  const pas = property["property_agents"] as { agent_id?: string; profiles?: { full_name?: string | null } | null }[] | null | undefined;
  if (Array.isArray(pas)) {
    for (const pa of pas) {
      const n = pa?.profiles?.full_name?.trim();
      if (n) return n;
      const aid = pa?.agent_id != null ? String(pa.agent_id).trim() : "";
      if (aid && profileIdToName?.has(aid)) {
        const t = profileIdToName.get(aid)?.trim();
        if (t) return t;
      }
    }
  }
  const pfa = property["pf_assigned_agent_id"] != null ? String(property["pf_assigned_agent_id"]).trim() : "";
  if (pfa && pfAgentNames.has(pfa)) {
    const n = pfAgentNames.get(pfa)?.trim();
    if (n) return n;
  }
  return "Not assigned";
}

/** Property Finder–synced agents only (for pickers and dashboards). */
export function usePfAgentProfiles() {
  return useQuery({
    queryKey: ["profiles", "pf_only"],
    queryFn: async () => {
      const PAGE = 500;
      let from = 0;
      const acc: Profile[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .not("pf_agent_id", "is", null)
          .order("full_name")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data as Profile[] | null;
        if (!rows?.length) break;
        acc.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      return acc;
    },
  });
}

/** Resolved agent: assigned row → property_agents → property PF assignee (via profile map). */
export function getLeadAgentDisplayName(
  lead: Record<string, unknown>,
  pfAgentNames?: Map<string, string>,
  profileIdToName?: Map<string, string>,
): string {
  const profilesJoin = lead["profiles"] as { full_name?: string | null } | null | undefined;
  const direct = profilesJoin?.full_name?.trim();
  if (direct) return direct;

  const aidRaw = lead["assigned_agent_id"];
  const aid = aidRaw != null && aidRaw !== "" ? String(aidRaw).trim() : "";
  if (aid && profileIdToName?.has(aid)) {
    const n = profileIdToName.get(aid)?.trim();
    if (n) return n;
  }

  const properties = lead["properties"] as
    | {
        pf_assigned_agent_id?: string | null;
        property_agents?: { profiles?: { full_name?: string | null } | null }[] | null;
      }
    | null
    | undefined;
  const pas = properties?.property_agents;
  if (Array.isArray(pas)) {
    for (const pa of pas) {
      const n = pa?.profiles?.full_name?.trim();
      if (n) return n;
    }
  }

  const pfa = properties?.pf_assigned_agent_id != null ? String(properties.pf_assigned_agent_id).trim() : "";
  if (pfa && pfAgentNames?.has(pfa)) {
    const n = pfAgentNames.get(pfa)?.trim();
    if (n) return n;
  }

  return "Unassigned";
}

/** Paginate past PostgREST default max (1000 rows). Preserves row multiplicity for counts. */
async function fetchAllLeadAssignedAgentIds(): Promise<string[]> {
  const PAGE = 1000;
  let from = 0;
  const ids: string[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("assigned_agent_id")
      .not("assigned_agent_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data as { assigned_agent_id: string }[] | null;
    if (!rows?.length) break;
    for (const row of rows) {
      if (row.assigned_agent_id) ids.push(row.assigned_agent_id);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function fetchAllPropertyAgentIds(): Promise<string[]> {
  const PAGE = 1000;
  let from = 0;
  const ids: string[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("property_agents")
      .select("agent_id")
      .order("property_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data as { agent_id: string }[] | null;
    if (!rows?.length) break;
    for (const row of rows) {
      if (row.agent_id) ids.push(row.agent_id);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

export function useProfileWorkloadStats() {
  return useQuery({
    queryKey: ["profile_workload_stats"],
    queryFn: async () => {
      const [leadIdList, paIdList] = await Promise.all([fetchAllLeadAssignedAgentIds(), fetchAllPropertyAgentIds()]);
      const leadCounts = new Map<string, number>();
      const propertyCounts = new Map<string, number>();
      for (const id of leadIdList) {
        leadCounts.set(id, (leadCounts.get(id) ?? 0) + 1);
      }
      for (const id of paIdList) {
        propertyCounts.set(id, (propertyCounts.get(id) ?? 0) + 1);
      }
      return { leadCounts, propertyCounts };
    },
  });
}

/** Portal creation time on Property Finder when present; otherwise CRM row `created_at` (manual entry, other sources, or sync without PF timestamp). */
export function getLeadReceivedAtIso(lead: Record<string, unknown>): string | null {
  const pf = lead.pf_created_at;
  if (typeof pf === "string" && pf.trim().length > 0) return pf;
  const crm = lead.created_at;
  if (typeof crm === "string" && crm.trim().length > 0) return crm;
  return null;
}

function leadReceivedAtMs(lead: Record<string, unknown>): number {
  const iso = getLeadReceivedAtIso(lead);
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

const LEADS_SELECT =
  "*, properties(title, location, pf_assigned_agent_id, property_agents(agent_id, profiles!property_agents_agent_id_fkey(full_name))), profiles!leads_assigned_agent_id_fkey(full_name)";

const LEADS_PAGE_SIZE = 500;

async function fetchAllLeadsJoined(): Promise<Record<string, unknown>[]> {
  const acc: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select(LEADS_SELECT)
      .order("created_at", { ascending: false })
      .range(from, from + LEADS_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data as Record<string, unknown>[] | null;
    if (!rows?.length) break;
    acc.push(...rows);
    if (rows.length < LEADS_PAGE_SIZE) break;
    from += LEADS_PAGE_SIZE;
  }
  acc.sort((a, b) => leadReceivedAtMs(b) - leadReceivedAtMs(a));
  return acc;
}

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      return fetchAllLeadsJoined();
    },
  });
}

export function useLeadActivities(leadId?: string | null) {
  return useQuery({
    queryKey: ["lead_activities", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase.from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });
}

export function useDeals() {
  return useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*, leads(name), properties(title), profiles!deals_assigned_agent_id_fkey(full_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCommissions() {
  return useQuery({
    queryKey: ["commissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commissions").select("*, profiles!commissions_agent_id_fkey(full_name), deals(id)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useEmailThreads() {
  return useQuery({
    queryKey: ["email_threads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_threads").select("*, leads(name), email_messages(*)").order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useIngestionSources() {
  return useQuery({
    queryKey: ["ingestion_sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ingestion_sources").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useAssignmentRules() {
  return useQuery({
    queryKey: ["assignment_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_rules").select("*, profiles!assignment_rules_assign_to_agent_id_fkey(full_name)").order("priority");
      if (error) throw error;
      return data;
    },
  });
}

export function useAuditLog() {
  return useQuery({
    queryKey: ["audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data;
    },
  });
}

export function useNotifications(profileId?: string | null) {
  return useQuery({
    queryKey: ["notifications", profileId],
    queryFn: async () => {
      let q = supabase.from("notifications").select("*").order("created_at", { ascending: false });
      if (profileId) q = q.eq("user_id", profileId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: profileId !== undefined,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

export function useCatalogTemplates() {
  return useQuery({
    queryKey: ["catalog_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalog_templates").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export type WhatsAppMessage = Tables<"whatsapp_messages">;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function useUserRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_roles", user?.id],
    queryFn: async () => {
      if (!user) return [] as Enums<"app_role">[];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role) as Enums<"app_role">[];
    },
    enabled: !!user,
  });
}

export function useCurrentProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", "me", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useWhatsAppMessages(leadId?: string | null, leadPhone?: string | null) {
  return useQuery({
    queryKey: ["whatsapp_messages", leadId, leadPhone],
    queryFn: async () => {
      if (!leadId) return [];
      const phoneDigits = digitsOnly(leadPhone ?? "");
      const last10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";

      const orParts = [`lead_id.eq.${leadId}`];
      if (phoneDigits.length >= 8) {
        orParts.push(`contact_wa_id.ilike.%${phoneDigits}%`);
      }
      if (last10) {
        orParts.push(`contact_wa_id.ilike.%${last10}%`);
      }

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .or(orParts.join(","))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

// Helper types and constants kept for backward compat
export type LeadStatus = "new" | "contacted" | "qualified" | "viewing" | "negotiation" | "closed_won" | "closed_lost";
export type LeadSourceType = "bayut" | "property_finder" | "dubizzle" | "website" | "referral" | "walk_in";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 0 }).format(value);

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const leadStatusColors: Record<LeadStatus, string> = {
  new: "bg-primary/10 text-accent-foreground border-primary/20",
  contacted: "bg-warning/10 text-warning border-warning/20",
  qualified: "bg-success/10 text-success border-success/20",
  viewing: "bg-accent text-accent-foreground border-accent-foreground/20",
  negotiation: "bg-primary/15 text-primary border-primary/30",
  closed_won: "bg-success/20 text-success border-success/30",
  closed_lost: "bg-destructive/10 text-destructive border-destructive/20",
};

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  viewing: "Viewing",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const sourceLabels: Record<LeadSourceType, string> = {
  bayut: "Bayut",
  property_finder: "Property Finder",
  dubizzle: "Dubizzle",
  website: "Website",
  referral: "Referral",
  walk_in: "Walk-in",
};
