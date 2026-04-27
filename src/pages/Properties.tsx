import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { useProperties, usePortfolios, useProfiles, formatCurrency, formatDate, buildPfAgentFullNameMap, buildProfileIdToFullNameMap, resolvePropertyAssignedAgentName, type Portfolio, type Profile } from "@/hooks/useSupabaseData";
import { Plus, Search, Home, MapPin, Bed, Bath, Maximize, Edit, Trash2, ExternalLink, LayoutGrid, List, CheckSquare, FolderOpen, FolderX } from "lucide-react";
import { CardGridSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { emptyPropertyForm, propertyRowFromForm, type PropertyFormState } from "@/lib/propertyForm";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { FormStepProgress } from "@/components/form/FormStepProgress";

const statusStyles: Record<string, string> = {
  available: "bg-success/10 text-success border-success/20",
  reserved: "bg-warning/10 text-warning border-warning/20",
  sold: "bg-primary/10 text-accent-foreground border-primary/20",
  off_market: "bg-muted text-muted-foreground border-border",
};

const PAGE_SIZE = 25;

const PROPERTY_FORM_STEPS = [
  { title: "Core listing", desc: "Title, location, type, status, portfolio" },
  { title: "Price & size", desc: "Pricing, layout, commission, listing ref" },
  { title: "PF-style details", desc: "Emirate, category, furnishing, availability" },
  { title: "Compliance & media", desc: "RERA, verification, description, photos & portals" },
] as const;

type PropertyFormWizardProps = {
  form: PropertyFormState;
  setForm: Dispatch<SetStateAction<PropertyFormState>>;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  portfolios: Portfolio[];
  profiles: Profile[];
  isMobile: boolean;
  onSubmit: () => void;
  submitLabel: string;
  onCancel: () => void;
};

function PropertyFormWizard({
  form,
  setForm,
  step,
  setStep,
  portfolios,
  profiles,
  isMobile,
  onSubmit,
  submitLabel,
  onCancel,
}: PropertyFormWizardProps) {
  const setF = (patch: Partial<PropertyFormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const last = PROPERTY_FORM_STEPS.length - 1;

  const goNext = () => {
    if (step === 0 && (!form.title.trim() || !form.location.trim())) {
      toast.error("Add a title and location to continue");
      return;
    }
    setStep((s) => Math.min(last, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden pt-0.5">
      <FormStepProgress step={step} steps={PROPERTY_FORM_STEPS} className="px-0 pb-3" />

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 sm:px-3">
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Title</Label>
              <Input className="mt-1" placeholder="Property title" value={form.title} onChange={(e) => setF({ title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Location</Label>
              <Input className="mt-1" placeholder="Dubai Marina" value={form.location} onChange={(e) => setF({ location: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setF({ type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["apartment", "villa", "office", "penthouse", "townhouse"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setF({ status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="off_market">Off market</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Portfolio</Label>
              <Select value={form.portfolio_id || "__none__"} onValueChange={(v) => setF({ portfolio_id: v === "__none__" ? "" : v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Property Finder listing ID (optional)</Label>
              <Input className="mt-1" placeholder="PF internal id" value={form.pf_id} onChange={(e) => setF({ pf_id: e.target.value })} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Price (AED)</Label>
              <Input className="mt-1" type="number" placeholder="0" value={form.price} onChange={(e) => setF({ price: e.target.value })} />
            </div>
            <div>
              <Label>Area (sqft)</Label>
              <Input className="mt-1" type="number" placeholder="0" value={form.area} onChange={(e) => setF({ area: e.target.value })} />
            </div>
            <div>
              <Label>Bedrooms</Label>
              <Input className="mt-1" type="number" min={0} placeholder="0" value={form.bedrooms} onChange={(e) => setF({ bedrooms: e.target.value })} />
            </div>
            <div>
              <Label>Bathrooms</Label>
              <Input className="mt-1" type="number" min={0} placeholder="0" value={form.bathrooms} onChange={(e) => setF({ bathrooms: e.target.value })} />
            </div>
            <div>
              <Label>Commission %</Label>
              <Input className="mt-1" type="number" placeholder="2" value={form.commission_rate} onChange={(e) => setF({ commission_rate: e.target.value })} />
            </div>
            <div>
              <Label>Listing reference</Label>
              <Input className="mt-1" placeholder="BYT-12345 / internal ref" value={form.listing_id} onChange={(e) => setF({ listing_id: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Price type</Label>
              <Input className="mt-1" placeholder="e.g. sale, yearly, monthly (as on portals)" value={form.price_type} onChange={(e) => setF({ price_type: e.target.value })} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Emirate</Label>
              <Input className="mt-1" placeholder="Dubai, Abu Dhabi…" value={form.emirate} onChange={(e) => setF({ emirate: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Input className="mt-1" placeholder="Residential / commercial…" value={form.category} onChange={(e) => setF({ category: e.target.value })} />
            </div>
            <div>
              <Label>Furnishing</Label>
              <Input className="mt-1" placeholder="Furnished, unfurnished…" value={form.furnishing_type} onChange={(e) => setF({ furnishing_type: e.target.value })} />
            </div>
            <div>
              <Label>Project status</Label>
              <Input className="mt-1" placeholder="Completed, off-plan…" value={form.project_status} onChange={(e) => setF({ project_status: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Available from</Label>
              <Input className="mt-1" type="date" value={form.available_from} onChange={(e) => setF({ available_from: e.target.value })} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>RERA / permit</Label>
                <Input className="mt-1" placeholder="Permit number" value={form.rera_number} onChange={(e) => setF({ rera_number: e.target.value })} />
              </div>
              <div>
                <Label>Verification status</Label>
                <Input className="mt-1" placeholder="As on PF" value={form.verification_status} onChange={(e) => setF({ verification_status: e.target.value })} />
              </div>
              <div>
                <Label>Quality score</Label>
                <Input className="mt-1" type="number" placeholder="Optional" value={form.quality_score} onChange={(e) => setF({ quality_score: e.target.value })} />
              </div>
              <div>
                <Label>Assigned CRM agent</Label>
                <Select value={form.crm_agent_id || "__none__"} onValueChange={(v) => setF({ crm_agent_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {profiles.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>{pr.full_name ?? pr.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1 min-h-[88px]" placeholder="Full description" value={form.description} onChange={(e) => setF({ description: e.target.value })} />
            </div>
            <div>
              <Label>Amenities</Label>
              <Textarea className="mt-1 min-h-[72px]" placeholder="Comma or line separated (Pool, Gym, …)" value={form.amenities_raw} onChange={(e) => setF({ amenities_raw: e.target.value })} />
            </div>
            <div>
              <Label>Image URLs</Label>
              <Textarea className="mt-1 min-h-[72px]" placeholder="One image URL per line" value={form.images_raw} onChange={(e) => setF({ images_raw: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <Label>Bayut URL</Label>
                <Input className="mt-1" placeholder="https://…" value={form.bayut_url} onChange={(e) => setF({ bayut_url: e.target.value })} />
              </div>
              <div>
                <Label>Property Finder URL</Label>
                <Input className="mt-1" placeholder="https://…" value={form.pf_url} onChange={(e) => setF({ pf_url: e.target.value })} />
              </div>
              <div>
                <Label>Dubizzle URL</Label>
                <Input className="mt-1" placeholder="https://…" value={form.dubizzle_url} onChange={(e) => setF({ dubizzle_url: e.target.value })} />
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
            <Button type="button" onClick={onSubmit} disabled={!form.title.trim() || !form.location.trim()}>
              {submitLabel}
            </Button>
          )}
        </div>
      </SheetFooter>
    </div>
  );
}

function PropertyImage({ images, className = "" }: { images: string[] | null; className?: string }) {
  const [error, setError] = useState(false);
  const src = images?.[0];
  if (!src || error) {
    return <div className={`flex items-center justify-center bg-muted ${className}`}><Home className="h-8 w-8 text-muted-foreground/30" /></div>;
  }
  return <img src={src} alt="Property" className={`object-cover ${className}`} onError={() => setError(true)} loading="lazy" />;
}

export default function PropertiesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [showCreate, setShowCreate] = useState(false);
  const [propertyFormStep, setPropertyFormStep] = useState(0);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<PropertyFormState>(() => emptyPropertyForm());
  const [bulkPortfolioPickerKey, setBulkPortfolioPickerKey] = useState(0);
  const isMobile = useIsMobile();

  const { data: properties = [], isLoading } = useProperties();
  const { data: portfolios = [] } = usePortfolios();
  const { data: profiles = [] } = useProfiles();
  const pfAgentNames = useMemo(() => buildPfAgentFullNameMap(profiles.filter((p) => p.pf_agent_id)), [profiles]);
  const profileIdToName = useMemo(() => buildProfileIdToFullNameMap(profiles), [profiles]);
  const qc = useQueryClient();

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0);

  const filtered = useMemo(() => properties.filter((p) => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchType = typeFilter === "all" || p.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  }), [properties, search, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map(p => p.id)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const { error } = await supabase.from("properties").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} properties deleted`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const handleBulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const { error } = await supabase.from("properties").update({ status: status as any }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} properties updated to ${status}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const handleBulkPortfolio = async (portfolioId: string | null) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const { error } = await supabase.from("properties").update({ portfolio_id: portfolioId }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    const label = portfolioId ? portfolios.find((p) => p.id === portfolioId)?.name ?? "portfolio" : "no portfolio";
    toast.success(`${ids.length} properties ${portfolioId ? `moved to ${label}` : "removed from portfolio"}`);
    setSelected(new Set());
    setBulkPortfolioPickerKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const handleDetailPortfolioChange = async (propertyId: string, portfolioId: string | null) => {
    const { error } = await supabase.from("properties").update({ portfolio_id: portfolioId }).eq("id", propertyId);
    if (error) { toast.error(error.message); return; }
    toast.success(portfolioId ? "Portfolio updated" : "Removed from portfolio");
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const pfAgentIdForForm = (agentProfileId: string) => {
    if (!agentProfileId) return null;
    const pid = profiles.find((p) => p.id === agentProfileId)?.pf_agent_id;
    return pid != null && String(pid).trim() !== "" ? String(pid).trim() : null;
  };

  const syncPropertyAgents = async (propertyId: string, agentProfileId: string | null) => {
    const { error: delErr } = await supabase.from("property_agents").delete().eq("property_id", propertyId);
    if (delErr) { toast.error(delErr.message); return false; }
    if (agentProfileId) {
      const { error: insErr } = await supabase.from("property_agents").insert({ property_id: propertyId, agent_id: agentProfileId });
      if (insErr) { toast.error(insErr.message); return false; }
    }
    return true;
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.location.trim()) {
      toast.error("Title and location are required");
      return;
    }
    const row = propertyRowFromForm(form, pfAgentIdForForm(form.crm_agent_id));
    const { data, error } = await supabase.from("properties").insert(row).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (data?.id) {
      const ok = await syncPropertyAgents(data.id, form.crm_agent_id || null);
      if (!ok) return;
    }
    toast.success("Property created");
    qc.invalidateQueries({ queryKey: ["properties"] });
    setShowCreate(false);
    resetForm();
    setPropertyFormStep(0);
  };

  const handleUpdate = async () => {
    if (!selectedPropertyId) return;
    if (!form.title.trim() || !form.location.trim()) {
      toast.error("Title and location are required");
      return;
    }
    const row = propertyRowFromForm(form, pfAgentIdForForm(form.crm_agent_id));
    const { error } = await supabase.from("properties").update(row).eq("id", selectedPropertyId);
    if (error) { toast.error(error.message); return; }
    const ok = await syncPropertyAgents(selectedPropertyId, form.crm_agent_id || null);
    if (!ok) return;
    toast.success("Property updated");
    setEditMode(false);
    setPropertyFormStep(0);
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from("properties").update({ status: status as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Property deleted");
    setSelectedPropertyId(null);
    qc.invalidateQueries({ queryKey: ["properties"] });
  };

  const resetForm = () => {
    setForm(emptyPropertyForm());
    setPropertyFormStep(0);
  };

  const openEdit = (p: typeof selectedProperty) => {
    if (!p) return;
    const pas = (p as { property_agents?: { agent_id?: string }[] | null }).property_agents;
    const firstAgent = Array.isArray(pas) && pas[0]?.agent_id ? pas[0].agent_id : "";
    setForm({
      title: p.title,
      location: p.location,
      type: p.type,
      status: p.status,
      portfolio_id: p.portfolio_id ?? "",
      listing_id: p.listing_id ?? "",
      price: String(p.price),
      area: String(p.area),
      bedrooms: String(p.bedrooms),
      bathrooms: String(p.bathrooms),
      commission_rate: String(p.commission_rate),
      price_type: p.price_type ?? "",
      emirate: p.emirate ?? "",
      category: p.category ?? "",
      furnishing_type: p.furnishing_type ?? "",
      project_status: p.project_status ?? "",
      available_from: p.available_from ? p.available_from.slice(0, 10) : "",
      rera_number: p.rera_number ?? "",
      verification_status: p.verification_status ?? "",
      quality_score: p.quality_score != null ? String(p.quality_score) : "",
      description: p.description ?? "",
      amenities_raw: p.amenities?.length ? p.amenities.join(", ") : "",
      images_raw: p.images?.length ? p.images.join("\n") : "",
      bayut_url: p.bayut_url ?? "",
      pf_url: p.pf_url ?? "",
      dubizzle_url: p.dubizzle_url ?? "",
      pf_id: p.pf_id ?? "",
      crm_agent_id: firstAgent,
    });
    setPropertyFormStep(0);
    setEditMode(true);
  };

  const openProperty = (id: string) => { setSelectedPropertyId(id); setEditMode(false); };

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

  const BulkActions = () => selected.size > 0 ? (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-accent p-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 min-w-0">
        <CheckSquare className="h-4 w-4 shrink-0 text-accent-foreground" />
        <span className="text-sm font-medium truncate">{selected.size} selected</span>
      </div>
      <div className="flex flex-wrap items-center gap-1 sm:ml-auto sm:justify-end">
        <Select
          key={bulkPortfolioPickerKey}
          disabled={portfolios.length === 0}
          onValueChange={(v) => void handleBulkPortfolio(v)}
        >
          <SelectTrigger className="h-8 w-full min-w-0 text-xs sm:w-[200px]">
            <FolderOpen className="mr-1 h-3.5 w-3.5 shrink-0 opacity-70" />
            <SelectValue placeholder={portfolios.length === 0 ? "No portfolios" : "Assign to portfolio…"} />
          </SelectTrigger>
          <SelectContent>
            {portfolios.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void handleBulkPortfolio(null)}>
          <FolderX className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Remove from </span>portfolio
        </Button>
        <Select onValueChange={handleBulkStatus}>
          <SelectTrigger className="h-8 w-full min-w-0 text-xs sm:w-[130px]"><SelectValue placeholder="Set status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="off_market">Off Market</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="destructive" size="sm" className="h-8" onClick={handleBulkDelete}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelected(new Set())}>Cancel</Button>
      </div>
    </div>
  ) : null;

  return (
    <PageShell title="Properties" subtitle={`${filtered.length} properties found`}
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center border rounded-lg overflow-hidden">
            <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className="rounded-none h-8 px-2.5" onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" className="rounded-none h-8 px-2.5" onClick={() => setViewMode("table")}><List className="h-4 w-4" /></Button>
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Add Property</span>
          </Button>
          <Sheet
            open={showCreate}
            onOpenChange={(open) => {
              setShowCreate(open);
              if (!open) resetForm();
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
                <SheetTitle>Add property</SheetTitle>
                <SheetDescription className="sr-only">Multi-step form aligned with Property Finder fields</SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <PropertyFormWizard
                  form={form}
                  setForm={setForm}
                  step={propertyFormStep}
                  setStep={setPropertyFormStep}
                  portfolios={portfolios}
                  profiles={profiles}
                  isMobile={isMobile}
                  onSubmit={handleCreate}
                  submitLabel="Create property"
                  onCancel={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      }
    >
      <div className="mb-4 md:mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search properties..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
        </div>
        {isMobile ? (
          <MobileFilterSheet activeCount={activeFilterCount}>
            <><div><Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label><Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="reserved">Reserved</SelectItem><SelectItem value="sold">Sold</SelectItem><SelectItem value="off_market">Off Market</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Type</Label><Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="apartment">Apartment</SelectItem><SelectItem value="villa">Villa</SelectItem><SelectItem value="office">Office</SelectItem><SelectItem value="penthouse">Penthouse</SelectItem><SelectItem value="townhouse">Townhouse</SelectItem></SelectContent></Select></div></>
          </MobileFilterSheet>
        ) : (
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="reserved">Reserved</SelectItem><SelectItem value="sold">Sold</SelectItem><SelectItem value="off_market">Off Market</SelectItem></SelectContent></Select>
            <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="apartment">Apartment</SelectItem><SelectItem value="villa">Villa</SelectItem><SelectItem value="office">Office</SelectItem><SelectItem value="penthouse">Penthouse</SelectItem><SelectItem value="townhouse">Townhouse</SelectItem></SelectContent></Select>
          </div>
        )}
      </div>

      <BulkActions />

      {isLoading ? <CardGridSkeleton /> : viewMode === "grid" ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paged.map((property, i) => (
              <motion.div key={property.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="group overflow-hidden transition-all hover:shadow-md cursor-pointer relative">
                  <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(property.id)} onCheckedChange={() => toggleSelect(property.id)} className="bg-background/80 backdrop-blur" />
                  </div>
                  <div onClick={() => openProperty(property.id)}>
                    <PropertyImage images={property.images} className="w-full h-32 md:h-40" />
                    <div className="p-3 md:p-4">
                      <p className="text-sm font-semibold text-card-foreground line-clamp-1">{property.title}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{property.location}</span></div>
                      <p className="mt-2 text-lg md:text-xl font-bold text-card-foreground">{formatCurrency(Number(property.price))}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        {property.bedrooms > 0 && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {property.bedrooms}</span>}
                        <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {property.bathrooms}</span>
                        <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {Number(property.area)} sqft</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="outline" className={statusStyles[property.status] ?? ""}>{property.status.replace("_", "-")}</Badge>
                        <div className="flex gap-1">
                          {property.bayut_url && <Badge variant="secondary" className="text-[10px]">Bayut</Badge>}
                          {property.pf_url && <Badge variant="secondary" className="text-[10px]">PF</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          <Pagination />
        </>
      ) : (
        <>
          <div className="overflow-x-auto">
          <Card className="overflow-hidden min-w-[1480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={paged.length > 0 && selected.size === paged.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="w-14">Image</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="max-w-[140px]">Portfolio</TableHead>
                  <TableHead>Emirate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Price Type</TableHead>
                  <TableHead className="text-center">Beds</TableHead>
                  <TableHead className="text-center">Baths</TableHead>
                  <TableHead className="text-right">Area</TableHead>
                  <TableHead>Furnishing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>RERA</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Portals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((property) => {
                  const agentName = resolvePropertyAssignedAgentName(property as Record<string, unknown>, pfAgentNames, profileIdToName);
                  return (
                  <TableRow key={property.id} className="cursor-pointer">
                    <TableCell className="p-2" onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(property.id)} onCheckedChange={() => toggleSelect(property.id)} /></TableCell>
                    <TableCell className="p-2" onClick={() => openProperty(property.id)}><PropertyImage images={property.images} className="w-12 h-12 rounded-md shrink-0" /></TableCell>
                    <TableCell className="font-medium max-w-[200px]" onClick={() => openProperty(property.id)}>
                      <span className="line-clamp-1">{property.title}</span>
                      {property.listing_id && <span className="block text-xs text-muted-foreground">{property.listing_id}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[150px]" onClick={() => openProperty(property.id)}><span className="line-clamp-1">{property.location}</span></TableCell>
                    <TableCell className="max-w-[140px] text-sm text-muted-foreground" onClick={() => openProperty(property.id)}>
                      <span className="line-clamp-1" title={portfolios.find((x) => x.id === property.portfolio_id)?.name}>
                        {property.portfolio_id ? portfolios.find((x) => x.id === property.portfolio_id)?.name ?? "—" : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm" onClick={() => openProperty(property.id)}>{property.emirate || "Not provided"}</TableCell>
                    <TableCell className="capitalize" onClick={() => openProperty(property.id)}>{property.type}</TableCell>
                    <TableCell className="capitalize text-sm" onClick={() => openProperty(property.id)}>{property.category || "Not provided"}</TableCell>
                    <TableCell className="text-right font-semibold" onClick={() => openProperty(property.id)}>{formatCurrency(Number(property.price))}</TableCell>
                    <TableCell className="capitalize text-sm" onClick={() => openProperty(property.id)}>{property.price_type || "Not provided"}</TableCell>
                    <TableCell className="text-center" onClick={() => openProperty(property.id)}>{property.bedrooms}</TableCell>
                    <TableCell className="text-center" onClick={() => openProperty(property.id)}>{property.bathrooms}</TableCell>
                    <TableCell className="text-right" onClick={() => openProperty(property.id)}>{Number(property.area)} sqft</TableCell>
                    <TableCell className="capitalize text-sm" onClick={() => openProperty(property.id)}>{property.furnishing_type || "Not provided"}</TableCell>
                    <TableCell onClick={() => openProperty(property.id)}><Badge variant="outline" className={`text-xs ${statusStyles[property.status] ?? ""}`}>{property.status.replace("_", "-")}</Badge></TableCell>
                    <TableCell onClick={() => openProperty(property.id)}>
                      {property.quality_score ? <Badge variant="secondary" className="text-xs">{property.quality_score}</Badge> : <span className="text-xs text-muted-foreground">N/A</span>}
                    </TableCell>
                    <TableCell className="text-xs" onClick={() => openProperty(property.id)}>{property.rera_number || "Not provided"}</TableCell>
                    <TableCell className="text-sm" onClick={() => openProperty(property.id)}>{agentName}</TableCell>
                    <TableCell onClick={() => openProperty(property.id)}>
                      <div className="flex gap-1">
                        {property.bayut_url && <Badge variant="secondary" className="text-[10px]">B</Badge>}
                        {property.pf_url && <Badge variant="secondary" className="text-[10px]">PF</Badge>}
                        {property.dubizzle_url && <Badge variant="secondary" className="text-[10px]">D</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          </div>
          <Pagination />
        </>
      )}

      <Sheet open={!!selectedProperty} onOpenChange={() => { setSelectedPropertyId(null); setEditMode(false); setPropertyFormStep(0); }}>
        <SheetContent className="flex min-h-0 w-full max-w-none flex-col overflow-hidden p-4 pb-4 md:p-6 sm:w-[560px] sm:max-w-[560px]">
          {selectedProperty && !editMode && (
            <>
              <SheetHeader><SheetTitle>{selectedProperty.title}</SheetTitle></SheetHeader>
              <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2 sm:px-3">
                {selectedProperty.images && selectedProperty.images.length > 0 ? (
                  <div className="space-y-2">
                    <PropertyImage images={selectedProperty.images} className="w-full h-48 rounded-lg" />
                    {selectedProperty.images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {selectedProperty.images.slice(1, 6).map((img, i) => (
                          <img key={i} src={img} alt={`Property ${i + 2}`} className="w-16 h-16 rounded-md object-cover shrink-0" loading="lazy" />
                        ))}
                        {selectedProperty.images.length > 6 && <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center shrink-0"><span className="text-xs text-muted-foreground font-medium">+{selectedProperty.images.length - 6}</span></div>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center bg-muted rounded-lg"><Home className="h-12 w-12 text-muted-foreground/30" /></div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">{formatCurrency(Number(selectedProperty.price))}</p>
                  <Badge variant="outline" className={statusStyles[selectedProperty.status] ?? ""}>{selectedProperty.status.replace("_", "-")}</Badge>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {selectedProperty.location}</div>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 text-center"><Bed className="h-4 w-4 mx-auto text-muted-foreground" /><p className="mt-1 font-semibold text-sm">{selectedProperty.bedrooms}</p><p className="text-xs text-muted-foreground">Beds</p></Card>
                  <Card className="p-3 text-center"><Bath className="h-4 w-4 mx-auto text-muted-foreground" /><p className="mt-1 font-semibold text-sm">{selectedProperty.bathrooms}</p><p className="text-xs text-muted-foreground">Baths</p></Card>
                  <Card className="p-3 text-center"><Maximize className="h-4 w-4 mx-auto text-muted-foreground" /><p className="mt-1 font-semibold text-sm">{Number(selectedProperty.area)}</p><p className="text-xs text-muted-foreground">sqft</p></Card>
                </div>
                {selectedProperty.description && <div><p className="text-xs text-muted-foreground mb-1">Description</p><p className="text-sm">{selectedProperty.description}</p></div>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium capitalize">{selectedProperty.type}</p></div>
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="font-medium capitalize">{selectedProperty.category || "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Listing ID</p><p className="font-medium">{selectedProperty.listing_id ?? "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Commission</p><p className="font-medium">{Number(selectedProperty.commission_rate)}%</p></div>
                  <div><p className="text-xs text-muted-foreground">Emirate</p><p className="font-medium">{selectedProperty.emirate || "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Furnishing</p><p className="font-medium capitalize">{selectedProperty.furnishing_type || "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Price Type</p><p className="font-medium capitalize">{selectedProperty.price_type || "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Quality Score</p><p className="font-medium">{selectedProperty.quality_score ?? "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">RERA Number</p><p className="font-medium">{selectedProperty.rera_number || "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Verification</p><p className="font-medium capitalize">{selectedProperty.verification_status || "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Available From</p><p className="font-medium">{selectedProperty.available_from ? formatDate(selectedProperty.available_from) : "Not provided"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Assigned Agent</p><p className="font-medium">{resolvePropertyAssignedAgentName(selectedProperty as Record<string, unknown>, pfAgentNames, profileIdToName)}</p></div>
                </div>
                {selectedProperty.amenities && selectedProperty.amenities.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Amenities</p>
                    <div className="flex flex-wrap gap-1">{selectedProperty.amenities.map((a, i) => <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>)}</div>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Change Status</Label>
                  <Select value={selectedProperty.status} onValueChange={v => handleStatusChange(selectedProperty.id, v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="reserved">Reserved</SelectItem><SelectItem value="sold">Sold</SelectItem><SelectItem value="off_market">Off Market</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Portfolio</Label>
                  <Select
                    value={selectedProperty.portfolio_id ?? "__none__"}
                    onValueChange={(v) => void handleDetailPortfolioChange(selectedProperty.id, v === "__none__" ? null : v)}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {portfolios.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedProperty.bayut_url && <Button variant="outline" size="sm" onClick={() => window.open(selectedProperty.bayut_url!, "_blank")}><ExternalLink className="mr-1 h-3 w-3" /> Bayut</Button>}
                  {selectedProperty.pf_url && <Button variant="outline" size="sm" onClick={() => window.open(selectedProperty.pf_url!, "_blank")}><ExternalLink className="mr-1 h-3 w-3" /> PF</Button>}
                  {selectedProperty.dubizzle_url && <Button variant="outline" size="sm" onClick={() => window.open(selectedProperty.dubizzle_url!, "_blank")}><ExternalLink className="mr-1 h-3 w-3" /> Dubizzle</Button>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => openEdit(selectedProperty)}><Edit className="mr-1 h-4 w-4" /> Edit</Button>
                  <Button variant="destructive" className="flex-1" onClick={() => handleDelete(selectedProperty.id)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
                </div>
              </div>
            </>
          )}
          {selectedProperty && editMode && (
            <>
              <SheetHeader className="text-left space-y-1 pr-8">
                <SheetTitle>Edit property</SheetTitle>
                <SheetDescription className="sr-only">Update all fields</SheetDescription>
              </SheetHeader>
              <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                <PropertyFormWizard
                  form={form}
                  setForm={setForm}
                  step={propertyFormStep}
                  setStep={setPropertyFormStep}
                  portfolios={portfolios}
                  profiles={profiles}
                  isMobile={isMobile}
                  onSubmit={handleUpdate}
                  submitLabel="Save changes"
                  onCancel={() => {
                    setEditMode(false);
                    setPropertyFormStep(0);
                  }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
