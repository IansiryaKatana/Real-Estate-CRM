import { motion } from "framer-motion";
import { useLeads } from "@/hooks/useSupabaseData";

const stageConfig = [
  { key: "new", label: "New", color: "bg-primary" },
  { key: "contacted", label: "Contacted", color: "bg-accent-foreground" },
  { key: "qualified", label: "Qualified", color: "bg-warning" },
  { key: "viewing", label: "Viewing", color: "bg-success" },
  { key: "negotiation", label: "Negotiation", color: "bg-primary" },
  { key: "closed_won", label: "Closed Won", color: "bg-success" },
  { key: "closed_lost", label: "Closed Lost", color: "bg-destructive" },
];

export function LeadPipeline({ scope = "team" }: { scope?: "team" | "self" }) {
  const { data: leads } = useLeads();

  const stages = stageConfig.map(s => ({
    ...s,
    count: (leads ?? []).filter(l => l.status === s.key).length,
  }));

  const total = stages.reduce((a, b) => a + b.count, 0) || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <h3 className="font-heading text-base font-semibold text-card-foreground">Lead Pipeline</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {total} {scope === "self" ? "leads assigned to you" : "leads in workspace"}
      </p>

      <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-muted">
        {stages.map((stage) => (
          <div
            key={stage.label}
            className={`${stage.color} transition-all`}
            style={{ width: `${(stage.count / total) * 100}%` }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stages.filter(s => s.count > 0).map((stage) => (
          <div key={stage.label} className="rounded-lg bg-muted/50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${stage.color}`} />
              <span className="text-xs text-muted-foreground">{stage.label}</span>
            </div>
            <p className="mt-1 font-heading text-lg font-bold text-card-foreground">{stage.count}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
