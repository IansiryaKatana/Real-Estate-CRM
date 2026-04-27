import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useCommissions, usePfAgentProfiles, formatCurrency } from "@/hooks/useSupabaseData";

export function TopSalespersons() {
  const { data: commissions } = useCommissions();
  const { data: pfAgents } = usePfAgentProfiles();

  const agentStats = (pfAgents ?? [])
    .map(p => {
      const agentCommissions = (commissions ?? []).filter(c => c.agent_id === p.id);
      const totalRevenue = agentCommissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
      const deals = agentCommissions.length;
      return { name: p.full_name, deals, target: 12, revenue: totalRevenue };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }} className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-base font-semibold text-card-foreground">Top Performers</h3>
      <p className="mb-4 text-sm text-muted-foreground">This month's leaders</p>
      <div className="space-y-4">
        {agentStats.map((sp, i) => (
          <div key={sp.name} className="flex items-center gap-3">
            <span className="w-5 text-center font-heading text-sm font-bold text-muted-foreground">{i + 1}</span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                {sp.name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-card-foreground">{sp.name}</p>
                <p className="text-sm font-semibold text-card-foreground">{formatCurrency(sp.revenue)}</p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Progress value={(sp.deals / sp.target) * 100} className="h-1.5" />
                <span className="text-xs text-muted-foreground">{sp.deals}/{sp.target}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
