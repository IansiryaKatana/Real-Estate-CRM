import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useCommissions, formatCurrency } from "@/hooks/useSupabaseData";

export function RevenueChart() {
  const { data: commissions } = useCommissions();

  const data = useMemo(() => {
    const monthMap = new Map<string, number>();
    for (const c of commissions ?? []) {
      const d = new Date(c.created_at);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(sortKey, (monthMap.get(sortKey) ?? 0) + Number(c.commission_amount));
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([sortKey, revenue]) => {
        const [y, m] = sortKey.split("-").map(Number);
        const month = new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        return { month, revenue };
      });
  }, [commissions]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-card-foreground">Revenue</h3>
          <p className="text-sm text-muted-foreground">Commission revenue by month</p>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No commission data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 90%)" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(160, 5%, 45%)" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(160, 5%, 45%)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(0, 0%, 100%)", border: "1px solid hsl(40, 15%, 90%)", borderRadius: "8px", fontSize: "13px" }}
              formatter={(value: number) => [formatCurrency(value), "Revenue"]}
            />
            <Bar dataKey="revenue" fill="hsl(158, 64%, 20%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
