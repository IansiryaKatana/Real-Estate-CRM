import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding, DEFAULT_SYSTEM_NAME } from "@/contexts/BrandingContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthPage() {
  const { systemName, contactPhone, contactEmail, logoUrl } = useBranding();
  const displayName = systemName || DEFAULT_SYSTEM_NAME;
  const markLetter = displayName.trim().charAt(0).toUpperCase() || "P";
  const { session, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");

  if (authLoading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success("Check your email for a password reset link");
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Welcome back!");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
      });
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Check your email to verify your account");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 md:p-8">
        <div className="mb-6 flex flex-col items-center">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="mb-3 max-h-16 w-auto max-w-[220px] object-contain" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-3" aria-hidden>
              <span className="font-heading text-2xl font-bold leading-none text-primary-foreground">{markLetter}</span>
            </div>
          )}
          <h1 className="font-heading text-2xl font-bold text-foreground text-center">{displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isForgot ? "Reset your password" : isLogin ? "Sign in to your account" : "Create your account"}
          </p>
          {(contactPhone || contactEmail) && (
            <p className="text-xs text-muted-foreground mt-3 text-center max-w-sm">
              {[contactPhone, contactEmail].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {isForgot ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
            <div className="text-center">
              <button type="button" onClick={() => setIsForgot(false)} className="text-sm text-primary hover:underline">
                Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label>Full Name</Label>
                  <Input placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1" />
                </div>
              )}
              <div>
                <Label>Email</Label>
                <Input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="auth-password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {isLogin && (
                <div className="text-right">
                  <button type="button" onClick={() => setIsForgot(true)} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline">
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
