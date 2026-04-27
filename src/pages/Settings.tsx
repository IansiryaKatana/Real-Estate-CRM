import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Palette, Type, Image, Eye, Save, RotateCcw, Loader2, Trash2, Building2, Phone, Mail, Globe, Upload, MessageCircle, KeyRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIngestionSources, useBrandingSettings, useUserRoles } from "@/hooks/useSupabaseData";
import { IntegrationSecretsTab } from "@/components/settings/IntegrationSecretsTab";
import { canSeeSettingsTab } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";
import { DEFAULT_SYSTEM_NAME } from "@/contexts/BrandingContext";
import { formatDistanceToNow } from "date-fns";
import LeadEnginePage from "@/pages/LeadEngine";
import AuditLogPage from "@/pages/AuditLog";
import RBACPage from "@/pages/RBAC";
import { FontPicker } from "@/components/branding/FontPicker";
import {
  DEFAULT_BODY_FONT,
  DEFAULT_HEADING_FONT,
  resolveBodyFontFromDb,
  resolveHeadingFontFromDb,
} from "@/lib/googleFontUtils";
import { removeBrandingObjectAtUrl, uploadBrandingLogo } from "@/lib/brandingStorage";
import { getNotificationUiPrefs, setNotificationUiPrefs } from "@/lib/notificationUiPrefs";

const SETTINGS_TAB_IDS = new Set([
  "secrets", "branding", "integrations", "notifications", "general", "data",
  "lead-engine", "audit-log", "access-control",
]);

const SETTINGS_TAB_ORDER = [
  "secrets", "integrations", "notifications", "general", "lead-engine", "branding", "data", "audit-log", "access-control",
] as const;

