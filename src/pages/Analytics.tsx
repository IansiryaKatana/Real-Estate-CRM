import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads, useDeals, useProperties, useCommissions, usePfAgentProfiles, formatCurrency, sourceLabels, type LeadSourceType } from "@/hooks/useSupabaseData";
import { Download, TrendingUp, Users, Home, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";

const COLORS = ["hsl(158, 64%, 20%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(0, 72%, 51%)", "hsl(210, 40%, 60%)", "hsl(280, 50%, 50%)"];

export default function AnalyticsPage() {
  const { data: leads = [] } = useLeads();
  const { data: deals = [] } = useDeals();
  const { data: properties = [] } = useProperties();
  const { data: commissions = [] } = useCommissions();
  const { data: pfAgents = [] } = usePfAgentProfiles();
  const isMobile = useIsMobile();

  const monthlyRevenue = useMemo(() => {
    const monthMap = new Map<string, number>();
    for (const c of commissions) {
      const d = new Date(c.created_at);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(sortKey, (monthMap.get(sortKey) ?? 0) + Number(c.commission_amount));
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([sortKey, revenue]) => {
        const [y, m] = sortKey.split("-").map(Number);
        const label = new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        return { month: label, revenue };
      });
  }, [commissions]);

  const revenueMTD = commissions.reduce((s, c) => s + Number(c.commission_amount), 0);
  const leadsBySource = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => { acc[l.source] = (acc[l.source] || 0) + 1; return acc; }, {})
  ).map(([source, count]) => ({ name: sourceLabels[source as LeadSourceType] || source, value: count }));
  const funnelData = [
    { stage: "New", count: leads.filter(l => l.status === "new").length },
    { stage: "Contacted", count: leads.filter(l => l.status === "contacted").length },
    { stage: "Qualified", count: leads.filter(l => l.status === "qualified").length },
    { stage: "Viewing", count: leads.filter(l => l.status === "viewing").length },
    { stage: "Negotiation", count: leads.filter(l => l.status === "negotiation").length },
    { stage: "Won", count: leads.filter(l => l.status === "closed_won").length },
  ];
  const agentPerf = pfAgents.map(p => {
    const agentComm = commissions.filter(c => c.agent_id === p.id);
    return { name: p.full_name.split(" ")[0], deals: deals.filter(d => d.assigned_agent_id === p.id).length, revenue: agentComm.reduce((s, c) => s + Number(c.deal_value), 0) / 1000000 };
  });

  const chartHeight = isMobile ? 220 : 280;

  return (
    <PageShell title="Analytics & Reporting" subtitle="Business intelligence" actions={
      <div className="flex gap-2">
        <Select defaultValue="month"><SelectTrigger className="w-[110px] md:w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">This Week</SelectItem><SelectItem value="month">This Month</SelectItem><SelectItem value="quarter">Quarter</SelectItem><SelectItem value="year">This Year</SelectItem></SelectContent></Select>
        <Button variant="outline" size="sm" onClick={() => {
          const header = "Metric,Value\n";
          const rows = `Total Leads,${leads.length}\nActive Deals,${deals.length}\nProperties,${properties.length}\nRevenue MTD,${revenueMTD}\n`;
          const blob = new Blob([header + rows], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = "analytics.csv"; a.click();
          URL.revokeObjectURL(url);
        }}><Download className="h-4 w-4" /></Button>
      </div>
    }>
      <div className="mb-4 md:mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Leads", value: leads.length.toString(), icon: Users },
          { label: "Active Deals", value: deals.length.toString(), icon: TrendingUp },
          { label: "Properties", value: properties.length.toString(), icon: Home },
          { label: "Revenue (MTD)", value: formatCurrency(revenueMTD), icon: DollarSign },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-3 md:p-4">
              <div className="flex items-center justify-between"><p className="text-xs md:text-sm text-muted-foreground truncate">{kpi.label}</p><kpi.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground shrink-0" /></div>
              <p className="mt-1 font-heading text-lg md:text-2xl font-bold truncate">{kpi.value}</p>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
        <Card className="p-3 md:p-5">
          <h3 className="font-heading text-sm md:text-base font-semibold mb-3">Revenue Trend</h3>
          {monthlyRevenue.length === 0 ? (
            <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartHeight }}>No commission data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <LineChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 90%)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(160, 5%, 45%)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(160, 5%, 45%)" }} tickFormatter={v => `$${v / 1000}k`} width={45} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(158, 64%, 20%)" strokeWidth={2.5} dot={{ fill: "hsl(158, 64%, 20%)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-3 md:p-5">
          <h3 className="font-heading text-sm md:text-base font-semibold mb-3">Leads by Source</h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart><Pie data={leadsBySource} cx="50%" cy="50%" innerRadius={isMobile ? 50 : 70} outerRadius={isMobile ? 80 : 110} dataKey="value" label={!isMobile ? ({ name, value }) => `${name}: ${value}` : undefined}>{leadsBySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-3 md:p-5">
          <h3 className="font-heading text-sm md:text-base font-semibold mb-3">Conversion Funnel</h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 90%)" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(160, 5%, 45%)" }} />
              <YAxis type="category" dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(160, 5%, 45%)" }} width={isMobile ? 60 : 85} />
              <Tooltip /><Bar dataKey="count" fill="hsl(158, 64%, 20%)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-3 md:p-5">
          <h3 className="font-heading text-sm md:text-base font-semibold mb-3">Agent Performance</h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={agentPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 90%)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(160, 5%, 45%)" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(160, 5%, 45%)" }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="deals" fill="hsl(158, 64%, 20%)" radius={[6, 6, 0, 0]} name="Deals" />
              <Bar dataKey="revenue" fill="hsl(38, 92%, 50%)" radius={[6, 6, 0, 0]} name="Revenue ($M)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </PageShell>
  );
}
