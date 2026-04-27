/**
 * Catalog HTML / PDF / DOCX builders — shared layout: top facts → hero image → 2-col gallery → remaining fields.
 * Font: Inter Tight (HTML via Google Fonts; DOCX font name; PDF embeds Inter Tight VF from google/fonts or Helvetica fallback).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "https://esm.sh/pdf-lib@1.17.1";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "https://esm.sh/docx@8.5.0";

const TOP_FIELD_COUNT = 4;
const INTER_TIGHT_VF_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/intertight/InterTight%5Bwght%5D.ttf";

export function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatAed(v: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 0,
  }).format(v);
}

const LEGACY_FIELD_MAP: Record<string, string> = {
  Price: "price_aed",
  Location: "location",
  Type: "property_type",
  Bedrooms: "bedrooms",
  Bathrooms: "bathrooms",
  Area: "area_sqft",
  Features: "description",
  Images: "photos",
  Commission: "commission_pct",
  "Platform Links": "portal_links",
  ROI: "quality_score",
  "Floor Plan": "floor_plan",
};

export function normalizeFieldKey(f: string): string {
  return LEGACY_FIELD_MAP[f] ?? f;
}

/** Preserve order, dedupe. Accepts string[] or saved-template shape `{ fieldKeys, layout }`. */
export function normalizeFieldKeysOrdered(raw: unknown): string[] {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "fieldKeys" in raw) {
    const fk = (raw as { fieldKeys?: unknown }).fieldKeys;
    return normalizeFieldKeysOrdered(fk);
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const k = normalizeFieldKey(String(item));
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function getListingImages(p: Record<string, unknown>): string[] {
  const arr = p.images;
  if (!Array.isArray(arr)) return [];
  return arr.filter((u) => /^https?:\/\//i.test(String(u))).map(String).slice(0, 12);
}

type FieldLine = { label: string; value: string; fullWidth?: boolean };

export function fieldLinesForKey(
  key: string,
  p: Record<string, unknown>,
  has: (k: string) => boolean,
): FieldLine[] {
  if (!has(key)) return [];
  const lines: FieldLine[] = [];
  const add = (label: string, value: string, fullWidth = false) => {
    lines.push({ label, value, fullWidth });
  };

  switch (key) {
    case "price_aed":
      add("Price", formatAed(Number(p.price ?? 0)));
      break;
    case "location":
      add("Location", String(p.location ?? ""));
      break;
    case "emirate":
      add("Emirate", String(p.emirate ?? "—"));
      break;
    case "property_type":
      add("Type", String(String(p.type ?? "").replace(/_/g, " ")));
      break;
    case "category":
      add("Category", String(p.category ?? "—"));
      break;
    case "bedrooms":
      add("Bedrooms", String(p.bedrooms ?? "—"));
      break;
    case "bathrooms":
      add("Bathrooms", String(p.bathrooms ?? "—"));
      break;
    case "area_sqft":
      add("Area", `${String(p.area ?? "—")} sqft`);
      break;
    case "price_type":
      add("Price type", String(p.price_type ?? "—"));
      break;
    case "furnishing":
      add("Furnishing", String(p.furnishing_type ?? "—"));
      break;
    case "project_status":
      add("Project status", String(p.project_status ?? "—"));
      break;
    case "available_from":
      add("Available from", String(p.available_from ?? "—"));
      break;
    case "commission_pct":
      add("Commission", `${String(p.commission_rate ?? "—")}%`);
      break;
    case "rera":
      add("RERA / permit", String(p.rera_number ?? "—"));
      break;
    case "verification":
      add("Verification", String(p.verification_status ?? "—"));
      break;
    case "quality_score":
      add("Quality score", String(p.quality_score ?? "—"));
      break;
    case "description":
      if (p.description) {
        lines.push({ label: "Description", value: String(p.description), fullWidth: true });
      }
      break;
    case "amenities":
      if (Array.isArray(p.amenities) && (p.amenities as string[]).length) {
        lines.push({
          label: "Amenities",
          value: (p.amenities as string[]).join(", "),
          fullWidth: true,
        });
      }
      break;
    case "listing_reference": {
      const ref = p.listing_id ?? p.pf_id ?? "";
      add("Listing reference", ref ? String(ref) : "—");
      break;
    }
    case "pf_listing_meta":
      lines.push({ label: "PF listing ID", value: String(p.pf_id ?? "—") });
      if (p.pf_created_at) {
        lines.push({ label: "Listed on PF", value: String(p.pf_created_at).slice(0, 10) });
      }
      break;
    case "portal_links": {
      const parts: string[] = [];
      if (p.pf_url) parts.push(`Property Finder: ${p.pf_url}`);
      if (p.bayut_url) parts.push(`Bayut: ${p.bayut_url}`);
      if (p.dubizzle_url) parts.push(`Dubizzle: ${p.dubizzle_url}`);
      if (parts.length) {
        lines.push({ label: "Portals", value: parts.join(" · "), fullWidth: true });
      }
      break;
    }
    case "floor_plan":
      lines.push({
        label: "Floor plan",
        value: "Not stored in sync — attach manually if needed",
        fullWidth: true,
      });
      break;
    default:
      break;
  }
  return lines;
}

function splitKeys(fieldKeysOrdered: string[]): { top: string[]; bottom: string[]; wantsPhotos: boolean } {
  const wantsPhotos = fieldKeysOrdered.includes("photos");
  const nonPhoto = fieldKeysOrdered.filter((k) => k !== "photos");
  return {
    top: nonPhoto.slice(0, TOP_FIELD_COUNT),
    bottom: nonPhoto.slice(TOP_FIELD_COUNT),
    wantsPhotos,
  };
}

function amenitiesHtml(p: Record<string, unknown>, has: (k: string) => boolean): string {
  if (!has("amenities") || !Array.isArray(p.amenities) || !(p.amenities as string[]).length) return "";
  const tags = (p.amenities as string[]).map((a) => `<span class="tag">${esc(a)}</span>`).join("");
  return `<div class="field full"><span class="label">Amenities</span><div class="tags">${tags}</div></div>`;
}

function portalsHtml(p: Record<string, unknown>, has: (k: string) => boolean): string {
  if (!has("portal_links")) return "";
  const links: string[] = [];
  if (p.pf_url) links.push(`<a href="${esc(p.pf_url)}" target="_blank" rel="noopener">Property Finder</a>`);
  if (p.bayut_url) links.push(`<a href="${esc(p.bayut_url)}" target="_blank" rel="noopener">Bayut</a>`);
  if (p.dubizzle_url) links.push(`<a href="${esc(p.dubizzle_url)}" target="_blank" rel="noopener">Dubizzle</a>`);
  if (!links.length) return "";
  return `<div class="field full"><span class="label">Portals</span><span class="value links">${links.join(" · ")}</span></div>`;
}

/** Renders field keys in order, using special HTML for amenities/portals when those keys appear. */
function htmlForKeys(
  keys: string[],
  p: Record<string, unknown>,
  has: (k: string) => boolean,
  compact: boolean,
): string {
  const chunks: string[] = [];
  for (const key of keys) {
    if (key === "amenities") {
      const h = amenitiesHtml(p, has);
      if (h) chunks.push(h);
      continue;
    }
    if (key === "portal_links") {
      const h = portalsHtml(p, has);
      if (h) chunks.push(h);
      continue;
    }
    const lines = fieldLinesForKey(key, p, has);
    for (const line of lines) {
      const isDesc = key === "description" && line.fullWidth;
      const val = isDesc ? esc(line.value).replace(/\n/g, "<br/>") : esc(line.value);
      const fw = line.fullWidth ? " full" : "";
      chunks.push(
        `<div class="field${fw}"><span class="label">${esc(line.label)}</span><span class="value${line.fullWidth ? " desc" : ""}">${val}</span></div>`,
      );
    }
  }
  const cls = compact ? "fields-grid compact-grid" : "fields-grid";
  return `<div class="${cls}">${chunks.join("")}</div>`;
}

function photoBlockHtml(imgs: string[]): string {
  if (imgs.length === 0) return "";
  const hero = imgs[0];
  const rest = imgs.slice(1);
  let html = `<div class="photo-hero"><img src="${esc(hero)}" alt="" loading="lazy" /></div>`;
  for (let i = 0; i < rest.length; i += 2) {
    const a = rest[i];
    const b = rest[i + 1];
    html += `<div class="photo-row-2">`;
    html += `<div class="ph-cell"><img src="${esc(a)}" alt="" loading="lazy" /></div>`;
    if (b) html += `<div class="ph-cell"><img src="${esc(b)}" alt="" loading="lazy" /></div>`;
    else html += `<div class="ph-cell ph-empty"></div>`;
    html += `</div>`;
  }
  return `<div class="photo-block">${html}</div>`;
}

export function buildCatalogHtml(
  properties: Record<string, unknown>[],
  templateName: string,
  templateType: string,
  layout: string,
  fieldKeysOrdered: string[],
): string {
  const isInvestor = templateType === "investor";
  const layoutClass = `layout-${layout}`;
  const compact = layout === "compact";

  const has = (k: string) => fieldKeysOrdered.includes(k);

  const cards = (properties || []).map((p) => {
    const { top, bottom, wantsPhotos } = splitKeys(fieldKeysOrdered);
    const imgs = wantsPhotos ? getListingImages(p) : [];

    const topHtml = htmlForKeys(top, p, has, compact);
    const midHtml = imgs.length ? photoBlockHtml(imgs) : "";
    const botHtml = htmlForKeys(bottom, p, has, compact);

    const cardClass = layout === "compact" ? "property-card compact" : "property-card";
    return `
        <div class="${cardClass}">
          <div class="property-header">
            <h2>${esc(p.title)}</h2>
            ${p.listing_id ? `<span class="listing-id">${esc(p.listing_id)}</span>` : ""}
          </div>
          ${topHtml}
          ${midHtml}
          ${botHtml}
        </div>
      `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter Tight', system-ui, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; }
  .cover { text-align: center; margin-bottom: 48px; padding-bottom: 32px; border-bottom: 3px solid #10b981; }
  .cover h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.02em; }
  .cover p { color: #64748b; font-size: 14px; }
  .cover .badge { display: inline-block; background: #10b981; color: white; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 12px; }
  .property-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; page-break-inside: avoid; }
  .property-card.compact { padding: 16px; }
  .property-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
  .property-header h2 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
  .listing-id { font-size: 12px; color: #94a3b8; background: #f8fafc; padding: 4px 10px; border-radius: 6px; }
  .photo-block { margin: 16px 0; }
  .photo-hero { margin-bottom: 10px; border-radius: 10px; overflow: hidden; background: #f1f5f9; max-height: 360px; }
  .photo-hero img { width: 100%; height: 100%; max-height: 360px; object-fit: cover; display: block; }
  .photo-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .ph-cell { border-radius: 8px; overflow: hidden; background: #f1f5f9; aspect-ratio: 4/3; }
  .ph-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ph-empty { background: transparent; }
  .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .compact-grid { grid-template-columns: 1fr 1fr 1fr; }
  .field { display: flex; flex-direction: column; gap: 2px; }
  .field.full { grid-column: 1 / -1; }
  .field.muted .value { color: #94a3b8; font-weight: 400; font-size: 13px; }
  .field .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; }
  .field .value { font-size: 15px; font-weight: 600; }
  .field .value.desc { font-weight: 400; white-space: pre-wrap; line-height: 1.5; }
  .field .value.links a { color: #10b981; text-decoration: none; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { font-size: 12px; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  @media print { body { padding: 20px; } .property-card { break-inside: avoid; } }
</style>
</head>
<body class="${layoutClass}">
  <div class="cover">
    <h1>${esc(templateName || "Property Catalog")}</h1>
    <p>${properties?.length || 0} ${isInvestor ? "Investment opportunities" : "Properties"} · ${esc(layout)} layout · Generated ${new Date().toLocaleDateString("en-AE", { month: "long", day: "numeric", year: "numeric" })}</p>
    <span class="badge">${isInvestor ? "INVESTOR BRIEF" : esc(String(templateType || "catalog").toUpperCase())}</span>
  </div>
  ${cards}
  <div class="footer">
    <p>Confidential — Data synced from Property Finder &amp; your CRM</p>
  </div>
</body>
</html>`;
}

// --- PDF ---

function wrapLines(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!;
    const test = `${cur} ${w}`;
    if (font.widthOfTextAtSize(test, size) <= maxW) cur = test;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  lines.push(cur);
  return lines;
}

async function embedRemoteImage(pdfDoc: import("https://esm.sh/pdf-lib@1.17.1").PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    try {
      return await pdfDoc.embedPng(buf);
    } catch {
      try {
        return await pdfDoc.embedJpg(buf);
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
}

let cachedInterFontBytes: Uint8Array | null = null;
async function loadInterTightBytes(): Promise<Uint8Array | null> {
  if (cachedInterFontBytes) return cachedInterFontBytes;
  try {
    const r = await fetch(INTER_TIGHT_VF_URL);
    if (!r.ok) return null;
    cachedInterFontBytes = new Uint8Array(await r.arrayBuffer());
    return cachedInterFontBytes;
  } catch {
    return null;
  }
}

export async function buildCatalogPdf(
  properties: Record<string, unknown>[],
  templateName: string,
  templateType: string,
  layout: string,
  fieldKeysOrdered: string[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const W = 595;
  const H = 842;
  const M = 48;
  const contentW = W - 2 * M;
  let fontRegular: PDFFont;
  let fontBold: PDFFont;
  const interBytes = await loadInterTightBytes();
  try {
    if (interBytes) {
      // Variable font — omit subsetting (may fail on some runtimes; then Helvetica).
      fontRegular = await pdfDoc.embedFont(interBytes);
      fontBold = fontRegular;
    } else {
      throw new Error("no inter");
    }
  } catch {
    fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const has = (k: string) => fieldKeysOrdered.includes(k);
  const fs = 10;
  const fsH = 18;
  const fsTitle = 14;
  const lineH = 13;
  const muted = rgb(0.45, 0.5, 0.56);
  const dark = rgb(0.1, 0.1, 0.18);

  const drawCover = () => {
    const page = pdfDoc.addPage([W, H]);
    let y = H - M;
    page.drawText(templateName || "Property Catalog", { x: M, y: y - fsH, size: fsH + 6, font: fontBold, color: dark });
    y -= fsH + 28;
    const sub = `${properties.length} properties · ${templateType} · ${layout} · ${new Date().toLocaleDateString("en-AE")}`;
    page.drawText(sub, { x: M, y: y, size: fs, font: fontRegular, color: muted });
  };

  drawCover();

  for (const p of properties) {
    const { top, bottom, wantsPhotos } = splitKeys(fieldKeysOrdered);
    const imgs = wantsPhotos ? getListingImages(p) : [];
    let page = pdfDoc.addPage([W, H]);
    let y = H - M;

    const title = String(p.title ?? "Property");
    page.drawText(title, { x: M, y: y - fsTitle, size: fsTitle, font: fontBold, color: dark });
    y -= fsTitle + 10;
    if (p.listing_id) {
      page.drawText(String(p.listing_id), { x: M, y: y, size: 8, font: fontRegular, color: muted });
      y -= lineH;
    }
    y -= 6;

    const drawFieldLines = (keys: string[]) => {
      for (const key of keys) {
        const lines = fieldLinesForKey(key, p, has);
        for (const row of lines) {
          const label = `${row.label.toUpperCase()}`;
          page.drawText(label, { x: M, y: y, size: 7, font: fontBold, color: muted });
          y -= 9;
          const wrapped = wrapLines(row.value, fontRegular, fs, contentW);
          for (const ln of wrapped) {
            if (y < M + 40) {
              page = pdfDoc.addPage([W, H]);
              y = H - M;
            }
            page.drawText(ln, { x: M, y: y, size: fs, font: fontRegular, color: dark });
            y -= lineH;
          }
          y -= 4;
          if (y < M + 60) {
            page = pdfDoc.addPage([W, H]);
            y = H - M;
          }
        }
      }
    };

    drawFieldLines(top);

    if (imgs.length > 0) {
      const hero = await embedRemoteImage(pdfDoc, imgs[0]!);
      if (hero) {
        const maxW = contentW;
        const scale = Math.min(maxW / hero.width, 220 / hero.height);
        const dw = hero.width * scale;
        const dh = hero.height * scale;
        if (y - dh < M + 20) {
          page = pdfDoc.addPage([W, H]);
          y = H - M;
        }
        page.drawImage(hero, { x: M, y: y - dh, width: dw, height: dh });
        y -= dh + 12;
      }
      for (let i = 1; i < imgs.length; i += 2) {
        const a = await embedRemoteImage(pdfDoc, imgs[i]!);
        const b = i + 1 < imgs.length ? await embedRemoteImage(pdfDoc, imgs[i + 1]!) : null;
        const colW = (contentW - 8) / 2;
        let rowH = 0;
        const drawOne = (img: PDFImage | null, x: number) => {
          if (!img) return 0;
          const scale = Math.min(colW / img.width, 140 / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          page.drawImage(img, { x, y: y - dh, width: dw, height: dh });
          return dh;
        };
        if (y < M + 180) {
          page = pdfDoc.addPage([W, H]);
          y = H - M;
        }
        if (a) rowH = Math.max(rowH, drawOne(a, M));
        if (b) rowH = Math.max(rowH, drawOne(b, M + colW + 8));
        y -= rowH + 10;
      }
    }

    drawFieldLines(bottom);
  }

  return await pdfDoc.save();
}

// --- DOCX ---

async function imageBufferForDocx(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function buildCatalogDocx(
  properties: Record<string, unknown>[],
  templateName: string,
  templateType: string,
  layout: string,
  fieldKeysOrdered: string[],
): Promise<Uint8Array> {
  const has = (k: string) => fieldKeysOrdered.includes(k);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: templateName || "Property Catalog",
          bold: true,
          font: "Inter Tight",
          size: 56,
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${properties.length} properties · ${templateType} · ${layout}`,
          font: "Inter Tight",
          size: 22,
          color: "64748B",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  );

  for (const p of properties) {
    const { top, bottom, wantsPhotos } = splitKeys(fieldKeysOrdered);
    const imgs = wantsPhotos ? getListingImages(p) : [];

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 120 },
        children: [
          new TextRun({
            text: String(p.title ?? "Property"),
            bold: true,
            font: "Inter Tight",
            size: 32,
          }),
        ],
      }),
    );

    const addFieldParagraphs = (keys: string[]) => {
      for (const key of keys) {
        const lines = fieldLinesForKey(key, p, has);
        for (const row of lines) {
          children.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({ text: `${row.label}: `, bold: true, font: "Inter Tight", size: 22 }),
                new TextRun({ text: row.value, font: "Inter Tight", size: 22 }),
              ],
            }),
          );
        }
      }
    };

    addFieldParagraphs(top);

    if (imgs.length > 0) {
      const heroBuf = await imageBufferForDocx(imgs[0]!);
      if (heroBuf) {
        try {
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: heroBuf,
                  transformation: { width: 520, height: 320 },
                }),
              ],
              spacing: { after: 200 },
            }),
          );
        } catch {
          /* skip bad image */
        }
      }
      for (let i = 1; i < imgs.length; i += 2) {
        const rowCells: TableCell[] = [];
        const bufA = await imageBufferForDocx(imgs[i]!);
        const bufB = i + 1 < imgs.length ? await imageBufferForDocx(imgs[i + 1]!) : null;
        if (bufA) {
          rowCells.push(
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: bufA,
                      transformation: { width: 240, height: 180 },
                    }),
                  ],
                }),
              ],
            }),
          );
        }
        if (bufB) {
          rowCells.push(
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: bufB,
                      transformation: { width: 240, height: 180 },
                    }),
                  ],
                }),
              ],
            }),
          );
        }
        if (rowCells.length) {
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [new TableRow({ children: rowCells })],
            }),
          );
        }
      }
    }

    addFieldParagraphs(bottom);
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Inter Tight",
            size: 22,
          },
        },
      },
    },
    sections: [{ children }],
  });

  return await Packer.toBuffer(doc);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return btoa(binary);
}
