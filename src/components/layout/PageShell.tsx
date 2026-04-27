import { ReactNode } from "react";
import { Info } from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const infoTriggerClass = cn(
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
  "text-muted-foreground hover:text-foreground hover:bg-muted",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

function PageSubtitleHelp({ subtitle, isMobile }: { subtitle: string; isMobile: boolean }) {
  const trigger = (
    <button type="button" className={infoTriggerClass} aria-label="About this page">
      <Info className="h-4 w-4" aria-hidden />
    </button>
  );

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="z-50 w-auto max-w-[min(90vw,20rem)] p-3 text-sm text-popover-foreground">
          {subtitle}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-xs text-sm">
        {subtitle}
      </TooltipContent>
    </Tooltip>
  );
}

export function PageShell({ children, title, subtitle, actions }: PageShellProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className={`flex-1 transition-all duration-300 min-w-0 ${isMobile ? "ml-0" : "ml-[260px] pt-[25px]"}`}>
        <header className={`sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md ${isMobile ? "h-14 px-3 pl-16" : "h-14 px-6"}`}>
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <h1 className="font-heading min-w-0 flex-1 text-lg font-bold text-foreground truncate">{title}</h1>
            {subtitle ? <PageSubtitleHelp subtitle={subtitle} isMobile={isMobile} /> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {actions}
            <NotificationPanel />
            <UserMenu />
          </div>
        </header>
        <div className={`${isMobile ? "p-3" : "p-6"} overflow-x-hidden`}>{children}</div>
      </main>
    </div>
  );
}
