import { motion } from "framer-motion";
import { useCommissions, formatCurrency } from "@/hooks/useSupabaseData";
import { DollarSign, Clock, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Dashboard strip for finance-focused users (commission visibility via RLS). */
export function FinanceOverview() {
  const { data: commissions = [] } = useCommissions();

  const pending = commissions.filter((c) => c.status === "pending").length;
  const approved = commissions.filter((c) => c.status === "approved").length;
  const paid = commissions.filter((c) => c.status === "paid").length;
  const total = commissions.reduce((s, c) => s + Number(c.commission_amount), 0);

  const items = [
    { label: "Total commission (all)", value: formatCurrency(total), icon: DollarSign },
    { label: "Pending approval", value: String(pending), icon: Clock },
    { label: "Paid records", value: String(paid), icon: CheckCircle },
    { label: "Approved (awaiting pay)", value: String(approved), icon: CheckCircle },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item, i) => (
        <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="p-3 md:p-4">
            <div className="flex items-start gap-2">
              <item.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-tight">{item.label}</p>
                <p className="mt-1 font-heading text-lg font-semibold tabular-nums truncate">{item.value}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
