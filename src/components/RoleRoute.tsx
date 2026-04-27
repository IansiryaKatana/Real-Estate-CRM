import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRoles } from "@/hooks/useSupabaseData";
import type { AppRole } from "@/lib/roles";

export function RoleRoute({
  allow,
  children,
  redirectTo = "/",
}: {
  allow: (roles: AppRole[]) => boolean;
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { data: roles = [], isLoading } = useUserRoles();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="space-y-3 w-full max-w-md">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!allow(roles as AppRole[])) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
