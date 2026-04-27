import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * Prefer Supabase project secret (Deno.env), else value from integration_secrets (service role).
 */
export async function resolveSecret(
  admin: SupabaseClient,
  slug: string,
  envVar: string,
): Promise<string | undefined> {
  const env = Deno.env.get(envVar)?.trim();
  if (env) return env;
  const { data, error } = await admin
    .from("integration_secrets")
    .select("value")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("resolveSecret", slug, error.message);
    return undefined;
  }
  const v = typeof data?.value === "string" ? data.value.trim() : "";
  return v || undefined;
}
