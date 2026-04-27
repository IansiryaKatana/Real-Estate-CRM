import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, RefreshCw, AlertTriangle, CheckCircle, Settings, ArrowRight, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useIngestionSources, useAssignmentRules, useLeads, useProfiles, useProperties, getLeadAgentDisplayName, buildPfAgentFullNameMap, buildProfileIdToFullNameMap, sourceLabels, type LeadSourceType } from "@/hooks/useSupabaseData";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export type LeadEnginePageProps = { embedded?: boolean };

export default function LeadEnginePage({ embedded = false }: LeadEnginePageProps) {
  const AUTO_SYNC_INTERVAL_MINUTES = 1;
  const { user } = useAuth();
  const { data: sources = [] } = useIngestionSources();
  const { data: rules = [] } = useAssignmentRules();
  const { data: leads = [] } = useLeads();
  const { data: properties = [] } = useProperties();
  const { data: profiles = [] } = useProfiles();
  const pfAgentNames = useMemo(() => buildPfAgentFullNameMap(profiles.filter((p) => p.pf_agent_id)), [profiles]);
  const profileIdToName = useMemo(() => buildProfileIdToFullNameMap(profiles), [profiles]);
  const qc = useQueryClient();
  const recentLeads = leads.slice(0, 10);
  const pfSource = sources.find((s) => s.platform === "property_finder");
  const pfNextAutoSync = useMemo(() => {
    if (!pfSource?.last_sync) return null;
    const last = new Date(pfSource.last_sync);
    const next = new Date(last.getTime() + AUTO_SYNC_INTERVAL_MINUTES * 60 * 1000);
    return Number.isNaN(next.getTime()) ? null : next;
  }, [pfSource?.last_sync, AUTO_SYNC_INTERVAL_MINUTES]);
  const nowMs = Date.now();
  const msToNextSync = pfNextAutoSync ? pfNextAutoSync.getTime() - nowMs : null;
  const pfNextAutoSyncLabel =
    pfNextAutoSync == null
      ? "After first successful sync"
      : msToNextSync != null && msToNextSync > 0
        ? formatDistanceToNow(pfNextAutoSync, { addSuffix: true })
        : "Due now (next cron run)";
  const pfSyncedPropertiesCount = useMemo(
    () => properties.filter((p) => typeof p.pf_id === "string" && p.pf_id.trim().length > 0).length,
    [properties],
  );

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", match_field: "source", match_value: "", assign_to_agent_id: "", priority: "0" });
  const [sourceForm, setSourceForm] = useState({ name: "", platform: "bayut", type: "api" });
  const [engineSettings, setEngineSettings] = useState({ autoAssign: true, dupDetect: true, slaHours: "24", strategy: "property_agent" });
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: savedEngineSettings, isSuccess: settingsQueryDone } = useQuery({
    queryKey: ["lead_engine_settings_audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("details")
        .eq("entity", "lead_engine_settings")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.details || typeof data.details !== "string") return null;
      try {
        return JSON.parse(data.details) as Record<string, unknown>;
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    if (!settingsQueryDone || settingsHydrated) return;
    if (savedEngineSettings && typeof savedEngineSettings === "object") {
      setEngineSettings((s) => ({
        autoAssign: typeof savedEngineSettings.autoAssign === "boolean" ? savedEngineSettings.autoAssign : s.autoAssign,
        dupDetect: typeof savedEngineSettings.dupDetect === "boolean" ? savedEngineSettings.dupDetect : s.dupDetect,
        slaHours: savedEngineSettings.slaHours != null ? String(savedEngineSettings.slaHours) : s.slaHours,
        strategy: typeof savedEngineSettings.strategy === "string" ? savedEngineSettings.strategy : s.strategy,
      }));
    }
    setSettingsHydrated(true);
  }, [settingsQueryDone, savedEngineSettings, settingsHydrated]);

  const handleToggleSource = async (id: string, current: boolean) => {
    const { error } = await supabase.from("ingestion_sources").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(current ? "Source disabled" : "Source enabled");
    qc.invalidateQueries({ queryKey: ["ingestion_sources"] });
  };

  const handleSync = async (id: string) => {
    const source = sources.find(s => s.id === id);
    const isPF = source?.platform === "property_finder";

    if (isPF) {
      setSyncingId(id);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error("Sign in required", { description: "Log in, then run Property Finder sync again." });
          setSyncingId(null);
          return;
        }
        const { data: refresh } = await supabase.auth.refreshSession();
        const token = refresh.session?.access_token ?? session.access_token;

        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
        const { data, error } = await supabase.functions.invoke("sync-property-finder", {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(anonKey ? { apikey: anonKey } : {}),
          },
        });
        if (error) throw error;
        const r = data?.results as { properties?: number; agents?: number; leads?: number; errors?: string[] } | undefined;
        const diag = data?.diagnostics as {
          fetched_listings?: number;
          fetched_leads?: number;
          wrote_properties?: number;
          error_preview?: string[];
          error_count?: number;
        } | undefined;

        const props = r?.properties ?? 0;
        const ag = r?.agents ?? 0;
        const ld = r?.leads ?? 0;
        const errs = r?.errors ?? [];
        const fetchedL = diag?.fetched_listings ?? 0;

        if (errs.length > 0) {
          toast.error(`PF sync: ${props} properties, ${ag} agents, ${ld} leads — ${errs.length} error(s)`, {
            description: errs.slice(0, 5).join(" · ") + (errs.length > 5 ? ` (+${errs.length - 5} more)` : ""),
          });
        } else if (props === 0 && ag === 0 && ld === 0 && fetchedL === 0) {
          toast.message("Property Finder returned no listings", {
            description:
              "Atlas returned 0 listings. Check Edge secrets PF_CLIENT_ID / PF_CLIENT_SECRET, API scopes (e.g. listings:read), and that your PF account has listings.",
          });
        } else if (props === 0 && fetchedL > 0) {
          toast.warning(`PF returned ${fetchedL} listings but 0 were saved`, {
            description:
              (diag?.error_preview?.length ? diag.error_preview.join(" · ") : "Open Supabase → Edge Functions → sync-property-finder → Logs for upsert errors."),
          });
        } else {
          toast.success(`PF Sync complete: ${props} properties, ${ag} agents, ${ld} leads`);
        }
        qc.invalidateQueries({ queryKey: ["ingestion_sources"] });
        qc.invalidateQueries({ queryKey: ["properties"] });
        qc.invalidateQueries({ queryKey: ["profiles"] });
        qc.invalidateQueries({ queryKey: ["leads"] });
        qc.invalidateQueries({ queryKey: ["profile_workload_stats"] });
      } catch (e: any) {
        const status = e?.context?.status ?? e?.status;
        const msg = e?.message ?? String(e);
        if (status === 401 || /401|JWT|Invalid.*token/i.test(msg)) {
          toast.error("Session not accepted (401)", {
            description: "Sign out, sign in again, then sync. After switching Supabase projects, old browser sessions must be cleared.",
          });
        } else {
          toast.error(`PF Sync failed: ${msg}`);
        }
      } finally {
        setSyncingId(null);
      }
      return;
    }

    // Only Property Finder has a deployed ingestion function; other sources record sync time only
    setSyncingId(id);
    const { error } = await supabase.from("ingestion_sources").update({
      last_sync: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Sync recorded", {
        description: "No leads were imported. Only Property Finder runs a live API sync in this app; add an edge function or webhook to ingest from other platforms.",
      });
      qc.invalidateQueries({ queryKey: ["ingestion_sources"] });
    }
    setSyncingId(null);
  };

  const handleAddSource = async () => {
    const { error } = await supabase.from("ingestion_sources").insert({
      name: sourceForm.name, platform: sourceForm.platform, type: sourceForm.type,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Source added");
    qc.invalidateQueries({ queryKey: ["ingestion_sources"] });
    setShowAddSource(false);
    setSourceForm({ name: "", platform: "bayut", type: "api" });
  };

  const handleToggleRule = async (id: string, current: boolean) => {
    const { error } = await supabase.from("assignment_rules").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(current ? "Rule disabled" : "Rule enabled");
    qc.invalidateQueries({ queryKey: ["assignment_rules"] });
  };

  const handleAddRule = async () => {
    const { error } = await supabase.from("assignment_rules").insert({
      name: ruleForm.name, match_field: ruleForm.match_field, match_value: ruleForm.match_value,
      assign_to_agent_id: ruleForm.assign_to_agent_id || null,
      priority: Number(ruleForm.priority) || 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Rule created");
    qc.invalidateQueries({ queryKey: ["assignment_rules"] });
    setShowAddRule(false);
    setRuleForm({ name: "", match_field: "source", match_value: "", assign_to_agent_id: "", priority: "0" });
  };

  const handleDeleteRule = async (id: string) => {
    const { error } = await supabase.from("assignment_rules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rule deleted");
    qc.invalidateQueries({ queryKey: ["assignment_rules"] });
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase.from("audit_log").insert({
      action: "update",
      entity: "lead_engine_settings",
      user_name: user?.email ?? "System",
      details: JSON.stringify(engineSettings),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Engine settings saved");
      qc.invalidateQueries({ queryKey: ["lead_engine_settings_audit"] });
    }
    setSavingSettings(false);
  };

  const salesAgents = profiles.filter((p) => p.pf_agent_id && p.department === "Sales" && (p.is_active ?? true));

  const addSourceButton = (
    <Button size="sm" onClick={() => setShowAddSource(true)}>
      <Plus className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Add Source</span>
    </Button>
  );

  const main = (
    <>
      <Tabs defaultValue="sources">
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden flex-nowrap h-auto gap-1 no-scrollbar">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="matching">Rules</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4 space-y-3">
          <Card className="p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <Badge variant="outline" className="capitalize">
                PF auto-sync
              </Badge>
              <span className="text-muted-foreground">
                Every {AUTO_SYNC_INTERVAL_MINUTES} minute{AUTO_SYNC_INTERVAL_MINUTES === 1 ? "" : "s"}
              </span>
              <span className="text-muted-foreground">-</span>
              <span className="font-medium">
                Next run: {pfNextAutoSyncLabel}
              </span>
              {pfSource && !(pfSource.is_active ?? false) ? (
                <Badge variant="secondary">Source inactive</Badge>
              ) : null}
            </div>
          </Card>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Last Sync</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Sync Date</TableHead>
                  <TableHead className="hidden md:table-cell">Properties</TableHead>
                  <TableHead className="hidden md:table-cell">Leads</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell className="capitalize">{source.platform.replace(/_/g, " ")}</TableCell>
                    <TableCell className="capitalize">{source.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {source.last_sync ? formatDistanceToNow(new Date(source.last_sync), { addSuffix: true }) : "Never synced"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {source.last_sync ? format(new Date(source.last_sync), "MMM d, yyyy h:mm a") : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {source.platform === "property_finder" ? pfSyncedPropertiesCount : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{source.leads_ingested ?? 0}</TableCell>
                    <TableCell>
                      <Switch checked={source.is_active ?? false} onCheckedChange={() => handleToggleSource(source.id, source.is_active ?? false)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled={syncingId === source.id || !source.is_active} onClick={() => handleSync(source.id)}>
                        {syncingId === source.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                        {syncingId === source.id ? "Syncing..." : "Sync"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {sources.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No sources configured. Add a source to start ingesting leads.</p>
                      <Button className="mt-3" size="sm" onClick={() => setShowAddSource(true)}><Plus className="mr-1 h-4 w-4" /> Add Source</Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="matching" className="mt-4">
          <Card className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-sm md:text-base font-semibold">Assignment Rules</h3>
              <Button size="sm" onClick={() => setShowAddRule(true)}><Zap className="mr-1 h-4 w-4" /> Add Rule</Button>
            </div>
            <div className="space-y-2">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border p-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-heading text-xs font-bold text-accent-foreground shrink-0">{rule.priority}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{rule.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {rule.match_field} = "{rule.match_value}"
                        {(rule as any).profiles?.full_name && ` → ${(rule as any).profiles.full_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={rule.is_active ?? false} onCheckedChange={() => handleToggleRule(rule.id, rule.is_active ?? false)} />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteRule(rule.id)}>×</Button>
                  </div>
                </div>
              ))}
              {rules.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No assignment rules configured</p>}
            </div>
            <div className="mt-4 rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lead Flow</p>
              <div className="flex items-center gap-1.5 flex-wrap text-xs md:text-sm">
                <Badge variant="outline">Portal Lead</Badge><ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="bg-accent text-accent-foreground">Match</Badge><ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="bg-primary/10 text-primary">Agent</Badge><ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="bg-success/10 text-success">Assign</Badge>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="p-4 md:p-5">
            <h3 className="mb-3 font-heading text-sm md:text-base font-semibold">Recent Ingestions</h3>
            <div className="space-y-2">
              {recentLeads.map((lead) => {
                const agent = getLeadAgentDisplayName(lead as Record<string, unknown>, pfAgentNames, profileIdToName);
                const src = sourceLabels[lead.source as LeadSourceType] ?? lead.source;
                const agentSuffix = agent !== "Unassigned" ? ` → ${agent}` : "";
                return (
                  <div key={lead.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 md:p-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2 w-2 rounded-full bg-success shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {src}
                          {agentSuffix}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{lead.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                );
              })}
              {recentLeads.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No leads ingested yet</p>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="p-4 md:p-5 space-y-4 max-w-xl">
            <h3 className="font-heading text-sm md:text-base font-semibold">Engine Settings</h3>
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-medium">Auto-Assignment</p><p className="text-xs text-muted-foreground">Automatically assign matched leads</p></div>
              <Switch checked={engineSettings.autoAssign} onCheckedChange={v => setEngineSettings(s => ({ ...s, autoAssign: v }))} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-medium">Duplicate Detection</p><p className="text-xs text-muted-foreground">Check for duplicates across sources</p></div>
              <Switch checked={engineSettings.dupDetect} onCheckedChange={v => setEngineSettings(s => ({ ...s, dupDetect: v }))} />
            </div>
            <div><Label>SLA Response Time (hours)</Label><Input type="number" value={engineSettings.slaHours} onChange={e => setEngineSettings(s => ({ ...s, slaHours: e.target.value }))} className="mt-1 w-32" /></div>
            <div>
              <Label>Default Strategy</Label>
              <Select value={engineSettings.strategy} onValueChange={v => setEngineSettings(s => ({ ...s, strategy: v }))}>
                <SelectTrigger className="mt-1 w-full md:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="property_agent">Property Agent</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="least_active">Least Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save Settings
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Source Dialog */}
      <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Ingestion Source</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Source Name</Label><Input placeholder="e.g. Bayut API Feed" value={sourceForm.name} onChange={e => setSourceForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>Platform</Label>
              <Select value={sourceForm.platform} onValueChange={v => setSourceForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bayut">Bayut</SelectItem>
                  <SelectItem value="property_finder">Property Finder</SelectItem>
                  <SelectItem value="dubizzle">Dubizzle</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={sourceForm.type} onValueChange={v => setSourceForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="email_parser">Email Parser</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="scraper">Scraper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAddSource} disabled={!sourceForm.name}>Add Source</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Rule Dialog */}
      <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Assignment Rule</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Rule Name</Label><Input placeholder="e.g. Bayut leads to Ahmed" value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>Match Field</Label>
              <Select value={ruleForm.match_field} onValueChange={v => setRuleForm(f => ({ ...f, match_field: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="source">Source</SelectItem>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="property_type">Property Type</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Match Value</Label><Input placeholder="e.g. bayut" value={ruleForm.match_value} onChange={e => setRuleForm(f => ({ ...f, match_value: e.target.value }))} /></div>
            <div>
              <Label>Assign to Agent</Label>
              <Select value={ruleForm.assign_to_agent_id} onValueChange={v => setRuleForm(f => ({ ...f, assign_to_agent_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>{salesAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Priority</Label><Input type="number" value={ruleForm.priority} onChange={e => setRuleForm(f => ({ ...f, priority: e.target.value }))} className="w-24" /></div>
            <Button className="w-full" onClick={handleAddRule} disabled={!ruleForm.name || !ruleForm.match_value}>Create Rule</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">{addSourceButton}</div>
        {main}
      </div>
    );
  }

  return (
    <PageShell title="Sync Engine" subtitle="Ingestion, syncing, rules, and assignment" actions={addSourceButton}>
      {main}
    </PageShell>
  );
}
