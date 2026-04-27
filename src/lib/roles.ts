import type { Enums } from "@/integrations/supabase/types";

export type AppRole = Enums<"app_role">;

/** Finance-only users (no sales/management role) — restricted from ops modules. */
export function isFinanceOnly(roles: AppRole[]): boolean {
  return roles.length > 0 && roles.every((r) => r === "finance");
}

export function isManagement(roles: AppRole[]): boolean {
  return roles.some((r) => r === "super_admin" || r === "admin" || r === "manager");
}

export function canAccessOpsModules(roles: AppRole[]): boolean {
  return !isFinanceOnly(roles);
}

/** Branding, data purge, audit, RBAC — admin & super_admin only. */
export function canAccessSensitiveSettings(roles: AppRole[]): boolean {
  return roles.some((r) => r === "super_admin" || r === "admin");
}

/** Settings home route: managers + admins (integrations, secrets, lead engine, etc.). */
export function canAccessSettingsRoute(roles: AppRole[]): boolean {
  return isManagement(roles);
}

/** @deprecated Use canAccessSensitiveSettings for admin-only tabs */
export function canAccessSettingsAdmin(roles: AppRole[]): boolean {
  return canAccessSensitiveSettings(roles);
}

/** Which Settings sub-tab the user may open. */
export function canSeeSettingsTab(tab: string, roles: AppRole[]): boolean {
  if (["secrets", "integrations", "notifications", "general", "lead-engine"].includes(tab)) {
    return isManagement(roles);
  }
  if (tab === "access-control") return roles.includes("super_admin");
  if (["branding", "data", "audit-log"].includes(tab)) return canAccessSensitiveSettings(roles);
  return false;
}
