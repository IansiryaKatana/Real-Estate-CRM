import { Search, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { UserMenu } from "@/components/layout/UserMenu";

export function TopBar() {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  return (
    <header className={`sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md ${isMobile ? "h-14 px-3 pl-14" : "h-14 px-6"}`}>
      <div className="min-w-0 flex-1">
        <h1 className="font-heading text-lg font-bold text-foreground truncate">Dashboard</h1>
        {!isMobile && <p className="text-xs text-muted-foreground">Welcome back, {user?.user_metadata?.full_name ?? "here's your overview"}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isMobile && (
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
            <Search className="h-4 w-4" />
          </button>
        )}
        <NotificationPanel />
        {!isMobile && (
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
            <MessageSquare className="h-4 w-4" />
          </button>
        )}
        <UserMenu />
      </div>
    </header>
  );
}
