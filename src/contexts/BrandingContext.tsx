import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useBrandingSettings, type BrandingSetting } from "@/hooks/useSupabaseData";
import { applyBrandingCssVars, applyBrandingFonts } from "@/lib/brandingTheme";
import {
  buildGoogleFontsHref,
  DEFAULT_BODY_FONT,
  DEFAULT_HEADING_FONT,
  resolveBodyFontFromDb,
  resolveHeadingFontFromDb,
} from "@/lib/googleFontUtils";

const DEFAULT_PRIMARY = "#1a5c3a";
const DEFAULT_ACCENT = "#e5a100";
export const DEFAULT_SYSTEM_NAME = "PropFlow CRM";

const FONT_LINK_ID = "branding-google-fonts";

type BrandingContextValue = {
  branding: BrandingSetting | null | undefined;
  isLoading: boolean;
  systemName: string;
  contactPhone: string;
  contactEmail: string;
  websiteUrl: string;
  logoUrl: string;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data: branding, isLoading } = useBrandingSettings();

  useEffect(() => {
    const root = document.documentElement;
    const heading = resolveHeadingFontFromDb(branding?.font_heading);
    const body = resolveBodyFontFromDb(branding?.font_body);

    if (!branding) {
      applyBrandingCssVars(root, DEFAULT_PRIMARY, DEFAULT_ACCENT, null);
      applyBrandingFonts(root, DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT);
      document.title = DEFAULT_SYSTEM_NAME;
    } else {
      applyBrandingCssVars(
        root,
        branding.primary_color ?? DEFAULT_PRIMARY,
        branding.accent_color ?? DEFAULT_ACCENT,
        branding.secondary_color,
      );
      applyBrandingFonts(root, heading, body);
      const title = (branding.system_name?.trim() || DEFAULT_SYSTEM_NAME).slice(0, 80);
      document.title = title;
    }

    let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = buildGoogleFontsHref(heading, body);
  }, [branding]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      branding,
      isLoading,
      systemName: branding?.system_name?.trim() || DEFAULT_SYSTEM_NAME,
      contactPhone: branding?.contact_phone?.trim() ?? "",
      contactEmail: branding?.contact_email?.trim() ?? "",
      websiteUrl: branding?.website_url?.trim() ?? "",
      logoUrl: branding?.logo_url?.trim() ?? "",
    }),
    [branding, isLoading],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: undefined,
      isLoading: false,
      systemName: DEFAULT_SYSTEM_NAME,
      contactPhone: "",
      contactEmail: "",
      websiteUrl: "",
      logoUrl: "",
    };
  }
  return ctx;
}
