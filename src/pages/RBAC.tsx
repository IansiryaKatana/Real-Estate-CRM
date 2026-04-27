import { useState, useMemo } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProfiles, useProfileWorkloadStats } from "@/hooks/useSupabaseData";
import { Plus, Edit, Trash2, CheckSquare, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  Executive: "bg-destructive/10 text-destructive border-destructive/20",
  Operations: "bg-primary/10 text-accent-foreground border-primary/20",
  Sales: "bg-success/10 text-success border-success/20",
  Finance: "bg-accent text-accent-foreground border-accent-foreground/20",
};

const permissions = [
  { module: "Dashboard", super_admin: true, admin: true, manager: true, salesperson: true, finance: true },
  { module: "Properties", super_admin: true, admin: true, manager: true, salesperson: "view", finance: false },
  { module: "Leads", super_admin: true, admin: true, manager: true, salesperson: "own + pool", finance: false },
  { module: "Pipeline", super_admin: true, admin: true, manager: true, salesperson: "own + pool", finance: false },
  { module: "Communications (email)", super_admin: true, admin: true, manager: true, salesperson: "own + pool", finance: false },
  { module: "WhatsApp (company line)", super_admin: true, admin: true, manager: true, salesperson: "own + pool", finance: false },
  { module: "Commissions", super_admin: true, admin: true, manager: "view", salesperson: "own", finance: true },
  { module: "RBAC", super_admin: true, admin: false, manager: false, salesperson: false, finance: false },
  { module: "Settings", super_admin: true, admin: true, manager: false, salesperson: false, finance: false },
  { module: "Audit Logs", super_admin: true, admin: true, manager: false, salesperson: false, finance: false },
];

const PAGE_SIZE = 25;

export type RBACPageProps = { embedded?: boolean };

