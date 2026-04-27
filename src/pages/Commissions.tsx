import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { useCommissions, usePfAgentProfiles, useDeals, formatCurrency } from "@/hooks/useSupabaseData";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, CheckCircle, Clock, TrendingUp, Download, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const commissionStatusStyles: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  paid: "bg-primary/10 text-accent-foreground border-primary/20",
};

export default function CommissionsPage() {
  const { data: commissions = [] } = useCommissions();
  const { data: pfAgents = [] } = usePfAgentProfiles();
  const { data: deals = [] } = useDeals();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ agent_id: "", deal_id: "", deal_value: "", commission_rate: "2" });

  const totalPending = commissions.filter(c => c.status === "pending").reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const totalApproved = commissions.filter(c => c.status === "approved").reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const totalPaid = commissions.filter(c => c.status === "paid").reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const totalRevenue = commissions.reduce((sum, c) => sum + Number(c.deal_value), 0);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    const update: any = { status: newStatus };
    if (newStatus === "paid") update.paid_date = new Date().toISOString();
    const { error } = await supabase.from("commissions").update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Commission ${newStatus}`);
    qc.invalidateQueries({ queryKey: ["commissions"] });
  };

  const handleCreateCommission = async () => {
    const dealValue = Number(form.deal_value) || 0;
    const rate = Number(form.commission_rate) || 2;
    const { error } = await supabase.from("commissions").insert({
      agent_id: form.agent_id || null,
      deal_id: form.deal_id || null,
      deal_value: dealValue,
      commission_rate: rate,
      commission_amount: dealValue * rate / 100,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Commission created");
    qc.invalidateQueries({ queryKey: ["commissions"] });
    setShowCreate(false);
    setForm({ agent_id: "", deal_id: "", deal_value: "", commission_rate: "2" });
  };

  const handleExportCSV = () => {
    const header = "Agent,Deal Value,Rate,Commission,Status,Date\n";
    const rows = commissions.map(c => {
      const agent = (c as any).profiles?.full_name ?? "—";
      return `"${agent}",${c.deal_value},${c.commission_rate}%,${c.commission_amount},${c.status},${c.created_at}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "commissions.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const agentStats = pfAgents.map(p => {
    const agentComm = commissions.filter(c => c.agent_id === p.id);
    return {
      id: p.id, name: p.full_name, baseSalary: Number(p.base_salary),
      totalCommission: agentComm.reduce((s, c) => s + Number(c.commission_amount), 0),
      pendingCommission: agentComm.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount), 0),
      dealsThisMonth: agentComm.length,
      revenue: agentComm.reduce((s, c) => s + Number(c.deal_value), 0),
    };
  });

  return (
    <PageShell title="Commissions & Finance" subtitle="Revenue, payouts and agent earnings"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Export</span></Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Add</span></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Commission</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label>Agent</Label>
                  <Select value={form.agent_id} onValueChange={v => setForm(f => ({ ...f, agent_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                    <SelectContent>{pfAgents.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Deal</Label>
                  <Select value={form.deal_id} onValueChange={v => {
                    const deal = deals.find(d => d.id === v);
                    setForm(f => ({ ...f, deal_id: v, deal_value: deal ? String(deal.value) : f.deal_value }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select deal (optional)" /></SelectTrigger>
                    <SelectContent>{deals.map(d => <SelectItem key={d.id} value={d.id}>{(d as any).leads?.name ?? "Deal"} — {formatCurrency(Number(d.value))}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Deal Value</Label><Input type="number" placeholder="0" value={form.deal_value} onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))} /></div>
                  <div><Label>Rate %</Label><Input type="number" placeholder="2" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} /></div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Commission Amount</p>
                  <p className="font-heading text-xl font-bold">{formatCurrency((Number(form.deal_value) || 0) * (Number(form.commission_rate) || 0) / 100)}</p>
                </div>
                <Button className="w-full" onClick={handleCreateCommission} disabled={!form.deal_value}>Create Commission</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="mb-4 md:mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pending", icon: Clock, value: totalPending, color: "text-warning" },
          { label: "Approved", icon: CheckCircle, value: totalApproved, color: "text-success" },
          { label: "Total Paid", icon: DollarSign, value: totalPaid, color: "" },
          { label: "Total Revenue", icon: TrendingUp, value: totalRevenue, color: "" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground"><kpi.icon className="h-3.5 w-3.5" /> {kpi.label}</div>
              <p className={`mt-1 font-heading text-lg md:text-2xl font-bold ${kpi.color}`}>{formatCurrency(kpi.value)}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="commissions">
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden flex-nowrap h-auto gap-1 no-scrollbar"><TabsTrigger value="commissions">Commissions</TabsTrigger><TabsTrigger value="agents">Agent Earnings</TabsTrigger></TabsList>
        <TabsContent value="commissions" className="mt-4">
          <Card className="p-3 md:p-5">
            <h3 className="font-heading text-sm md:text-base font-semibold mb-3 md:mb-4">Commission Ledger</h3>
            <div className="space-y-2 md:space-y-0">
              {isMobile ? commissions.map(c => (
                <Card key={c.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{(c as any).profiles?.full_name ?? "—"}</p>
                    <Badge variant="outline" className={commissionStatusStyles[c.status]}>{c.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div><p>Deal Value</p><p className="font-semibold text-card-foreground">{formatCurrency(Number(c.deal_value))}</p></div>
                    <div><p>Rate</p><p className="font-semibold text-card-foreground">{Number(c.commission_rate)}%</p></div>
                    <div><p>Commission</p><p className="font-semibold text-card-foreground">{formatCurrency(Number(c.commission_amount))}</p></div>
                  </div>
                  {c.status !== "paid" && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => handleStatusUpdate(c.id, c.status === "pending" ? "approved" : "paid")}>
                      {c.status === "pending" ? "Approve" : "Mark Paid"}
                    </Button>
                  )}
                </Card>
              )) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2 pr-4">Agent</th><th className="pb-2 pr-4 text-right">Deal Value</th><th className="pb-2 pr-4 text-right">Rate</th><th className="pb-2 pr-4 text-right">Commission</th><th className="pb-2 pr-4">Status</th><th className="pb-2"></th></tr></thead>
                    <tbody>
                      {commissions.map(c => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">{(c as any).profiles?.full_name ?? "—"}</td>
                          <td className="py-3 pr-4 text-right">{formatCurrency(Number(c.deal_value))}</td>
                          <td className="py-3 pr-4 text-right">{Number(c.commission_rate)}%</td>
                          <td className="py-3 pr-4 text-right font-semibold">{formatCurrency(Number(c.commission_amount))}</td>
                          <td className="py-3 pr-4"><Badge variant="outline" className={commissionStatusStyles[c.status]}>{c.status}</Badge></td>
                          <td className="py-3">
                            {c.status === "pending" && <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(c.id, "approved")}>Approve</Button>}
                            {c.status === "approved" && <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(c.id, "paid")}>Mark Paid</Button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-2">
            {agentStats.map((agent, i) => (
              <motion.div key={agent.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="p-4 md:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">{agent.name.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                    <div><p className="font-heading text-sm font-semibold">{agent.name}</p><p className="text-xs text-muted-foreground">{agent.dealsThisMonth} deals</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-muted-foreground text-xs">Base Salary</p><p className="font-semibold">{formatCurrency(agent.baseSalary)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Total Commission</p><p className="font-semibold">{formatCurrency(agent.totalCommission)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Pending</p><p className="font-semibold text-warning">{formatCurrency(agent.pendingCommission)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Revenue</p><p className="font-semibold">{formatCurrency(agent.revenue)}</p></div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
