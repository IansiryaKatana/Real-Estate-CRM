import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { useLeads, useLeadActivities, useProfiles, useProperties, useCurrentProfile, useUserRoles, getLeadAgentDisplayName, getLeadReceivedAtIso, buildPfAgentFullNameMap, buildProfileIdToFullNameMap, leadStatusColors, leadStatusLabels, sourceLabels, formatDate, formatDateTime, type LeadStatus, type LeadSourceType } from "@/hooks/useSupabaseData";
import { isManagement } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";
import { Plus, Search, Phone, Mail, MessageSquare, Star, Trash2, CheckSquare } from "lucide-react";
import { ListSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { emptyLeadForm, type LeadFormState } from "@/lib/leadForm";
import { FormStepProgress } from "@/components/form/FormStepProgress";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";
import type { Profile, Property } from "@/hooks/useSupabaseData";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const PAGE_SIZE = 25;

const LEAD_FORM_STEPS = [
  { title: "Contact", desc: "Name and how to reach the lead" },
  { title: "Pipeline", desc: "Property, agent, budget, source, status" },
  { title: "Notes & portals", desc: "Notes and Property Finder references" },
] as const;

const CLIENT_TYPE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  active_lead: "Active lead",
  previous_buyer: "Previous buyer",
  investor: "Investor",
  lost_lead: "Lost lead",
};

