import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLeads, useProfiles, getLeadAgentDisplayName, buildPfAgentFullNameMap, buildProfileIdToFullNameMap, leadStatusLabels, sourceLabels, type LeadStatus, type LeadSourceType } from "@/hooks/useSupabaseData";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const statusStyles: Record<string, string> = {
  new: "bg-primary/10 text-accent-foreground border-primary/20",
  contacted: "bg-warning/10 text-warning border-warning/20",
  qualified: "bg-success/10 text-success border-success/20",
  viewing: "bg-accent text-accent-foreground border-accent-foreground/20",
  negotiation: "bg-primary/15 text-primary border-primary/30",
};

export function RecentLeads({
  title = "Recent leads",
  subtitle = "Latest incoming leads",
}: {
  title?: string;
  subtitle?: string;
}) {
  const { data: leads } = useLeads();
  const { data: profiles = [] } = useProfiles();
  const pfAgentNames = useMemo(() => buildPfAgentFullNameMap(profiles.filter((p) => p.pf_agent_id)), [profiles]);
  const profileIdToName = useMemo(() => buildProfileIdToFullNameMap(profiles), [profiles]);
  const navigate = useNavigate();
  const recentLeads = (leads ?? []).slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="mb-3 md:mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-heading text-sm md:text-base font-semibold text-card-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <button className="text-xs md:text-sm font-medium text-primary hover:underline" onClick={() => navigate("/leads")}>View all</button>
      </div>
      <div className="space-y-2 md:space-y-3">
        {recentLeads.map((lead) => {
          const agent = getLeadAgentDisplayName(lead as Record<string, unknown>, pfAgentNames, profileIdToName);
          return (
            <div key={lead.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 md:p-3 transition-colors hover:bg-muted/30 gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-accent text-accent-foreground text-[10px] font-semibold">
                    {lead.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-card-foreground truncate">{lead.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{(lead as any).properties?.title ?? "Not provided"}</p>
                  {agent !== "Unassigned" && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">Agent: {agent}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden lg:block text-xs text-muted-foreground">{sourceLabels[lead.source as LeadSourceType] ?? lead.source}</span>
                <Badge variant="outline" className={cn("text-[10px] md:text-[11px] font-medium", statusStyles[lead.status] ?? "")}>
                  {leadStatusLabels[lead.status as LeadStatus] ?? lead.status}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
