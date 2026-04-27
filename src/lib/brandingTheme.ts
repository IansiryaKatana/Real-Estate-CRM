/** Convert #rrggbb to HSL components for Tailwind `hsl(var(--primary))` style variables. */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

/** Tailwind/shadcn format: "H S% L%" without hsl() wrapper */
export function hslCssTriplet(h: number, s: number, l: number): string {
  return `${Math.round(h)} ${Math.max(0, Math.min(100, Math.round(s)))}% ${Math.max(0, Math.min(100, Math.round(l)))}%`;
}

const DEFAULT_PRIMARY = "#1a5c3a";
const DEFAULT_ACCENT = "#e5a100";

export function applyBrandingCssVars(
  root: HTMLElement,
  primaryHex: string,
  accentHex: string,
  secondaryHex?: string | null,
): void {
  const p = hexToHsl(primaryHex) ?? hexToHsl(DEFAULT_PRIMARY)!;
  const a = hexToHsl(accentHex) ?? hexToHsl(DEFAULT_ACCENT)!;

  const primaryFg = p.l > 52 ? "160 10% 12%" : "0 0% 100%";
  root.style.setProperty("--primary", hslCssTriplet(p.h, p.s, p.l));
  root.style.setProperty("--primary-foreground", primaryFg);
  root.style.setProperty("--ring", hslCssTriplet(p.h, p.s, p.l));

  // Sidebar follows primary brand (matches previous static theme intent)
  root.style.setProperty("--sidebar-background", hslCssTriplet(p.h, p.s, p.l));
  root.style.setProperty("--sidebar-foreground", `${Math.round(p.h)} 20% 92%`);
  root.style.setProperty("--sidebar-primary", "0 0% 100%");
  root.style.setProperty("--sidebar-primary-foreground", hslCssTriplet(p.h, p.s, p.l));
  root.style.setProperty("--sidebar-accent", hslCssTriplet(p.h, Math.max(p.s - 10, 35), Math.min(p.l + 8, 34)));
  root.style.setProperty("--sidebar-accent-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-border", `${Math.round(p.h)} 40% 28%`);
  root.style.setProperty("--sidebar-ring", `${Math.round(p.h)} 64% 40%`);
  root.style.setProperty("--sidebar-muted", `${Math.round(p.h)} 30% 55%`);

  // Accent color: soft surface + readable foreground
  root.style.setProperty("--accent", hslCssTriplet(a.h, Math.min(a.s + 10, 90), 94));
  root.style.setProperty("--accent-foreground", hslCssTriplet(a.h, Math.max(a.s, 45), 22));

  // Optional secondary influences muted / secondary surfaces
  if (secondaryHex) {
    const sec = hexToHsl(secondaryHex);
    if (sec) {
      root.style.setProperty("--secondary", hslCssTriplet(sec.h, 15, 94));
      root.style.setProperty("--secondary-foreground", hslCssTriplet(sec.h, sec.s * 0.4, 18));
    }
  } else {
    root.style.removeProperty("--secondary");
    root.style.removeProperty("--secondary-foreground");
  }
}

function cssFontStack(googleFamilyName: string): string {
  const s = googleFamilyName.replace(/\\/g, "").replace(/"/g, '\\"');
  return `"${s}", ui-sans-serif, system-ui, sans-serif`;
}

/** Apply heading/body font stacks from full Google Font family names. */
export function applyBrandingFonts(root: HTMLElement, headingFont: string, bodyFont: string): void {
  root.style.setProperty("--font-heading", cssFontStack(headingFont));
  root.style.setProperty("--font-body", cssFontStack(bodyFont));
}
