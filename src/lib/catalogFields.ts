/** Canonical catalog field keys — match Property Finder / `properties` columns (see `generate-catalog` edge function). */
export const CATALOG_PF_FIELDS: { id: string; label: string; hint: string }[] = [
  { id: "photos", label: "Photos", hint: "Images synced from Property Finder" },
  { id: "price_aed", label: "Price (AED)", hint: "Listing price" },
  { id: "location", label: "Location", hint: "Area / community" },
  { id: "emirate", label: "Emirate", hint: "PF UAE emirate" },
  { id: "property_type", label: "Property type", hint: "Apartment, villa, etc." },
  { id: "category", label: "Category", hint: "PF category" },
  { id: "bedrooms", label: "Bedrooms", hint: "" },
  { id: "bathrooms", label: "Bathrooms", hint: "" },
  { id: "area_sqft", label: "Area (sqft)", hint: "" },
  { id: "price_type", label: "Price type", hint: "Sale / rent period from PF" },
  { id: "furnishing", label: "Furnishing", hint: "PF furnishing type" },
  { id: "project_status", label: "Project status", hint: "" },
  { id: "available_from", label: "Available from", hint: "" },
  { id: "commission_pct", label: "Commission %", hint: "" },
  { id: "rera", label: "RERA / permit", hint: "Compliance ref from PF" },
  { id: "verification", label: "Verification", hint: "PF verification status" },
  { id: "quality_score", label: "Quality score", hint: "PF listing quality" },
  { id: "description", label: "Description", hint: "Full description text" },
  { id: "amenities", label: "Amenities", hint: "Tags from PF" },
  { id: "listing_reference", label: "Listing reference", hint: "Internal / PF ref" },
  { id: "pf_listing_meta", label: "PF listing meta", hint: "PF ID & dates" },
  { id: "portal_links", label: "Portal links", hint: "PF, Bayut, Dubizzle" },
  { id: "floor_plan", label: "Floor plan", hint: "Placeholder if not in sync" },
];

export type CatalogLayoutId = "brochure" | "photo_grid" | "compact" | "investor";

export const CATALOG_LAYOUTS: { id: CatalogLayoutId; label: string; description: string }[] = [
  { id: "brochure", label: "Brochure", description: "Balanced grid, optional hero photos" },
  { id: "photo_grid", label: "Photo grid", description: "Large lead image + gallery" },
  { id: "compact", label: "Compact", description: "Dense 3-column facts" },
  { id: "investor", label: "Investor", description: "Emphasis on numbers & compliance" },
];

export type CatalogPreset = {
  id: string;
  name: string;
  template_type: string;
  layout: CatalogLayoutId;
  fieldKeys: string[];
};

export const CATALOG_PRESETS: CatalogPreset[] = [
  {
    id: "pf-full",
    name: "PF full listing",
    template_type: "buyer",
    layout: "photo_grid",
    fieldKeys: [
      "photos",
      "price_aed",
      "location",
      "emirate",
      "property_type",
      "category",
      "bedrooms",
      "bathrooms",
      "area_sqft",
      "price_type",
      "furnishing",
      "description",
      "amenities",
      "rera",
      "verification",
      "quality_score",
      "portal_links",
      "listing_reference",
    ],
  },
  {
    id: "pf-quick",
    name: "PF quick sheet",
    template_type: "buyer",
    layout: "compact",
    fieldKeys: ["photos", "price_aed", "location", "bedrooms", "bathrooms", "area_sqft", "portal_links"],
  },
  {
    id: "pf-investor",
    name: "Investor due diligence",
    template_type: "investor",
    layout: "investor",
    fieldKeys: [
      "photos",
      "price_aed",
      "emirate",
      "property_type",
      "area_sqft",
      "commission_pct",
      "rera",
      "verification",
      "quality_score",
      "price_type",
      "description",
    ],
  },
  {
    id: "pf-compliance",
    name: "Compliance & portals",
    template_type: "custom",
    layout: "brochure",
    fieldKeys: ["listing_reference", "rera", "verification", "emirate", "location", "portal_links", "pf_listing_meta"],
  },
  {
    id: "pf-photos-first",
    name: "Photos + essentials",
    template_type: "buyer",
    layout: "brochure",
    fieldKeys: ["photos", "price_aed", "location", "property_type", "bedrooms", "bathrooms", "area_sqft", "description"],
  },
];

/** Parse saved template `fields` json — supports legacy string[] or { fieldKeys, layout }. */
export function parseTemplateFields(raw: unknown): { fieldKeys: string[]; layout: CatalogLayoutId } {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "fieldKeys" in raw) {
    const o = raw as { fieldKeys?: unknown; layout?: unknown };
    const keys = Array.isArray(o.fieldKeys) ? (o.fieldKeys as string[]) : [];
    const layout = (typeof o.layout === "string" ? o.layout : "brochure") as CatalogLayoutId;
    return { fieldKeys: keys, layout: CATALOG_LAYOUTS.some((l) => l.id === layout) ? layout : "brochure" };
  }
  if (Array.isArray(raw)) {
    return { fieldKeys: raw as string[], layout: "brochure" };
  }
  return { fieldKeys: [], layout: "brochure" };
}

export function serializeTemplateFields(fieldKeys: string[], layout: CatalogLayoutId): Record<string, unknown> {
  return { fieldKeys, layout };
}
