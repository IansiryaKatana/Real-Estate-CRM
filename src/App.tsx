import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleRoute } from "@/components/RoleRoute";
import { canAccessOpsModules, canAccessSensitiveSettings, canAccessSettingsRoute } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";
import AuthPage from "./pages/Auth.tsx";
import ResetPasswordPage from "./pages/ResetPassword.tsx";
import Index from "./pages/Index.tsx";
import Portfolios from "./pages/Portfolios.tsx";
import Properties from "./pages/Properties.tsx";
import Leads from "./pages/Leads.tsx";
import Pipeline from "./pages/Pipeline.tsx";
import Communications from "./pages/Communications.tsx";
import Catalogs from "./pages/Catalogs.tsx";
import Commissions from "./pages/Commissions.tsx";
import Analytics from "./pages/Analytics.tsx";
import Settings from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrandingProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/portfolios" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessOpsModules(r as AppRole[])}><Portfolios /></RoleRoute></ProtectedRoute>} />
            <Route path="/properties" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessOpsModules(r as AppRole[])}><Properties /></RoleRoute></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessOpsModules(r as AppRole[])}><Leads /></RoleRoute></ProtectedRoute>} />
            <Route path="/lead-engine" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessSettingsRoute(r as AppRole[])}><Navigate to="/settings?tab=lead-engine" replace /></RoleRoute></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessOpsModules(r as AppRole[])}><Pipeline /></RoleRoute></ProtectedRoute>} />
            <Route path="/communications" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessOpsModules(r as AppRole[])}><Communications /></RoleRoute></ProtectedRoute>} />
            <Route path="/catalogs" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessOpsModules(r as AppRole[])}><Catalogs /></RoleRoute></ProtectedRoute>} />
            <Route path="/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/rbac" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessSensitiveSettings(r as AppRole[])}><Navigate to="/settings?tab=access-control" replace /></RoleRoute></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessSettingsRoute(r as AppRole[])}><Settings /></RoleRoute></ProtectedRoute>} />
            <Route path="/audit-log" element={<ProtectedRoute><RoleRoute allow={(r) => canAccessSensitiveSettings(r as AppRole[])}><Navigate to="/settings?tab=audit-log" replace /></RoleRoute></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </BrandingProvider>
  </QueryClientProvider>
);

export default App;
