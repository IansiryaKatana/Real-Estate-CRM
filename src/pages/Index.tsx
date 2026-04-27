import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { LeadPipeline } from "@/components/dashboard/LeadPipeline";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { TopSalespersons } from "@/components/dashboard/TopSalespersons";
import { FinanceOverview } from "@/components/dashboard/FinanceOverview";
import { SalespersonPerformance } from "@/components/dashboard/SalespersonPerformance";
import { KPISkeleton, ChartSkeleton, TableSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Building2, Users, TrendingUp, DollarSign } from "lucide-react";
import { useProperties, useLeads, useCommissions, useUserRoles, formatCurrency } from "@/hooks/useSupabaseData";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";
import { isFinanceOnly, isManagement } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";

const Index = () => {
  const { data: roles = [] } = useUserRoles();
  const financeOnly = isFinanceOnly(roles as AppRole[]);
  const management = isManagement(roles as AppRole[]);

  const { data: properties, isLoading: loadingProps } = useProperties();
  const { data: leads, isLoading: loadingLeads } = useLeads();
  const { data: commissions, isLoading: loadingComm } = useCommissions();
  const isMobile = useIsMobile();

  const revenueMomPercent = useMemo((): number | undefined => {
    if (!commissions?.length) return undefined;
    const monthTotals = new Map<string, number>();
    for (const c of commissions) {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + Number(c.commission_amount));
    }
    const sorted = [...monthTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length < 2) return undefined;
    const prevVal = sorted[sorted.length - 2][1];
    const currVal = sorted[sorted.length - 1][1];
    if (prevVal === 0) return currVal > 0 ? 100 : undefined;
    return ((currVal - prevVal) / prevVal) * 100;
  }, [commissions]);

  const isLoading = loadingProps || loadingLeads || loadingComm;

  const totalProperties = properties?.length ?? 0;
  const activeLeads = leads?.filter(l => !["closed_won", "closed_lost"].includes(l.status)).length ?? 0;
  const closedWon = leads?.filter(l => l.status === "closed_won").length ?? 0;
  const totalLeads = Math.max(leads?.length ?? 0, 1);
  const conversionRate = ((closedWon / totalLeads) * 100).toFixed(1);
  const revenueMTD = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) ?? 0;

  if (financeOnly) {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className={`flex-1 transition-all duration-300 min-w-0 ${isMobile ? "ml-0" : "ml-[260px] pt-[25px]"}`}>
          <TopBar />
          <div className={`${isMobile ? "p-3" : "p-6"} space-y-4 md:space-y-6 overflow-x-hidden`}>
            <div>
              <h1 className="font-heading text-xl md:text-2xl font-bold">Finance overview</h1>
              <p className="text-sm text-muted-foreground">Commissions and payouts (lead data is restricted for this role)</p>
            </div>
            {loadingComm ? <KPISkeleton /> : <FinanceOverview />}
            <RevenueChart />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className={`flex-1 transition-all duration-300 min-w-0 ${isMobile ? "ml-0" : "ml-[260px] pt-[25px]"}`}>
        <TopBar />
        <div className={`${isMobile ? "p-3" : "p-6"} space-y-4 md:space-y-6 overflow-x-hidden`}>
          {isLoading ? (
            <>
              <KPISkeleton />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2"><ChartSkeleton /></div>
                <ChartSkeleton />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2"><TableSkeleton /></div>
                <TableSkeleton rows={3} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KPICard title="Total Properties" value={totalProperties.toString()} icon={Building2} variant="primary" />
                <KPICard title="Active Leads" value={activeLeads.toString()} icon={Users} />
                <KPICard title="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} />
                <KPICard title="Revenue (MTD)" value={formatCurrency(revenueMTD)} change={revenueMomPercent} icon={DollarSign} />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2"><RevenueChart /></div>
                <LeadPipeline scope={management ? "team" : "self"} />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <RecentLeads
                    title={management ? "Recent leads" : "Your recent leads"}
                    subtitle={management ? "Latest incoming leads" : "Assigned to you or unassigned pool"}
                  />
                </div>
                {management ? <TopSalespersons /> : <SalespersonPerformance />}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
