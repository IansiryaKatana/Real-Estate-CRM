export type LeadFormState = {
  name: string;
  email: string;
  phone: string;
  budget: string;
  source: string;
  notes: string;
  status: string;
  client_type: string;
  property_id: string;
  assigned_agent_id: string;
  score: string;
  channel: string;
  pf_lead_id: string;
  pf_listing_ref: string;
  pf_response_link: string;
  pf_status: string;
};

export function emptyLeadForm(): LeadFormState {
  return {
  name: "",
  email: "",
  phone: "",
  budget: "",
  source: "website",
  notes: "",
  status: "new",
  client_type: "prospect",
  property_id: "",
  assigned_agent_id: "",
  score: "",
  channel: "",
  pf_lead_id: "",
  pf_listing_ref: "",
  pf_response_link: "",
  pf_status: "",
  };
}
