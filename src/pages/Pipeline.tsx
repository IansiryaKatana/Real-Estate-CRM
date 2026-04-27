import { useState, useMemo } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { useDeals, useLeads, useProperties, useProfiles, buildProfileIdToFullNameMap, leadStatusLabels, formatCurrency, type LeadStatus } from "@/hooks/useSupabaseData";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DollarSign, CalendarDays, Percent, Plus, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const pipelineStages: LeadStatus[] = ["new", "contacted", "qualified", "viewing", "negotiation", "closed_won", "closed_lost"];

const stageColors: Record<LeadStatus, string> = {
  new: "border-t-primary", contacted: "border-t-warning", qualified: "border-t-success",
  viewing: "border-t-accent-foreground", negotiation: "border-t-primary",
  closed_won: "border-t-success", closed_lost: "border-t-destructive",
};

function parseLocalYmd(ymd: string): Date | undefined {
  const raw = ymd.trim();
  if (!raw) return undefined;
  const [y, m, d] = raw.split("-").map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export default function PipelinePage() {
  const { data: dbDeals = [] } = useDeals();
  const { data: leads = [] } = useLeads();
  const { data: properties = [] } = useProperties();
  const { data: profiles = [] } = useProfiles();
  const profileIdToName = useMemo(() => buildProfileIdToFullNameMap(profiles), [profiles]);
  const profilesSorted = useMemo(
    () => [...profiles].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", undefined, { sensitivity: "base" })),
    [profiles],
  );
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [closeDateOpen, setCloseDateOpen] = useState(false);
  const [form, setForm] = useState({ lead_id: "", property_id: "", value: "", probability: "50", expected_close: "", assigned_agent_id: "" });
  const qc = useQueryClient();

  const selectedLead = useMemo(() => leads.find((l) => l.id === form.lead_id), [leads, form.lead_id]);
  const expectedCloseDate = useMemo(() => parseLocalYmd(form.expected_close), [form.expected_close]);
  const expectedCloseDisplay = useMemo(() => {
    if (!expectedCloseDate) return null;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(expectedCloseDate);
  }, [expectedCloseDate]);

  const deals = dbDeals.map(d => ({
    ...d,
    leadName: (d as any).leads?.name ?? "Unknown",
    propertyTitle: (d as any).properties?.title ?? "Unknown",
    assignedAgent: (() => {
      const fn = (d as any).profiles?.full_name?.trim();
      if (fn) return fn;
      const aid = (d as any).assigned_agent_id as string | null | undefined;
      if (aid && profileIdToName.has(aid)) return profileIdToName.get(aid)!;
      return "Unassigned";
    })(),
  }));

  const handleDrop = async (stage: LeadStatus) => {
    if (!draggedDeal) return;
    const { error } = await supabase.from("deals").update({ stage }).eq("id", draggedDeal);
    if (error) toast.error(error.message);
    else { toast.success("Deal moved"); qc.invalidateQueries({ queryKey: ["deals"] }); }
    setDraggedDeal(null);
  };

  const handleCreate = async () => {
    const { error } = await supabase.from("deals").insert({
      lead_id: form.lead_id || null,
      property_id: form.property_id || null,
      value: Number(form.value) || 0,
      probability: Number(form.probability) || 50,
      expected_close: form.expected_close || null,
      assigned_agent_id: form.assigned_agent_id || null,
      stage: "new" as any,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Deal created");
    qc.invalidateQueries({ queryKey: ["deals"] });
    setShowCreate(false);
    setForm({ lead_id: "", property_id: "", value: "", probability: "50", expected_close: "", assigned_agent_id: "" });
  };

  const handleDeleteDeal = async (id: string) => {
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deal deleted");
    qc.invalidateQueries({ queryKey: ["deals"] });
  };

  const stageDeals = (stage: LeadStatus) => deals.filter(d => d.stage === stage);
  const stageValue = (stage: LeadStatus) => stageDeals(stage).reduce((sum, d) => sum + Number(d.value), 0);
  const totalPipelineValue = deals.filter(d => d.stage !== "closed_lost").reduce((sum, d) => sum + Number(d.value), 0);
  const weightedValue = deals.filter(d => d.stage !== "closed_lost").reduce((sum, d) => sum + Number(d.value) * (d.probability ?? 0) / 100, 0);

  return (
    <PageShell title="Sales Pipeline" subtitle={`${deals.length} deals · ${formatCurrency(totalPipelineValue)}`}
      actions={
        <Dialog
          open={showCreate}
          onOpenChange={(open) => {
            setShowCreate(open);
            if (!open) {
              setLeadPickerOpen(false);
              setCloseDateOpen(false);
              setForm({ lead_id: "", property_id: "", value: "", probability: "50", expected_close: "", assigned_agent_id: "" });
            }
          }}
        >
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Add Deal</span></Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Deal</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Popover modal={false} open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={leadPickerOpen}
                    aria-label="Lead for this deal"
                    className="h-12 w-full justify-between px-4 text-base font-normal"
                  >
                    <span className={cn("truncate text-left", selectedLead ? "text-foreground" : "text-muted-foreground")}>
                      {selectedLead ? String(selectedLead.name ?? "Lead") : "Search and select a lead…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type to search leads by name, email, or phone…" />
                    <CommandList>
                      <CommandEmpty>No lead matches that search.</CommandEmpty>
                      <CommandGroup>
                        {leads.map((l) => {
                          const hint = [l.email, l.phone].filter(Boolean).join(" · ");
                          const searchValue = [l.name, l.email ?? "", l.phone ?? "", l.pf_lead_id ?? ""].filter(Boolean).join(" ");
                          const pid = typeof l.property_id === "string" ? l.property_id : "";
                          const aid = typeof l.assigned_agent_id === "string" ? l.assigned_agent_id : "";
                          return (
                            <CommandItem
                              key={String(l.id)}
                              value={searchValue}
                              onSelect={() => {
                                setForm((f) => ({
                                  ...f,
                                  lead_id: String(l.id),
                                  property_id: pid,
                                  assigned_agent_id: aid,
                                }));
                                setLeadPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", form.lead_id === l.id ? "opacity-100" : "opacity-0")} />
                              <span className="min-w-0 flex flex-col gap-0.5">
                                <span className="truncate font-medium">{String(l.name ?? "")}</span>
                                {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Select
                value={form.property_id || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, property_id: v }))}
              >
                <SelectTrigger className="h-12 px-4 text-base" aria-label="Property for this deal">
                  <SelectValue placeholder="Property for this deal" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-base py-3">
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  className="h-12 px-4 text-base"
                  placeholder="Deal value in AED"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  className="h-12 px-4 text-base"
                  placeholder="Win probability %"
                  value={form.probability}
                  onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
                />
              </div>

              <Popover modal={false} open={closeDateOpen} onOpenChange={setCloseDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-between px-4 text-base font-normal"
                    aria-label="Expected closing date"
                    aria-expanded={closeDateOpen}
                  >
                    <span className={cn("truncate text-left", expectedCloseDisplay ? "text-foreground" : "text-muted-foreground")}>
                      {expectedCloseDisplay ?? "Expected close"}
                    </span>
                    <CalendarDays className="ml-2 h-5 w-5 shrink-0 opacity-50" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expectedCloseDate}
                    onSelect={(d) => {
                      setForm((f) => ({ ...f, expected_close: d ? formatLocalYmd(d) : "" }));
                      setCloseDateOpen(false);
                    }}
                    defaultMonth={expectedCloseDate ?? new Date()}
                    initialFocus
                    className="w-full rounded-none p-3"
                    classNames={{
                      months: "w-full flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0",
                      month: "w-full space-y-4",
                      table: "w-full border-collapse space-y-1",
                      caption: "flex justify-center pt-1 relative items-center px-10",
                    }}
                  />
                  <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setForm((f) => ({ ...f, expected_close: "" }));
                        setCloseDateOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setForm((f) => ({ ...f, expected_close: formatLocalYmd(new Date()) }));
                        setCloseDateOpen(false);
                      }}
                    >
                      Today
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Select
                value={form.assigned_agent_id || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, assigned_agent_id: v }))}
              >
                <SelectTrigger className="h-12 px-4 text-base" aria-label="Assigned agent for this deal">
                  <SelectValue placeholder="Assigned agent" />
                </SelectTrigger>
                <SelectContent>
                  {profilesSorted.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-base py-3">
                      {p.full_name?.trim() || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button className="h-12 w-full text-base" onClick={handleCreate} disabled={!form.value}>
                Create Deal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 md:mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-3 md:p-4"><p className="text-xs md:text-sm text-muted-foreground">Total Pipeline</p><p className="font-heading text-xl md:text-2xl font-bold">{formatCurrency(totalPipelineValue)}</p></Card>
        <Card className="p-3 md:p-4"><p className="text-xs md:text-sm text-muted-foreground">Weighted Value</p><p className="font-heading text-xl md:text-2xl font-bold">{formatCurrency(weightedValue)}</p></Card>
        <Card className="p-3 md:p-4"><p className="text-xs md:text-sm text-muted-foreground">Active Deals</p><p className="font-heading text-xl md:text-2xl font-bold">{deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage)).length}</p></Card>
      </div>
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-3 px-3 md:-mx-0 md:px-0 snap-x snap-mandatory">
        {pipelineStages.map(stage => (
          <div key={stage} className="min-w-[220px] md:min-w-[260px] flex-shrink-0 snap-start" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(stage)}>
            <div className="mb-2 md:mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-xs md:text-sm font-semibold">{leadStatusLabels[stage]}</h3>
                <Badge variant="secondary" className="text-[10px] md:text-[11px]">{stageDeals(stage).length}</Badge>
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground">{formatCurrency(stageValue(stage))}</span>
            </div>
            <div className="space-y-2 md:space-y-3">
              {stageDeals(stage).map((deal, i) => (
                <motion.div key={deal.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }} draggable onDragStart={() => setDraggedDeal(deal.id)}>
                  <Card className={cn("cursor-grab border-t-4 px-2.5 pb-2.5 pt-3 md:p-3 md:pt-3.5 transition-all hover:shadow-md active:cursor-grabbing group", stageColors[stage], draggedDeal === deal.id && "opacity-50")}>
                    <div className="flex items-start gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-xs md:text-sm font-semibold leading-snug text-foreground break-words line-clamp-3">
                          {deal.leadName}
                        </p>
                        <p className="mt-1 text-[11px] md:text-xs text-muted-foreground leading-snug break-words line-clamp-2">
                          {deal.propertyTitle}
                        </p>
                      </div>
                      <Avatar className="mt-0.5 h-7 w-7 shrink-0 self-start">
                        <AvatarFallback className="bg-accent text-accent-foreground text-[10px] font-semibold">
                          {deal.assignedAgent.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(Number(deal.value))}</span>
                      <span className="flex items-center gap-1"><Percent className="h-3 w-3" />{deal.probability}%</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="w-full shrink-0 text-[10px] text-destructive max-h-0 overflow-hidden py-0 opacity-0 transition-[max-height,opacity,margin,padding] group-hover:mt-1.5 group-hover:max-h-9 group-hover:py-1.5 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDeal(deal.id);
                      }}
                    >
                      Delete
                    </Button>
                  </Card>
                </motion.div>
              ))}
              {stageDeals(stage).length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-border py-6 md:py-8 text-center text-xs text-muted-foreground">Drop deals here</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
