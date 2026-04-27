import { useState, useMemo } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { useAuditLog, formatDateTime, type AuditEntry } from "@/hooks/useSupabaseData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  FileText,
  Edit,
  Trash2,
  Plus,
  MoreHorizontal,
  Loader2,
  CheckSquare,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const actionIcons: Record<string, typeof Edit> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
};
const actionColors: Record<string, string> = {
  create: "bg-success/10 text-success border-success/20",
  update: "bg-warning/10 text-warning border-warning/20",
  delete: "bg-destructive/10 text-destructive border-destructive/20",
};

const ACTION_OPTIONS = ["create", "update", "delete", "info"] as const;

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(val: string): string {
  return new Date(val).toISOString();
}

function emptyForm(defaultUser: string): {
  action: string;
  entity: string;
  entity_id: string;
  user_name: string;
  details: string;
  created_at_local: string;
} {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    action: "update",
    entity: "",
    entity_id: "",
    user_name: defaultUser,
    details: "",
    created_at_local: local,
  };
}

export type AuditLogPageProps = { embedded?: boolean };

export default function AuditLogPage({ embedded = false }: AuditLogPageProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const defaultUserName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "User";

  const { data: entries = [], isLoading } = useAuditLog();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [editEntry, setEditEntry] = useState<AuditEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<AuditEntry | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(defaultUserName));
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();

  const entities = useMemo(() => [...new Set(entries.map((e) => e.entity))], [entries]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const matchSearch =
          e.user_name.toLowerCase().includes(search.toLowerCase()) ||
          e.entity.toLowerCase().includes(search.toLowerCase()) ||
          (e.details ?? "").toLowerCase().includes(search.toLowerCase());
        const matchEntity = entityFilter === "all" || e.entity === entityFilter;
        return matchSearch && matchEntity;
      }),
    [entries, search, entityFilter],
  );

  const filteredIds = useMemo(() => filtered.map((e) => e.id), [filtered]);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const activeFilterCount = entityFilter !== "all" ? 1 : 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const n = new Set(prev);
        filteredIds.forEach((id) => n.delete(id));
        return n;
      });
    } else {
      setSelected((prev) => {
        const n = new Set(prev);
        filteredIds.forEach((id) => n.add(id));
        return n;
      });
    }
  };

  const openAdd = () => {
    setForm(emptyForm(defaultUserName));
    setShowAdd(true);
  };

  const openEdit = (e: AuditEntry) => {
    setForm({
      action: e.action,
      entity: e.entity,
      entity_id: e.entity_id ?? "",
      user_name: e.user_name,
      details: e.details ?? "",
      created_at_local: toDatetimeLocal(e.created_at),
    });
    setEditEntry(e);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["audit_log"] });

  const handleSaveCreate = async () => {
    if (!form.entity.trim() || !form.user_name.trim()) {
      toast.error("Entity and user name are required.");
      return;
    }
    setSaving(true);
    const payload = {
      action: form.action.trim(),
      entity: form.entity.trim(),
      entity_id: form.entity_id.trim() || null,
      user_name: form.user_name.trim(),
      details: form.details.trim() || null,
      created_at: fromDatetimeLocal(form.created_at_local),
    };
    const { error } = await supabase.from("audit_log").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Entry created");
    setShowAdd(false);
    setSelected(new Set());
    await invalidate();
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    if (!form.entity.trim() || !form.user_name.trim()) {
      toast.error("Entity and user name are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("audit_log")
      .update({
        action: form.action.trim(),
        entity: form.entity.trim(),
        entity_id: form.entity_id.trim() || null,
        user_name: form.user_name.trim(),
        details: form.details.trim() || null,
        created_at: fromDatetimeLocal(form.created_at_local),
      })
      .eq("id", editEntry.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Entry updated");
    setEditEntry(null);
    await invalidate();
  };

  const handleDeleteOne = async () => {
    if (!deleteEntry) return;
    setSaving(true);
    const { error } = await supabase.from("audit_log").delete().eq("id", deleteEntry.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Entry deleted");
    setDeleteEntry(null);
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(deleteEntry.id);
      return n;
    });
    await invalidate();
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setSaving(true);
    const { error } = await supabase.from("audit_log").delete().in("id", ids);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} entries deleted`);
    setSelected(new Set());
    setBulkDeleteOpen(false);
    await invalidate();
  };

  const FormFields = (
    <>
      <div>
        <Label>Action</Label>
        <Select value={form.action} onValueChange={(v) => setForm((f) => ({ ...f, action: v }))}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Entity</Label>
        <Input className="mt-1" value={form.entity} onChange={(e) => setForm((f) => ({ ...f, entity: e.target.value }))} placeholder="e.g. leads, settings" />
      </div>
      <div>
        <Label>Entity ID (optional)</Label>
        <Input className="mt-1" value={form.entity_id} onChange={(e) => setForm((f) => ({ ...f, entity_id: e.target.value }))} />
      </div>
      <div>
        <Label>User name</Label>
        <Input className="mt-1" value={form.user_name} onChange={(e) => setForm((f) => ({ ...f, user_name: e.target.value }))} />
      </div>
      <div>
        <Label>Timestamp</Label>
        <Input
          type="datetime-local"
          className="mt-1"
          value={form.created_at_local}
          onChange={(e) => setForm((f) => ({ ...f, created_at_local: e.target.value }))}
        />
      </div>
      <div>
        <Label>Details (optional)</Label>
        <Textarea className="mt-1 min-h-[88px]" value={form.details} onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))} />
      </div>
    </>
  );

  const FilterControls = () => (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">Entity</Label>
      <Select value={entityFilter} onValueChange={setEntityFilter}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Entities</SelectItem>
          {entities.map((e) => (
            <SelectItem key={e} value={e}>
              {e}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const bulkToolbar =
    selected.size > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-accent px-3 py-1.5 text-sm">
          <CheckSquare className="h-4 w-4 text-accent-foreground" />
          <span className="font-medium">{selected.size} selected</span>
        </div>
        <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete selected
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
          Clear selection
        </Button>
      </div>
    ) : null;

  const topBar = embedded ? (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <Button size="sm" onClick={openAdd}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add entry
      </Button>
      {bulkToolbar}
    </div>
  ) : (
    bulkToolbar && <div className="mb-4">{bulkToolbar}</div>
  );

  const tableSection = !isLoading && (
    <>
      {isMobile ? (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const Icon = actionIcons[entry.action] ?? FileText;
            return (
              <Card key={entry.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox checked={selected.has(entry.id)} onCheckedChange={() => toggleSelect(entry.id)} className="mt-1" />
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${actionColors[entry.action] ?? "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{entry.user_name}</p>
                      <Badge variant="outline" className={actionColors[entry.action] ?? ""}>
                        {entry.action}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.entity}
                      </Badge>
                    </div>
                    {entry.details && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{entry.details}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(entry.created_at)}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(entry)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEntry(entry)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border -mx-1 px-1 md:mx-0 md:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAllFiltered} aria-label="Select all visible" />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="hidden lg:table-cell">Entity ID</TableHead>
                <TableHead className="max-w-[240px] hidden xl:table-cell">Details</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const Icon = actionIcons[entry.action] ?? FileText;
                return (
                  <TableRow key={entry.id}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(entry.id)} onCheckedChange={() => toggleSelect(entry.id)} />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{entry.user_name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`flex h-6 w-6 items-center justify-center rounded ${actionColors[entry.action] ?? "bg-muted"}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <Badge variant="outline" className={actionColors[entry.action] ?? ""}>
                          {entry.action}
                        </Badge>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.entity}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                      {entry.entity_id ?? "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell max-w-[240px] truncate text-xs text-muted-foreground">{entry.details ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(entry.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(entry)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEntry(entry)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No audit entries match your filters.</p>}
    </>
  );

  const dialogs = (
    <>
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add audit entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">{FormFields}</div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveCreate()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit audit entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">{FormFields}</div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditEntry(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEntry} onOpenChange={(o) => !o && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the row from the audit log. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void handleDeleteOne()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} entries?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected audit log rows will be permanently removed from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void handleBulkDelete()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Delete ${selected.size}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const filtersRow = (
    <div className="mb-4 flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      {isMobile ? (
        <MobileFilterSheet activeCount={activeFilterCount}>
          <FilterControls />
        </MobileFilterSheet>
      ) : (
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  const loadingSkeleton = isLoading && (
    <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
  );

  const inner = (
    <>
      {topBar}
      {filtersRow}
      {loadingSkeleton}
      {!isLoading && tableSection}
      {dialogs}
    </>
  );

  if (embedded) {
    return (
      <div>
        <p className="text-sm text-muted-foreground mb-3">{filtered.length} shown · {entries.length} loaded</p>
        {inner}
      </div>
    );
  }

  return (
    <PageShell
      title="Audit Log"
      subtitle={`${filtered.length} shown · ${entries.length} loaded`}
      actions={
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add entry
        </Button>
      }
    >
      {inner}
    </PageShell>
  );
}
