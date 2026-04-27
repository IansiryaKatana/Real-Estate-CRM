import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface KPICardProps {
  title: string;
  value: string;
  /** Month-over-month or period change (%). Omitted when not computed from live data. */
  change?: number;
  icon: LucideIcon;
  variant?: "default" | "primary";
}

export function KPICard({ title, value, change, icon: Icon, variant = "default" }: KPICardProps) {
  const showTrend = change !== undefined && change !== null && !Number.isNaN(change);
  const isPositive = showTrend && change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "rounded-xl border p-4 md:p-5 transition-shadow hover:shadow-md",
        variant === "primary"
          ? "border-primary/20 bg-primary text-primary-foreground"
          : "border-border bg-card text-card-foreground"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs md:text-sm font-medium truncate", variant === "primary" ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {title}
          </p>
          <p className="mt-1 md:mt-2 font-heading text-xl md:text-3xl font-bold truncate">{value}</p>
        </div>
        <div className={cn("flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg shrink-0 ml-2", variant === "primary" ? "bg-primary-foreground/20" : "bg-accent")}>
          <Icon className={cn("h-4 w-4 md:h-5 md:w-5", variant === "primary" ? "text-primary-foreground" : "text-accent-foreground")} />
        </div>
      </div>
      {showTrend && (
        <div className="mt-2 md:mt-3 flex items-center gap-1">
          {isPositive ? <TrendingUp className="h-3 w-3 text-success shrink-0" /> : <TrendingDown className="h-3 w-3 text-destructive shrink-0" />}
          <span className={cn("text-[11px] md:text-xs font-semibold", isPositive ? "text-success" : "text-destructive")}>
            {isPositive ? "+" : ""}{change}%
          </span>
          <span className={cn("text-[11px] md:text-xs hidden sm:inline", variant === "primary" ? "text-primary-foreground/60" : "text-muted-foreground")}>
            vs prior month
          </span>
        </div>
      )}
    </motion.div>
  );
}