function LeadCreateWizard({
  form,
  setForm,
  step,
  setStep,
  propertiesList,
  profiles,
  onSubmit,
  onCancel,
  isMobile,
}: {
  form: LeadFormState;
  setForm: Dispatch<SetStateAction<LeadFormState>>;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  propertiesList: Property[];
  profiles: Profile[];
  onSubmit: () => void;
  onCancel: () => void;
  isMobile: boolean;
}) {
  const setF = (patch: Partial<LeadFormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const last = LEAD_FORM_STEPS.length - 1;

  const goNext = () => {
    if (step === 0) {
      if (!form.name.trim()) {
        toast.error("Name is required");
        return;
      }
      if (form.email.trim()) {
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
        if (!ok) {
          toast.error("Enter a valid email or leave it empty");
          return;
        }
      }
    }
    setStep((s) => Math.min(last, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden pt-0.5">
      <FormStepProgress step={step} steps={LEAD_FORM_STEPS} className="px-0 pb-3" />

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 sm:px-3">
      {step === 0 && (
        <div className="space-y-3">
          <div>
            <Label>Full name</Label>
            <Input className="mt-1" placeholder="Client name" value={form.name} onChange={(e) => setF({ name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input className="mt-1" type="email" placeholder="email@example.com" value={form.email} onChange={(e) => setF({ email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="mt-1" placeholder="+971…" value={form.phone} onChange={(e) => setF({ phone: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Linked property</Label>
            <Select value={form.property_id || "__none__"} onValueChange={(v) => setF({ property_id: v === "__none__" ? "" : v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {propertiesList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Assigned agent</Label>
            <Select value={form.assigned_agent_id || "__none__"} onValueChange={(v) => setF({ assigned_agent_id: v === "__none__" ? "" : v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {profiles.map((pr) => (
                  <SelectItem key={pr.id} value={pr.id}>{pr.full_name ?? pr.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Budget</Label>
            <Input className="mt-1" placeholder="AED 2M – 3M" value={form.budget} onChange={(e) => setF({ budget: e.target.value })} />
          </div>
          <div>
            <Label>Lead score</Label>
            <Input className="mt-1" type="number" placeholder="Optional (0–100)" value={form.score} onChange={(e) => setF({ score: e.target.value })} />
          </div>
          <div>
            <Label>Source</Label>
            <Select value={form.source} onValueChange={(v) => setF({ source: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.entries(sourceLabels) as [LeadSourceType, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setF({ status: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.entries(leadStatusLabels) as [LeadStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Client type</Label>
            <Select value={form.client_type} onValueChange={(v) => setF({ client_type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CLIENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <Label>Notes</Label>
            <Textarea className="mt-1 min-h-[88px]" placeholder="Additional information…" value={form.notes} onChange={(e) => setF({ notes: e.target.value })} />
          </div>
          <div>
            <Label>Channel</Label>
            <Input className="mt-1" placeholder="e.g. WhatsApp, call" value={form.channel} onChange={(e) => setF({ channel: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>PF lead ID</Label>
              <Input className="mt-1" placeholder="Optional" value={form.pf_lead_id} onChange={(e) => setF({ pf_lead_id: e.target.value })} />
            </div>
            <div>
              <Label>PF listing ref</Label>
              <Input className="mt-1" placeholder="Optional" value={form.pf_listing_ref} onChange={(e) => setF({ pf_listing_ref: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>PF response link</Label>
              <Input className="mt-1" placeholder="https://…" value={form.pf_response_link} onChange={(e) => setF({ pf_response_link: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>PF status</Label>
              <Input className="mt-1" placeholder="As on portal" value={form.pf_status} onChange={(e) => setF({ pf_status: e.target.value })} />
            </div>
          </div>
        </div>
      )}
      </div>

      <SheetFooter className={cn("shrink-0 flex-col sm:flex-row gap-2 border-t border-border px-0 pb-0 pt-3 mt-2", isMobile && "bg-background pb-2")}>
        <div className="flex flex-wrap gap-2 w-full sm:ml-auto sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Close
          </Button>
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={goBack}>
              Back
            </Button>
          )}
          {step < last ? (
            <Button type="button" onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={onSubmit} disabled={!form.name.trim()}>
              Create lead
            </Button>
          )}
        </div>
      </SheetFooter>
    </div>
  );
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  /** `has_email` = email on file; `no_email` = phone / WhatsApp–style (no email stored). */
  const [contactFilter, setContactFilter] = useState<string>("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [leadFormStep, setLeadFormStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<LeadFormState>(() => emptyLeadForm());
  const [activityNote, setActivityNote] = useState("");
  const isMobile = useIsMobile();

  const { data: leads = [], isLoading } = useLeads();
  const { data: propertiesList = [] } = useProperties();
  const { data: profiles = [] } = useProfiles();
  const { data: me } = useCurrentProfile();
  const { data: roles = [] } = useUserRoles();
  const pfAgentNames = useMemo(() => buildPfAgentFullNameMap(profiles.filter((p) => p.pf_agent_id)), [profiles]);
  const profileIdToName = useMemo(() => buildProfileIdToFullNameMap(profiles), [profiles]);
  const { data: activities = [] } = useLeadActivities(selectedLeadId);
  const qc = useQueryClient();
  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (sourceFilter !== "all" ? 1 : 0) + (contactFilter !== "all" ? 1 : 0);

  const filtered = useMemo(() => leads.filter((l) => {
    const propTitle = (l as any).properties?.title ?? "";
    const agentLabel = getLeadAgentDisplayName(l as Record<string, unknown>, pfAgentNames, profileIdToName);
    const q = search.toLowerCase();
    const matchSearch =
      l.name.toLowerCase().includes(q) ||
      propTitle.toLowerCase().includes(q) ||
      (agentLabel !== "Unassigned" && agentLabel.toLowerCase().includes(q));
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchSource = sourceFilter === "all" || l.source === sourceFilter;
    const hasEmail = typeof l.email === "string" && l.email.trim().length > 0;
    const matchContact =
      contactFilter === "all" ||
      (contactFilter === "has_email" && hasEmail) ||
      (contactFilter === "no_email" && !hasEmail);
    return matchSearch && matchStatus && matchSource && matchContact;
  }), [leads, search, statusFilter, sourceFilter, contactFilter, pfAgentNames, profileIdToName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map(l => l.id)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} leads deleted`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  const handleBulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const { error } = await supabase.from("leads").update({ status: status as any }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} leads updated to ${status}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  const resetLeadForm = () => {
    const base = emptyLeadForm();
    const r = roles as AppRole[];
    if (me?.id && r.includes("salesperson") && !isManagement(r)) {
      base.assigned_agent_id = me.id;
    }
    setForm(base);
    setLeadFormStep(0);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const scoreRaw = form.score.trim();
    const scoreNum = scoreRaw === "" ? null : Number(scoreRaw);
    const { error } = await supabase.from("leads").insert({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      budget: form.budget.trim() || null,
      source: form.source as "bayut" | "property_finder" | "dubizzle" | "website" | "referral" | "walk_in",
      notes: form.notes.trim() || null,
      status: form.status as "new" | "contacted" | "qualified" | "viewing" | "negotiation" | "closed_won" | "closed_lost",
      client_type: form.client_type as "prospect" | "active_lead" | "previous_buyer" | "investor" | "lost_lead",
      property_id: form.property_id || null,
      assigned_agent_id: form.assigned_agent_id || null,
      score: scoreNum !== null && Number.isFinite(scoreNum) ? scoreNum : null,
      channel: form.channel.trim() || null,
      pf_lead_id: form.pf_lead_id.trim() || null,
      pf_listing_ref: form.pf_listing_ref.trim() || null,
      pf_response_link: form.pf_response_link.trim() || null,
      pf_status: form.pf_status.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lead created");
    qc.invalidateQueries({ queryKey: ["leads"] });
    setShowCreate(false);
    resetLeadForm();
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const { error } = await supabase.from("leads").update({ status: newStatus as any }).eq("id", leadId);
    if (error) { toast.error(error.message); return; }
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  const handleAddNote = async () => {
    if (!selectedLeadId || !activityNote.trim()) return;
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: selectedLeadId,
      type: "note" as const,
      description: activityNote,
      user_name: me?.full_name?.trim() || "User",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Note added");
    setActivityNote("");
    qc.invalidateQueries({ queryKey: ["lead_activities", selectedLeadId] });
  };

  const handleUpdateNotes = async (leadId: string, notes: string) => {
    const { error } = await supabase.from("leads").update({ notes }).eq("id", leadId);
    if (error) { toast.error(error.message); return; }
    toast.success("Notes saved");
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  const handleDeleteLead = async (leadId: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead deleted");
    setSelectedLeadId(null);
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  const Pagination = () => totalPages > 1 ? (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-muted-foreground">Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</Button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let p: number;
          if (totalPages <= 7) p = i + 1;
          else if (safePage <= 4) p = i + 1;
          else if (safePage >= totalPages - 3) p = totalPages - 6 + i;
          else p = safePage - 3 + i;
          return <Button key={p} variant={p === safePage ? "default" : "outline"} size="sm" className="w-8 h-8 p-0" onClick={() => setPage(p)}>{p}</Button>;
        })}
        <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next</Button>
      </div>
    </div>
  ) : null;

  return (
    <PageShell title="Leads & Clients" subtitle={`${filtered.length} leads`}
      actions={
        <>
          <Button
            size="sm"
            onClick={() => {
              resetLeadForm();
              setShowCreate(true);
            }}
            type="button"
          >
            <Plus className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Add Lead</span>
          </Button>
          <Sheet
            open={showCreate}
            onOpenChange={(open) => {
              setShowCreate(open);
              if (!open) resetLeadForm();
            }}
          >
            <SheetContent
              side={isMobile ? "bottom" : "right"}
              className={cn(
                "flex min-h-0 w-full flex-col gap-0 overflow-hidden p-4 pb-4 md:p-6",
                "sm:w-[560px] sm:max-w-[560px]",
                isMobile && "max-h-[92vh] rounded-t-2xl mb-0 max-sm:pb-4",
              )}
            >
              <SheetHeader className="shrink-0 text-left space-y-1 pr-8">
                <SheetTitle>Add lead</SheetTitle>
                <SheetDescription className="sr-only">Create a lead in steps</SheetDescription>
              </SheetHeader>
              <LeadCreateWizard
                form={form}
                setForm={setForm}
                step={leadFormStep}
                setStep={setLeadFormStep}
                propertiesList={propertiesList}
                profiles={profiles}
                onSubmit={handleCreate}
                onCancel={() => {
                  setShowCreate(false);
                  resetLeadForm();
                }}
                isMobile={isMobile}
              />
            </SheetContent>
          </Sheet>
        </>
      }
    >
      <div className="mb-4 md:mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
        </div>
        {isMobile ? (
          <MobileFilterSheet activeCount={activeFilterCount}>
            <><div><Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label><Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{(Object.entries(leadStatusLabels) as [LeadStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Source</Label><Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Sources</SelectItem>{(Object.entries(sourceLabels) as [LeadSourceType, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Contact</Label><Select value={contactFilter} onValueChange={v => { setContactFilter(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All contacts</SelectItem><SelectItem value="has_email">Email leads</SelectItem><SelectItem value="no_email">WhatsApp leads</SelectItem></SelectContent></Select></div></>
          </MobileFilterSheet>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{(Object.entries(leadStatusLabels) as [LeadStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
            <Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setPage(1); }}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Sources</SelectItem>{(Object.entries(sourceLabels) as [LeadSourceType, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
            <Select value={contactFilter} onValueChange={v => { setContactFilter(v); setPage(1); }}><SelectTrigger className="w-[168px]"><SelectValue placeholder="Contact" /></SelectTrigger><SelectContent><SelectItem value="all">All contacts</SelectItem><SelectItem value="has_email">Email leads</SelectItem><SelectItem value="no_email">WhatsApp leads</SelectItem></SelectContent></Select>
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 p-2 rounded-lg bg-accent border border-border">
          <CheckSquare className="h-4 w-4 text-accent-foreground" />
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex gap-1 ml-auto">
            <Select onValueChange={handleBulkStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Set status" /></SelectTrigger>
              <SelectContent>{(Object.entries(leadStatusLabels) as [LeadStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Cancel</Button>
          </div>
        </div>
      )}


      {isLoading ? <ListSkeleton count={6} /> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={paged.length > 0 && selected.size === paged.length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="hidden lg:table-cell">Property</TableHead>
                <TableHead className="hidden sm:table-cell">Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Agent</TableHead>
                <TableHead className="hidden md:table-cell whitespace-nowrap">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((lead) => {
                const agentName = getLeadAgentDisplayName(lead as Record<string, unknown>, pfAgentNames, profileIdToName);
                const propTitle = (lead as any).properties?.title ?? "Not provided";
                const receivedIso = getLeadReceivedAtIso(lead as Record<string, unknown>);
                return (
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelectedLeadId(lead.id)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="bg-accent text-accent-foreground text-[10px] font-semibold">{lead.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground truncate md:hidden">{lead.email ?? "Not provided"}</p>
                          <p className="text-[11px] text-muted-foreground md:hidden">
                            Received {receivedIso ? formatDate(receivedIso) : "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm truncate max-w-[200px]">{lead.email ?? "Not provided"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{lead.phone ?? "Not provided"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="secondary" className="text-[10px]">{sourceLabels[lead.source as LeadSourceType] ?? lead.source}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm truncate max-w-[180px]">{propTitle}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <Star className={cn("h-3 w-3", (lead.score ?? 0) >= 80 ? "fill-warning text-warning" : "text-muted-foreground")} />
                        <span className="text-xs">{lead.score ?? "Not provided"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", leadStatusColors[lead.status as LeadStatus] ?? "")}>{leadStatusLabels[lead.status as LeadStatus] ?? lead.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm truncate max-w-[140px]">{agentName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm whitespace-nowrap text-muted-foreground">
                      {receivedIso ? formatDate(receivedIso) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">No leads found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination />

      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLeadId(null)}>
        <SheetContent className="flex min-h-0 w-full flex-col overflow-y-auto p-4 md:p-6 sm:w-[560px] sm:max-w-[560px]">
          {selectedLead && (
            <>
              <SheetHeader><SheetTitle>{selectedLead.name}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="truncate">{selectedLead.email ?? "Not provided"}</span></div>
                  <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /> {selectedLead.phone ?? "Not provided"}</div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Received{" "}
                    {(() => {
                      const iso = getLeadReceivedAtIso(selectedLead as Record<string, unknown>);
                      return iso ? formatDateTime(iso) : "—";
                    })()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={leadStatusColors[selectedLead.status as LeadStatus] ?? ""}>{leadStatusLabels[selectedLead.status as LeadStatus] ?? selectedLead.status}</Badge>
                  <Badge variant="secondary">{sourceLabels[selectedLead.source as LeadSourceType] ?? selectedLead.source}</Badge>
                  <Badge variant="secondary">{selectedLead.client_type.replace("_", " ")}</Badge>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Score: {selectedLead.score}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Change Status</Label>
                  <Select value={selectedLead.status} onValueChange={(v) => handleStatusChange(selectedLead.id, v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.entries(leadStatusLabels) as [LeadStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="text-sm font-semibold">{(selectedLead as any).properties?.title ?? "Not provided"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Assigned to</p>
                  <p className="text-sm font-medium">{getLeadAgentDisplayName(selectedLead as Record<string, unknown>, pfAgentNames, profileIdToName)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Budget</p>
                  <p className="text-sm font-medium">{selectedLead.budget ?? "Not provided"}</p>
                </Card>
                <Tabs defaultValue="activity">
                  <TabsList className="w-full"><TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger><TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger></TabsList>
                  <TabsContent value="activity" className="mt-3 space-y-3">
                    <div className="flex gap-2">
                      <Input placeholder="Add a note..." value={activityNote} onChange={e => setActivityNote(e.target.value)} className="flex-1" />
                      <Button size="sm" onClick={handleAddNote} disabled={!activityNote.trim()}>Add</Button>
                    </div>
                    {activities.length > 0 ? activities.map(a => (
                      <div key={a.id} className="flex gap-3 border-l-2 border-primary/30 pl-3">
                        <div><p className="text-sm">{a.description}</p><p className="text-xs text-muted-foreground">{a.user_name} · {formatDateTime(a.created_at)}</p></div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No activity recorded yet</p>}
                  </TabsContent>
                  <TabsContent value="notes" className="mt-3 space-y-3">
                    <Textarea onBlur={(e) => handleUpdateNotes(selectedLead.id, e.target.value)} placeholder="Add notes about this lead..." className="min-h-[100px]" defaultValue={selectedLead.notes ?? ""} />
                  </TabsContent>
                </Tabs>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { if (selectedLead.phone) window.open(`tel:${selectedLead.phone}`); else toast.error("No phone number"); }}><Phone className="mr-1 h-4 w-4" /> Call</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { if (selectedLead.email) window.open(`mailto:${selectedLead.email}`); else toast.error("No email"); }}><Mail className="mr-1 h-4 w-4" /> Email</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { if (selectedLead.phone) window.open(`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, "")}`); else toast.error("No phone number"); }}><MessageSquare className="mr-1 h-4 w-4" /> WA</Button>
                </div>
                <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDeleteLead(selectedLead.id)}>Delete Lead</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
