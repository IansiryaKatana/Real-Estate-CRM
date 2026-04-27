/** Shared helpers for manual property create/edit (aligned with DB + PF-style fields). */

export type PropertyFormState = {
  title: string;
  location: string;
  type: string;
  status: string;
  portfolio_id: string;
  listing_id: string;
  price: string;
  area: string;
  bedrooms: string;
  bathrooms: string;
  commission_rate: string;
  price_type: string;
  emirate: string;
  category: string;
  furnishing_type: string;
  project_status: string;
  available_from: string;
  rera_number: string;
  verification_status: string;
  quality_score: string;
  description: string;
  amenities_raw: string;
  images_raw: string;
  bayut_url: string;
  pf_url: string;
  dubizzle_url: string;
  pf_id: string;
  crm_agent_id: string;
};

export const emptyPropertyForm = (): PropertyFormState => ({
  title: "",
  location: "",
  type: "apartment",
  status: "available",
  portfolio_id: "",
  listing_id: "",
  price: "",
  area: "",
  bedrooms: "",
  bathrooms: "",
  commission_rate: "2",
  price_type: "",
  emirate: "",
  category: "",
  furnishing_type: "",
  project_status: "",
  available_from: "",
  rera_number: "",
  verification_status: "",
  quality_score: "",
  description: "",
  amenities_raw: "",
  images_raw: "",
  bayut_url: "",
  pf_url: "",
  dubizzle_url: "",
  pf_id: "",
  crm_agent_id: "",
});

export function parseListFromMultilineOrComma(raw: string): string[] {
  if (!raw.trim()) return [];
  const parts = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  return parts;
}

export function propertyRowFromForm(f: PropertyFormState, pfAssignedFromProfile: string | null) {
  const amenities = parseListFromMultilineOrComma(f.amenities_raw);
  const images = parseListFromMultilineOrComma(f.images_raw);
  const qs = f.quality_score.trim();
  const qn = qs === "" ? null : Number(qs);
  return {
    title: f.title.trim(),
    location: f.location.trim(),
    type: f.type as "apartment" | "villa" | "office" | "penthouse" | "townhouse",
    status: f.status as "available" | "reserved" | "sold" | "off_market",
    portfolio_id: f.portfolio_id || null,
    listing_id: f.listing_id.trim() || null,
    price: Number(f.price) || 0,
    area: Number(f.area) || 0,
    bedrooms: Number(f.bedrooms) || 0,
    bathrooms: Number(f.bathrooms) || 0,
    commission_rate: Number(f.commission_rate) || 2,
    price_type: f.price_type.trim() || null,
    emirate: f.emirate.trim() || null,
    category: f.category.trim() || null,
    furnishing_type: f.furnishing_type.trim() || null,
    project_status: f.project_status.trim() || null,
    available_from: f.available_from.trim() || null,
    rera_number: f.rera_number.trim() || null,
    verification_status: f.verification_status.trim() || null,
    quality_score: qn !== null && Number.isFinite(qn) ? qn : null,
    description: f.description.trim() || null,
    amenities: amenities.length ? amenities : null,
    images: images.length ? images : null,
    bayut_url: f.bayut_url.trim() || null,
    pf_url: f.pf_url.trim() || null,
    dubizzle_url: f.dubizzle_url.trim() || null,
    pf_id: f.pf_id.trim() || null,
    pf_assigned_agent_id: pfAssignedFromProfile,
  };
}
