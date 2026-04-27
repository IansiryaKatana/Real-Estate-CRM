import { GOOGLE_FONT_FAMILIES, GOOGLE_FONT_FAMILY_SET } from "@/data/googleFonts";

export const DEFAULT_HEADING_FONT = "Plus Jakarta Sans";
export const DEFAULT_BODY_FONT = "DM Sans";

/** Legacy short keys from older Settings UI */
const LEGACY_HEADING: Record<string, string> = {
  jakarta: DEFAULT_HEADING_FONT,
  inter: "Inter",
  poppins: "Poppins",
};

const LEGACY_BODY: Record<string, string> = {
  dm: DEFAULT_BODY_FONT,
  inter: "Inter",
  roboto: "Roboto",
};

function normalizeGoogleFontName(raw: string, fallback: string, legacy: Record<string, string>): string {
  const t = raw.trim();
  if (!t) return fallback;
  if (legacy[t]) return legacy[t];
  if (GOOGLE_FONT_FAMILY_SET.has(t)) return t;
  const ci = GOOGLE_FONT_FAMILIES.find((f) => f.toLowerCase() === t.toLowerCase());
  if (ci) return ci;
  // Allow any reasonable family name (e.g. newer Google fonts) to pass through for CSS.
  if (/^[a-zA-Z0-9\s&.,'’\-]+$/.test(t) && t.length >= 2 && t.length <= 120) return t;
  return fallback;
}

export function resolveHeadingFontFromDb(raw: string | null | undefined): string {
  return normalizeGoogleFontName(raw ?? "", DEFAULT_HEADING_FONT, LEGACY_HEADING);
}

export function resolveBodyFontFromDb(raw: string | null | undefined): string {
  return normalizeGoogleFontName(raw ?? "", DEFAULT_BODY_FONT, LEGACY_BODY);
}

/** Build Google Fonts CSS2 URL for up to two families (weights 400–700). */
export function buildGoogleFontsHref(headingFamily: string, bodyFamily: string): string {
  const enc = (name: string) => encodeURIComponent(name).replace(/%20/g, "+");
  const w = ":wght@400;500;600;700";
  if (headingFamily === bodyFamily) {
    return `https://fonts.googleapis.com/css2?family=${enc(headingFamily)}${w}&display=swap`;
  }
  return `https://fonts.googleapis.com/css2?family=${enc(headingFamily)}${w}&family=${enc(bodyFamily)}${w}&display=swap`;
}