export default function RBACPage({ embedded = false }: RBACPageProps) {
  const { data: profiles = [] } = useProfiles();
  const { data: workload } = useProfileWorkloadStats();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", department: "", phone: "", title: "", brn: "", nationality: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const editUser = profiles.find(p => p.id === editUserId);

  const filtered = useMemo(() => profiles.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    (p.brn ?? "").toLowerCase().includes(search.toLowerCase()) ||
    String((p as any).pf_agent_id ?? "").toLowerCase().includes(search.toLowerCase())
  ), [profiles, search]);

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
    const { error } = await supabase.from("profiles").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} users deleted`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["profile_workload_stats"] });
  };

  const handleBulkActivate = async (activate: boolean) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const { error } = await supabase.from("profiles").update({ is_active: activate }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} users ${activate ? "activated" : "deactivated"}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["profile_workload_stats"] });
  };

  const handleAddUser = async () => {
    const { error } = await supabase.from("profiles").insert({
      full_name: form.full_name, email: form.email, department: form.department || null,
      phone: form.phone || null, title: form.title || null, brn: form.brn || null, nationality: form.nationality || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("User added");
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["profile_workload_stats"] });
    setShowAdd(false);
    setForm({ full_name: "", email: "", department: "", phone: "", title: "", brn: "", nationality: "" });
  };

  const handleUpdateUser = async () => {
    if (!editUserId) return;
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name, email: form.email, department: form.department || null,
      phone: form.phone || null, title: form.title || null, brn: form.brn || null, nationality: form.nationality || null,
    }).eq("id", editUserId);
    if (error) { toast.error(error.message); return; }
    toast.success("User updated");
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["profile_workload_stats"] });
    setEditUserId(null);
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(current ? "User deactivated" : "User activated");
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["profile_workload_stats"] });
  };

  const openEdit = (user: typeof editUser) => {
    if (!user) return;
    setForm({
      full_name: user.full_name, email: user.email, department: user.department ?? "",
      phone: user.phone ?? "", title: (user as any).title ?? "", brn: (user as any).brn ?? "",
      nationality: (user as any).nationality ?? "",
    });
    setEditUserId(user.id);
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

  const addUserDialog = (
    <Dialog open={showAdd} onOpenChange={setShowAdd}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Add User</span></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add System User</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div><Label>Full Name</Label><Input placeholder="User name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div><Label>Email</Label><Input type="email" placeholder="email@realestatecrm.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><Label>Title / Position</Label><Input placeholder="e.g. Senior Agent" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><Label>Department</Label><Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent><SelectItem value="Executive">Executive</SelectItem><SelectItem value="Operations">Operations</SelectItem><SelectItem value="Sales">Sales</SelectItem><SelectItem value="Finance">Finance</SelectItem></SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input placeholder="+971..." value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>BRN</Label><Input placeholder="Broker Reg. No." value={form.brn} onChange={e => setForm(f => ({ ...f, brn: e.target.value }))} /></div>
          </div>
          <div><Label>Nationality</Label><Input placeholder="e.g. UAE" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} /></div>
          <Button className="w-full" onClick={handleAddUser} disabled={!form.full_name || !form.email}>Add User</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const main = (
    <>
      <Tabs defaultValue="users">
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden flex-nowrap h-auto gap-1 no-scrollbar"><TabsTrigger value="users">Users</TabsTrigger><TabsTrigger value="permissions">Permissions</TabsTrigger><TabsTrigger value="approvals">Approvals</TabsTrigger></TabsList>
        <TabsContent value="users" className="mt-4 space-y-3">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, email, BRN, or PF agent ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent border border-border">
              <CheckSquare className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm font-medium">{selected.size} selected</span>
              <div className="flex gap-1 ml-auto">
                <Button variant="outline" size="sm" onClick={() => handleBulkActivate(true)}>Activate</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkActivate(false)}>Deactivate</Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Cancel</Button>
              </div>
            </div>
          )}

          {isMobile ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox checked={paged.length > 0 && selected.size === paged.length} onCheckedChange={toggleAll} />
                <span className="text-xs text-muted-foreground">Select all</span>
              </div>
              <div className="space-y-2">
                {paged.map(user => (
                  <Card key={user.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selected.has(user.id)} onCheckedChange={() => toggleSelect(user.id)} />
                      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(user)}>
                        <Avatar className="h-8 w-8">
                          {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
                          <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">{user.full_name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Leads: <span className="font-medium text-foreground">{workload?.leadCounts.get(user.id) ?? 0}</span>
                            {" · "}
                            Properties: <span className="font-medium text-foreground">{workload?.propertyCounts.get(user.id) ?? 0}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={roleColors[user.department ?? ""] ?? ""}>{user.department ?? "Not provided"}</Badge>
                        <Badge variant={user.is_active ? "default" : "secondary"} className={user.is_active ? "bg-success/10 text-success" : ""}>{user.is_active ? "active" : "inactive"}</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
            <Card className="p-0 overflow-hidden min-w-[1100px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={paged.length > 0 && selected.size === paged.length} onCheckedChange={toggleAll} /></TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="hidden lg:table-cell">BRN</TableHead>
                    <TableHead className="hidden lg:table-cell">Nationality</TableHead>
                    <TableHead className="hidden xl:table-cell">Languages</TableHead>
                    <TableHead className="hidden xl:table-cell">PF Status</TableHead>
                    <TableHead className="text-center w-[88px]">Leads</TableHead>
                    <TableHead className="text-center w-[88px]">Properties</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map(user => (
                    <TableRow key={user.id} className="cursor-pointer" onClick={() => openEdit(user)}>
                      <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(user.id)} onCheckedChange={() => toggleSelect(user.id)} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name} />}
                            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">{user.full_name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{(user as any).title || "Not provided"}</TableCell>
                      <TableCell><Badge variant="outline" className={roleColors[user.department ?? ""] ?? ""}>{user.department ?? "Not provided"}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{(user as any).brn || "Not provided"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{(user as any).nationality || "Not provided"}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm">
                        {Array.isArray((user as any).languages) && (user as any).languages.length > 0
                          ? (user as any).languages.join(", ")
                          : "Not provided"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {(user as any).pf_status ? (
                          <Badge variant="outline" className={(user as any).pf_status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                            {(user as any).pf_status}
                          </Badge>
                        ) : "Not provided"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">{workload?.leadCounts.get(user.id) ?? 0}</TableCell>
                      <TableCell className="text-center tabular-nums text-sm">{workload?.propertyCounts.get(user.id) ?? 0}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Badge variant={user.is_active ? "default" : "secondary"} className={user.is_active ? "bg-success/10 text-success" : ""}>{user.is_active ? "active" : "inactive"}</Badge>
                          <Switch checked={user.is_active ?? false} onCheckedChange={() => handleToggleActive(user.id, user.is_active ?? false)} />
                        </div>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}><Button variant="outline" size="sm" onClick={() => openEdit(user)}><Edit className="mr-1 h-3 w-3" /> Edit</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            </div>
          )}
          <Pagination />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <Card className="p-3 md:p-5 overflow-x-auto">
            <h3 className="text-sm md:text-base font-semibold mb-3">Permissions Matrix</h3>
            <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
              <table className="w-full text-xs md:text-sm min-w-[500px]">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2 pr-2">Module</th><th className="pb-2 text-center px-1">S.Admin</th><th className="pb-2 text-center px-1">Admin</th><th className="pb-2 text-center px-1">Manager</th><th className="pb-2 text-center px-1">Sales</th><th className="pb-2 text-center px-1">Finance</th></tr></thead>
                <tbody>
                  {permissions.map(p => (
                    <tr key={p.module} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{p.module}</td>
                      {(["super_admin", "admin", "manager", "salesperson", "finance"] as const).map(role => (
                        <td key={role} className="py-2 text-center px-1">
                          {p[role] === true ? <Badge className="bg-success/10 text-success border-success/20 text-[10px]" variant="outline">Full</Badge>
                            : p[role] === false ? <Badge variant="secondary" className="text-[10px]">—</Badge>
                            : <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">{p[role]}</Badge>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <Card className="p-4 md:p-5 space-y-3 max-w-xl">
            <h3 className="text-sm md:text-base font-semibold">Approval Workflows</h3>
            {[
              { name: "Lead Reassignment", desc: "Manager approval for reassignment", active: true },
              { name: "Commission Approval", desc: "Finance approves commissions >AED 50K", active: true },
              { name: "Property Status", desc: "Manager approval for off-market", active: false },
              { name: "Deal Closure", desc: "Admin sign-off on deals >AED 5M", active: true },
            ].map(wf => (
              <div key={wf.name} className="flex items-center justify-between rounded-lg border border-border p-3 gap-3">
                <div className="min-w-0"><p className="text-sm font-medium">{wf.name}</p><p className="text-xs text-muted-foreground">{wf.desc}</p></div>
                <Switch defaultChecked={wf.active} onCheckedChange={() => toast.success(`${wf.name} ${wf.active ? 'disabled' : 'enabled'}`)} />
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!editUserId} onOpenChange={() => setEditUserId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-4 md:p-6">
          {editUser && (
            <>
              <SheetHeader><SheetTitle>Edit User</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-3">
                {/* Avatar */}
                {editUser.avatar_url && (
                  <div className="flex justify-center">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={editUser.avatar_url} alt={editUser.full_name} />
                      <AvatarFallback className="bg-accent text-accent-foreground text-lg font-semibold">{editUser.full_name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <div><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Title / Position</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior Agent" /></div>
                <div><Label>Department</Label><Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent><SelectItem value="Executive">Executive</SelectItem><SelectItem value="Operations">Operations</SelectItem><SelectItem value="Sales">Sales</SelectItem><SelectItem value="Finance">Finance</SelectItem></SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div><Label>BRN</Label><Input value={form.brn} onChange={e => setForm(f => ({ ...f, brn: e.target.value }))} placeholder="Broker Reg. No." /></div>
                </div>
                <div><Label>Nationality</Label><Input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} /></div>
                
                {/* Read-only PF fields */}
                <div className="rounded-lg border border-border p-3 grid grid-cols-2 gap-2 text-sm bg-muted/20">
                  <div><span className="text-xs text-muted-foreground">Assigned leads</span><p className="font-medium tabular-nums">{workload?.leadCounts.get(editUser.id) ?? 0}</p></div>
                  <div><span className="text-xs text-muted-foreground">Properties</span><p className="font-medium tabular-nums">{workload?.propertyCounts.get(editUser.id) ?? 0}</p></div>
                </div>

                {(editUser as any).pf_agent_id && (
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property Finder Details</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-xs text-muted-foreground">PF Agent ID</span><p className="font-medium">{(editUser as any).pf_agent_id}</p></div>
                      <div><span className="text-xs text-muted-foreground">PF Status</span><p className="font-medium">{(editUser as any).pf_status || "Not provided"}</p></div>
                      {(editUser as any).pf_url && (
                        <div className="col-span-2"><span className="text-xs text-muted-foreground">PF Profile</span><a href={(editUser as any).pf_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline block truncate">{(editUser as any).pf_url}</a></div>
                      )}
                      {Array.isArray((editUser as any).languages) && (editUser as any).languages.length > 0 && (
                        <div className="col-span-2"><span className="text-xs text-muted-foreground">Languages</span><p className="font-medium">{(editUser as any).languages.join(", ")}</p></div>
                      )}
                      {Array.isArray((editUser as any).specializations) && (editUser as any).specializations.length > 0 && (
                        <div className="col-span-2"><span className="text-xs text-muted-foreground">Specializations</span><p className="font-medium">{(editUser as any).specializations.join(", ")}</p></div>
                      )}
                      {(editUser as any).experience_since && (
                        <div><span className="text-xs text-muted-foreground">Experience Since</span><p className="font-medium">{(editUser as any).experience_since}</p></div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={editUser.is_active ?? false} onCheckedChange={() => handleToggleActive(editUser.id, editUser.is_active ?? false)} /></div>
                <Button className="w-full" onClick={handleUpdateUser} disabled={!form.full_name || !form.email}>Save Changes</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Manage roles and permissions</p>
          {addUserDialog}
        </div>
        {main}
      </div>
    );
  }

  return (
    <PageShell title="Access Control" subtitle="Manage roles and permissions" actions={addUserDialog}>
      {main}
    </PageShell>
  );
}
