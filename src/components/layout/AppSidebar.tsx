import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Home, Users, BarChart3, Mail, FileText,
  DollarSign, Settings, ChevronLeft, ChevronRight, PieChart, X, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBranding } from "@/contexts/BrandingContext";
import { useUserRoles } from "@/hooks/useSupabaseData";
import { canAccessOpsModules, canAccessSettingsRoute } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";

const navGroupsStatic = [
  { label: "Overview", items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/" }] },
  { label: "Management", items: [
    { icon: Building2, label: "Portfolios", path: "/portfolios" },
    { icon: Home, label: "Properties", path: "/properties" },
    { icon: Users, label: "Leads & Clients", path: "/leads" },
  ]},
  { label: "Operations", items: [
    { icon: BarChart3, label: "Sales Pipeline", path: "/pipeline" },
    { icon: Mail, label: "Communications", path: "/communications" },
    { icon: FileText, label: "Catalogs", path: "/catalogs" },
  ]},
  { label: "Finance", items: [
    { icon: DollarSign, label: "Commissions", path: "/commissions" },
    { icon: PieChart, label: "Analytics", path: "/analytics" },
  ]},
  { label: "System", items: [
    { icon: Settings, label: "Settings", path: "/settings" },
  ]},
];

export function AppSidebar() {
  const { systemName, logoUrl } = useBranding();
  const { data: roles = [] } = useUserRoles();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const navGroups = useMemo(() => {
    const r = roles as AppRole[];
    const ops = canAccessOpsModules(r);
    const settings = canAccessSettingsRoute(r);
    return navGroupsStatic
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => {
          if (item.path === "/settings") return settings;
          if (["/portfolios", "/properties", "/leads", "/pipeline", "/communications", "/catalogs"].includes(item.path)) return ops;
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [roles]);

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const sidebarWidth = isMobile ? "w-full" : collapsed ? "w-[72px]" : "w-[260px]";

  const sidebar = (
    <aside className={cn(
      "fixed left-0 top-0 z-50 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
      sidebarWidth,
      isMobile && !mobileOpen && "-translate-x-full",
      !isMobile && "pt-[25px]"
    )}>
      <div className="flex min-h-14 items-center gap-3 px-4 shrink-0 pb-[25px]">
        {logoUrl ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary/10 p-0.5">
            <img src={logoUrl} alt="" className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
            <Building2 className="h-5 w-5 text-sidebar-accent-foreground" />
          </div>
        )}
        {(!collapsed || isMobile) && (
          <span className="font-heading text-lg font-bold text-sidebar-primary flex-1 truncate" title={systemName}>{systemName}</span>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/70 hover:text-sidebar-accent-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3 pt-0 overscroll-contain">
        {navGroups.map((group) => (
          <div key={group.label}>
            {(!collapsed || isMobile) && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                        : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!isMobile && (
        <div className="border-t border-sidebar-border p-3 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="h-[18px] w-[18px]" /> : <><ChevronLeft className="h-[18px] w-[18px]" /><span>Collapse</span></>}
          </button>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && !mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      {/* Backdrop */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}
      {sidebar}
    </>
  );
}
