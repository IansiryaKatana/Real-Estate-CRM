import { supabase } from "@/integrations/supabase/client";

export const BRANDING_BUCKET = "branding";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = /^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/i;

export function sanitizeLogoFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "logo";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "logo";
}

export function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/object/public/${BRANDING_BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(publicUrl.slice(i + marker.length).split("?")[0] ?? "");
}

export async function removeBrandingObjectAtUrl(publicUrl: string): Promise<void> {
  const path = storagePathFromPublicUrl(publicUrl);
  if (!path) return;
  await supabase.storage.from(BRANDING_BUCKET).remove([path]);
}

function extFromFile(file: File): string {
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "png";
}

export async function uploadBrandingLogo(file: File, brandingId: string): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be 2 MB or smaller.");
  }
  if (!ALLOWED.test(file.type)) {
    throw new Error("Use PNG, JPG, WebP, GIF, or SVG.");
  }
  const ext = extFromFile(file);
  const path = `logos/${brandingId}/${Date.now()}-${sanitizeLogoFileName(file.name)}.${ext}`;
  const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