export default function SettingsPage() {
  const { data: rolesRaw = [], isLoading: rolesLoading } = useUserRoles();
  const roles = rolesRaw as AppRole[];
  const allowedTabs = useMemo(
    () => SETTINGS_TAB_ORDER.filter((t) => canSeeSettingsTab(t, roles)),
    [roles],
  );

  const { data: sources = [] } = useIngestionSources();
  const { data: brandingRow } = useBrandingSettings();
  const [primaryColor, setPrimaryColor] = useState("#1a5c3a");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#e5a100");
  const [fontHeading, setFontHeading] = useState(DEFAULT_HEADING_FONT);
  const [fontBody, setFontBody] = useState(DEFAULT_BODY_FONT);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [systemName, setSystemName] = useState(DEFAULT_SYSTEM_NAME);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("aed");
  const [defaultTimezone, setDefaultTimezone] = useState("Asia/Dubai");
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    new_lead: true, missed_followup: true, status_changes: true, commission_updates: false, system_alerts: true, sound_enabled: true, popup_enabled: true,
  });
  const qc = useQueryClient();
  const [purgePropertiesOpen, setPurgePropertiesOpen] = useState(false);
  const [purgeLeadsOpen, setPurgeLeadsOpen] = useState(false);
  const [purgePfAgentsOpen, setPurgePfAgentsOpen] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purgeBusy, setPurgeBusy] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "";

  const activeTab = useMemo(() => {
    if (allowedTabs.length === 0) return "secrets";
    if (tabParam && allowedTabs.includes(tabParam) && SETTINGS_TAB_IDS.has(tabParam)) return tabParam;
    return allowedTabs[0];
  }, [allowedTabs, tabParam]);

  useEffect(() => {
    if (allowedTabs.length === 0) return;
    if (!tabParam || !allowedTabs.includes(tabParam)) {
      setSearchParams({ tab: allowedTabs[0] }, { replace: true });
    }
  }, [allowedTabs, tabParam, setSearchParams]);

  const handleSettingsTabChange = (v: string) => {
    setSearchParams(v === allowedTabs[0] ? {} : { tab: v }, { replace: true });
  };

  const settingsSubtitle =
    activeTab === "secrets" ? "API keys and integration credentials" :
    activeTab === "lead-engine" ? "Syncing, ingestion, rules, and assignment" :
    activeTab === "audit-log" ? "System activity history" :
    activeTab === "access-control" ? "Users, roles, and permissions" :
    "Configuration and integrations";

  useEffect(() => {
    if (brandingRow === undefined) return;
    if (!brandingRow) return;
    const b = brandingRow;
    if (b.primary_color) setPrimaryColor(b.primary_color);
    setSecondaryColor(b.secondary_color ?? "#0f172a");
    if (b.accent_color) setAccentColor(b.accent_color);
    setFontHeading(resolveHeadingFontFromDb(b.font_heading));
    setFontBody(resolveBodyFontFromDb(b.font_body));
    setSystemName(b.system_name?.trim() || DEFAULT_SYSTEM_NAME);
    setContactPhone(b.contact_phone ?? "");
    setContactEmail(b.contact_email ?? "");
    setWebsiteUrl(b.website_url ?? "");
    setLogoUrl(b.logo_url ?? "");
    setDefaultCurrency(b.default_currency ?? "aed");
    setDefaultTimezone(b.default_timezone ?? "Asia/Dubai");
  }, [brandingRow]);

  useEffect(() => {
    const prefs = getNotificationUiPrefs();
    setNotifPrefs((prev) => ({
      ...prev,
      sound_enabled: prefs.sound_enabled,
      popup_enabled: prefs.popup_enabled,
    }));
  }, []);

  const insertBrandingShell = async (): Promise<string> => {
    const { data, error } = await supabase
      .from("branding_settings")
      .insert({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        font_heading: fontHeading,
        font_body: fontBody,
        system_name: systemName.trim() || DEFAULT_SYSTEM_NAME,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        website_url: websiteUrl.trim() || null,
        default_currency: defaultCurrency,
        default_timezone: defaultTimezone,
      })
      .select("id")
      .single();
    if (error) throw error;
    void qc.invalidateQueries({ queryKey: ["branding_settings"] });
    return data.id;
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoUploading(true);
    try {
      const id = brandingRow?.id ?? (await insertBrandingShell());
      const previousUrl = logoUrl;
      const url = await uploadBrandingLogo(file, id);
      if (previousUrl) await removeBrandingObjectAtUrl(previousUrl);
      const { error } = await supabase.from("branding_settings").update({ logo_url: url }).eq("id", id);
      if (error) throw error;
      setLogoUrl(url);
      toast.success("Logo uploaded");
      await qc.invalidateQueries({ queryKey: ["branding_settings"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not upload logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl) return;
    const id = brandingRow?.id;
    try {
      await removeBrandingObjectAtUrl(logoUrl);
      if (id) {
        await supabase.from("branding_settings").update({ logo_url: null }).eq("id", id);
      }
      setLogoUrl("");
      toast.success("Logo removed");
      await qc.invalidateQueries({ queryKey: ["branding_settings"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not remove logo");
    }
  };

  const handleSaveBranding = async () => {
    const em = contactEmail.trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.error("Enter a valid contact email or leave it empty.");
      return;
    }
    const web = websiteUrl.trim();
    if (web && !/^https?:\/\//i.test(web)) {
      toast.error("Website must start with http:// or https://.");
      return;
    }
    setSaving(true);
    const { data: existing } = await supabase.from("branding_settings").select("id").limit(1);
    const payload = {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      font_heading: fontHeading,
      font_body: fontBody,
      system_name: systemName.trim() || DEFAULT_SYSTEM_NAME,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      website_url: websiteUrl.trim() || null,
      logo_url: logoUrl.trim() || null,
      default_currency: defaultCurrency,
      default_timezone: defaultTimezone,
    };
    if (existing && existing.length > 0) {
      await supabase.from("branding_settings").update(payload).eq("id", existing[0].id);
    } else {
      await supabase.from("branding_settings").insert(payload);
    }
    toast.success("Branding saved");
    qc.invalidateQueries({ queryKey: ["branding_settings"] });
    setSaving(false);
  };

  const handleResetBranding = () => {
    setPrimaryColor("#1a5c3a");
    setSecondaryColor("#0f172a");
    setAccentColor("#e5a100");
    setFontHeading(DEFAULT_HEADING_FONT);
    setFontBody(DEFAULT_BODY_FONT);
    setSystemName(DEFAULT_SYSTEM_NAME);
    setContactPhone("");
    setContactEmail("");
    setWebsiteUrl("");
    toast.info("Reset to defaults (save to apply)");
  };

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      const { data: existing } = await supabase.from("branding_settings").select("id").limit(1);
      const patch = { default_currency: defaultCurrency, default_timezone: defaultTimezone };
      if (existing && existing.length > 0) {
        const { error } = await supabase.from("branding_settings").update(patch).eq("id", existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branding_settings").insert({
          ...patch,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          font_heading: fontHeading,
          font_body: fontBody,
          system_name: systemName.trim() || DEFAULT_SYSTEM_NAME,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
          website_url: websiteUrl.trim() || null,
          logo_url: logoUrl.trim() || null,
        });
        if (error) throw error;
      }
      toast.success("Regional defaults saved");
      await qc.invalidateQueries({ queryKey: ["branding_settings"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveNotifications = async () => {
    setNotificationUiPrefs({
      sound_enabled: Boolean(notifPrefs.sound_enabled),
      popup_enabled: Boolean(notifPrefs.popup_enabled),
    });
    await supabase.from("audit_log").insert({
      action: "update", entity: "notification_preferences", user_name: "System",
      details: JSON.stringify(notifPrefs),
    });
    toast.success("Notification preferences saved");
  };

  const resetPurgeDialog = () => {
    setPurgeConfirm("");
    setPurgePropertiesOpen(false);
    setPurgeLeadsOpen(false);
    setPurgePfAgentsOpen(false);
  };

  const requireDeleteToken = () => {
    if (purgeConfirm.trim() !== "DELETE") {
      toast.error('Type DELETE in the box to confirm.');
      return false;
    }
    return true;
  };

  const rpcToastError = (error: { message: string; details?: string; hint?: string }) => {
    const parts = [error.message, error.details, error.hint].filter((s): s is string => Boolean(s?.trim()));
    toast.error(parts.length ? parts.join(" — ") : "Request failed");
  };

  const handlePurgeProperties = async () => {
    if (!requireDeleteToken()) return;
    setPurgeBusy(true);
    const { data, error } = await supabase.rpc("admin_delete_all_properties", { p_confirm: "DELETE" });
    setPurgeBusy(false);
    if (error) {
      rpcToastError(error);
      return;
    }
    const purge = data as { ok?: boolean; error?: string; sqlstate?: string } | null;
    if (purge && purge.ok === false) {
      toast.error(purge.error ? `${purge.error}${purge.sqlstate ? ` (${purge.sqlstate})` : ""}` : "Could not delete properties.");
      return;
    }
    toast.success("All properties removed from the database.");
    resetPurgeDialog();
    qc.invalidateQueries({ queryKey: ["properties"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["deals"] });
  };

  const handlePurgeLeads = async () => {
    if (!requireDeleteToken()) return;
    setPurgeBusy(true);
    const { data, error } = await supabase.rpc("admin_delete_all_leads", {});
    setPurgeBusy(false);
    if (error) {
      rpcToastError(error);
      return;
    }
    if (data && typeof data === "object" && "ok" in data && (data as { ok?: boolean }).ok === false) {
      toast.error("Database reported failure when deleting leads.");
      return;
    }
    toast.success("All leads and related pipeline rows removed.");
    resetPurgeDialog();
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["commissions"] });
    qc.invalidateQueries({ queryKey: ["email_threads"] });
  };

  const handlePurgePfAgents = async () => {
    if (!requireDeleteToken()) return;
    setPurgeBusy(true);
    const { data, error } = await supabase.rpc("admin_delete_pf_agent_profiles_only", {});
    setPurgeBusy(false);
    if (error) {
      rpcToastError(error);
      return;
    }
    if (data && typeof data === "object" && "ok" in data && (data as { ok?: boolean }).ok === false) {
      toast.error("Database reported failure when deleting PF agent profiles.");
      return;
    }
    toast.success("Property Finder agent profiles (no login) removed.");
    resetPurgeDialog();
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["profiles", "pf_only"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["properties"] });
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["commissions"] });
  };

  if (rolesLoading) {
    return (
      <PageShell title="Settings" subtitle="Loading…">
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (allowedTabs.length === 0) {
    return (
      <PageShell title="Settings" subtitle="Access">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to settings. Ask an administrator to assign a management role.</p>
      </PageShell>
    );
  }

  return (
    <PageShell title="Settings" subtitle={settingsSubtitle}>
      <Tabs value={activeTab} onValueChange={handleSettingsTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden flex-nowrap h-auto gap-1 no-scrollbar">
          {allowedTabs.includes("secrets") && (
            <TabsTrigger value="secrets" className="gap-1.5">
              <KeyRound className="h-3.5 w-3.5 shrink-0" /> Secrets
            </TabsTrigger>
          )}
          {allowedTabs.includes("branding") && <TabsTrigger value="branding">Branding</TabsTrigger>}
          {allowedTabs.includes("integrations") && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
          {allowedTabs.includes("notifications") && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
          {allowedTabs.includes("general") && <TabsTrigger value="general">General</TabsTrigger>}
          {allowedTabs.includes("data") && <TabsTrigger value="data">Data</TabsTrigger>}
          {allowedTabs.includes("lead-engine") && <TabsTrigger value="lead-engine">Sync Engine</TabsTrigger>}
          {allowedTabs.includes("audit-log") && <TabsTrigger value="audit-log">Audit Log</TabsTrigger>}
          {allowedTabs.includes("access-control") && <TabsTrigger value="access-control">Access Control</TabsTrigger>}
        </TabsList>

        <TabsContent value="secrets" className="mt-4">
          <IntegrationSecretsTab />
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
            <Card className="p-4 md:p-5 space-y-4 lg:col-span-2">
              <h3 className="font-heading text-sm md:text-base font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Organization & contact</h3>
              <p className="text-sm text-muted-foreground">Shown in the sidebar, login screen, and browser title. Stored in Supabase <code className="text-xs">branding_settings</code>.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>System name</Label>
                  <Input value={systemName} onChange={e => setSystemName(e.target.value)} className="mt-1" placeholder={DEFAULT_SYSTEM_NAME} />
                </div>
                <div>
                  <Label className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                  <Input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="mt-1" placeholder="+971 …" autoComplete="tel" />
                </div>
                <div>
                  <Label className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email</Label>
                  <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="mt-1" placeholder="hello@agency.com" autoComplete="email" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Website</Label>
                  <Input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className="mt-1" placeholder="https://…" />
                </div>
              </div>
            </Card>
            <Card className="p-4 md:p-5 space-y-4">
              <h3 className="font-heading text-sm md:text-base font-semibold flex items-center gap-2"><Palette className="h-4 w-4" /> Colors</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Primary Color</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-border shrink-0" />
                    <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label>Secondary Color</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-border shrink-0" />
                    <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label>Accent Color</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-border shrink-0" />
                    <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><Type className="h-4 w-4" /> Fonts (Google Fonts)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FontPicker id="font-heading" label="Heading / titles" value={fontHeading} onValueChange={setFontHeading} disabled={saving} />
                  <FontPicker id="font-body" label="Body text" value={fontBody} onValueChange={setFontBody} disabled={saving} />
                </div>
                <p className="text-xs text-muted-foreground">Search 400+ families. Fonts load from Google when you save or on refresh.</p>
              </div>
              <div>
                <Label className="flex items-center gap-2"><Image className="h-4 w-4" /> Logo</Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="sr-only"
                  aria-hidden
                  onChange={handleLogoFile}
                />
                <div className="mt-2 flex flex-col sm:flex-row gap-3 sm:items-center">
                  <button
                    type="button"
                    disabled={logoUploading || saving}
                    onClick={() => logoInputRef.current?.click()}
                    className="flex min-h-[88px] flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-3 text-center transition-colors hover:bg-muted/50 disabled:opacity-60"
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo preview" className="max-h-16 max-w-full object-contain" />
                    ) : (
                      <>
                        <Upload className="mb-1 h-5 w-5 text-muted-foreground" />
                        <p className="text-xs md:text-sm text-muted-foreground">PNG, JPG, WebP, GIF or SVG · max 2 MB</p>
                      </>
                    )}
                  </button>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button type="button" size="sm" variant="secondary" disabled={logoUploading || saving} onClick={() => logoInputRef.current?.click()}>
                      {logoUploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                      {logoUrl ? "Replace" : "Upload"}
                    </Button>
                    {logoUrl && (
                      <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => void handleRemoveLogo()}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" size="sm" onClick={handleSaveBranding} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save Theme
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetBranding}><RotateCcw className="mr-1 h-4 w-4" /> Reset</Button>
              </div>
            </Card>
            <Card className="p-4 md:p-5">
              <h3 className="font-heading text-sm md:text-base font-semibold flex items-center gap-2 mb-4"><Eye className="h-4 w-4" /> Live Preview</h3>
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="h-10 rounded-lg" style={{ backgroundColor: primaryColor }} />
                <div className="flex gap-2">
                  <div className="h-8 flex-1 rounded" style={{ backgroundColor: secondaryColor }} title="Secondary" />
                  <div className="h-8 flex-1 rounded" style={{ backgroundColor: accentColor }} title="Accent" />
                  <div className="h-8 flex-1 rounded bg-muted" />
                </div>
                <div className="space-y-2"><div className="h-3 w-3/4 rounded bg-muted" /><div className="h-3 w-1/2 rounded bg-muted" /></div>
                <div className="flex gap-2">
                  <Badge style={{ backgroundColor: primaryColor, color: "white" }}>Primary</Badge>
                  <Badge style={{ backgroundColor: accentColor, color: "white" }}>Accent</Badge>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-4">
          <Card className="p-4 md:p-5 space-y-3">
            <h3 className="font-heading text-sm md:text-base font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" /> Lead email communication via Resend
            </h3>
            <p className="text-sm text-muted-foreground">
              Deploy Edge Functions <code className="text-xs">email-send</code> and <code className="text-xs">email-webhook</code>. Store secrets in the <strong>Secrets</strong> tab:
              <code className="text-xs">resend_api_key</code>, <code className="text-xs">resend_from_domain</code>, <code className="text-xs">resend_reply_inbox</code>, and <code className="text-xs">resend_inbound_token</code>.
            </p>
            <p className="text-xs text-muted-foreground">
              Sender identity uses each salesperson address on your verified domain (for example <code className="text-[10px]">john@yourdomain.com</code>). If a salesperson uses a mailbox outside your verified domain, Resend will reject sending from that external address.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono break-all">
              Inbound Webhook URL: {import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-webhook?token=<resend_inbound_token>` : "(set VITE_SUPABASE_URL)"}
            </div>
          </Card>
          <Card className="p-4 md:p-5 space-y-3">
            <h3 className="font-heading text-sm md:text-base font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> WhatsApp Cloud API (single business number)
            </h3>
            <p className="text-sm text-muted-foreground">
              Deploy Edge Functions <code className="text-xs">whatsapp-webhook</code> and <code className="text-xs">whatsapp-send</code>. Store tokens in the <strong>Secrets</strong> tab (or Supabase project secrets). Same keys:{" "}
              <code className="text-xs">whatsapp_verify_token</code>, <code className="text-xs">whatsapp_access_token</code>,{" "}
              <code className="text-xs">whatsapp_phone_number_id</code>, <code className="text-xs">whatsapp_app_secret</code>.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono break-all">
              Callback URL: {import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook` : "(set VITE_SUPABASE_URL)"}
            </div>
            <p className="text-xs text-muted-foreground">
              In Meta Developer Console, subscribe your app to <code className="text-[10px]">messages</code> for the WhatsApp product. Inbound messages match leads by phone digits; outbound sends use the Graph API from the CRM.
            </p>
          </Card>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integration</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Last Sync</TableHead>
                  <TableHead className="hidden md:table-cell">Leads</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map(source => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell className="capitalize">{source.platform.replace(/_/g, " ")}</TableCell>
                    <TableCell className="capitalize">{source.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {source.last_sync ? formatDistanceToNow(new Date(source.last_sync), { addSuffix: true }) : "Never"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{source.leads_ingested ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={source.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {source.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {sources.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No integrations configured. Add sources in Sync Engine.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="p-4 md:p-5 space-y-3 max-w-xl">
            <h3 className="font-heading text-sm md:text-base font-semibold">Notification Preferences</h3>
            {[
              { key: "new_lead", name: "New Lead Alert", desc: "New lead ingested" },
              { key: "missed_followup", name: "Missed Follow-up", desc: "SLA breached" },
              { key: "status_changes", name: "Status Changes", desc: "Lead/deal status changes" },
              { key: "commission_updates", name: "Commission Updates", desc: "Approval & payment alerts" },
              { key: "system_alerts", name: "System Alerts", desc: "Integration errors" },
              { key: "sound_enabled", name: "Sound Alerts", desc: "Play a short sound on new notification" },
              { key: "popup_enabled", name: "Popup Dialog", desc: "Show modal popup for new notifications" },
            ].map(notif => (
              <div key={notif.key} className="flex items-center justify-between rounded-lg border border-border p-3 gap-3">
                <div className="min-w-0"><p className="text-sm font-medium">{notif.name}</p><p className="text-xs text-muted-foreground">{notif.desc}</p></div>
                <Switch checked={notifPrefs[notif.key]} onCheckedChange={v => setNotifPrefs(p => ({ ...p, [notif.key]: v }))} />
              </div>
            ))}
            <Button size="sm" onClick={handleSaveNotifications}>Save Preferences</Button>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <Card className="p-4 md:p-5 space-y-4 max-w-xl">
            <h3 className="font-heading text-sm md:text-base font-semibold">Regional defaults</h3>
            <p className="text-sm text-muted-foreground">
              Workspace display name, logo, colors, and contact info live under the <span className="font-medium text-foreground">Branding</span> tab. Here you only set the default <strong>currency</strong> and <strong>timezone</strong> stored in Supabase for use across the app.
            </p>
            <div>
              <Label>Default currency</Label>
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aed">AED — UAE Dirham (د.إ)</SelectItem>
                  <SelectItem value="usd">USD — US Dollar ($)</SelectItem>
                  <SelectItem value="eur">EUR — Euro (€)</SelectItem>
                  <SelectItem value="gbp">GBP — British Pound (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={defaultTimezone} onValueChange={setDefaultTimezone}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Dubai">Asia/Dubai (GMT+4)</SelectItem>
                  <SelectItem value="Asia/Riyadh">Asia/Riyadh (GMT+3)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="America/New_York">America/New_York (Eastern)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => void handleSaveGeneral()} disabled={savingGeneral}>
              {savingGeneral ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save regional defaults
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <Card className="p-4 md:p-5 max-w-xl space-y-4 border-destructive/30">
            <h3 className="font-heading text-sm md:text-base font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Database purge (Supabase)
            </h3>
            <p className="text-sm text-muted-foreground">
              These actions run only against your Supabase project. They cannot be undone. Type <span className="font-mono font-semibold">DELETE</span> in the confirmation field on each dialog.
            </p>
            <div className="space-y-2">
              <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => { setPurgeConfirm(""); setPurgePropertiesOpen(true); }}>
                Delete all properties
              </Button>
              <p className="text-xs text-muted-foreground">Removes every row in <code className="text-xs">properties</code> (junction rows cascade).</p>
            </div>
            <div className="space-y-2">
              <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => { setPurgeConfirm(""); setPurgeLeadsOpen(true); }}>
                Delete all leads
              </Button>
              <p className="text-xs text-muted-foreground">Removes leads, deals, commissions, email threads/messages, and lead activities.</p>
            </div>
            <div className="space-y-2">
              <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => { setPurgeConfirm(""); setPurgePfAgentsOpen(true); }}>
                Delete PF-synced agents only
              </Button>
              <p className="text-xs text-muted-foreground">
              Removes profiles where <code className="text-xs">pf_agent_id</code> is set and there is no auth login (<code className="text-xs">user_id</code> is null). Logged-in CRM users are kept.
              </p>
            </div>
          </Card>

          <AlertDialog open={purgePropertiesOpen} onOpenChange={(open) => { if (!open) { setPurgePropertiesOpen(false); setPurgeConfirm(""); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all properties?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all property records from Supabase.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label>Type DELETE to confirm</Label>
                <Input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={purgeBusy}>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={purgeBusy}
                  onClick={() => void handlePurgeProperties()}
                >
                  {purgeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete all properties"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={purgeLeadsOpen} onOpenChange={(open) => { if (!open) { setPurgeLeadsOpen(false); setPurgeConfirm(""); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all leads?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes leads and dependent CRM rows (deals, commissions, emails, activities) in the database.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label>Type DELETE to confirm</Label>
                <Input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={purgeBusy}>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={purgeBusy}
                  onClick={() => void handlePurgeLeads()}
                >
                  {purgeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete all leads"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={purgePfAgentsOpen} onOpenChange={(open) => { if (!open) { setPurgePfAgentsOpen(false); setPurgeConfirm(""); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Property Finder agent profiles?</AlertDialogTitle>
                <AlertDialogDescription>
                  Only rows synced from Property Finder without a login account are removed. Users linked to Supabase Auth are not deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label>Type DELETE to confirm</Label>
                <Input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={purgeBusy}>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={purgeBusy}
                  onClick={() => void handlePurgePfAgents()}
                >
                  {purgeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete PF agents"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="lead-engine" className="mt-4">
          <LeadEnginePage embedded />
        </TabsContent>
        <TabsContent value="audit-log" className="mt-4">
          <AuditLogPage embedded />
        </TabsContent>
        <TabsContent value="access-control" className="mt-4">
          <RBACPage embedded />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
