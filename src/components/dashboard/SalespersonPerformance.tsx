import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useLeads, useCommissions, useCurrentProfile, formatCurrency } from "@/hooks/useSupabaseData";
import { useMemo } from "react";
import { Target } from "lucide-react";

/** Scoped KPIs for the logged-in agent (RLS already filters lists). */
export function SalespersonPerformance() {
  const { data: me } = useCurrentProfile();
  const { data: leads = [] } = useLeads();
  const { data: commissions = [] } = useCommissions();

  const stats = useMemo(() => {
    const myId = me?.id;
    const myLeads = myId ? leads.filter((l) => l.assigned_agent_id === myId) : [];
    const myComm = myId ? commissions.filter((c) => c.agent_id === myId) : [];
    const active = myLeads.filter((l) => !["closed_won", "closed_lost"].includes(l.status)).length;
    const won = myLeads.filter((l) => l.status === "closed_won").length;
    const revenue = myComm.reduce((s, c) => s + Number(c.commission_amount), 0);
    const target = 12;
    return {
      name: me?.full_name ?? "You",
      active,
      won,
      revenue,
      deals: myComm.length,
      target,
    };
  }, [me?.id, me?.full_name, leads, commissions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-xl border border-border bg-card p-4 md:p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary shrink-0" />
        <div>
          <h3 className="font-heading text-sm md:text-base font-semibold text-card-foreground">My performance</h3>
          <p className="text-xs text-muted-foreground">Your leads & commissions (this workspace)</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
            {stats.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{stats.name}</p>
          <p className="text-xs text-muted-foreground">{stats.active} active leads · {stats.won} won</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{formatCurrency(stats.revenue)}</p>
          <p className="text-[10px] text-muted-foreground">commission</p>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Deals recorded</span>
          <span>
            {stats.deals}/{stats.target}
          </span>
        </div>
        <Progress value={Math.min(100, (stats.deals / stats.target) * 100)} className="h-1.5" />
      </div>
    </motion.div>
  );
}
