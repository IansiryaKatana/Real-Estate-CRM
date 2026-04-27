
-- ========== ENUMS ==========
CREATE TYPE public.property_type AS ENUM ('apartment', 'villa', 'office', 'penthouse', 'townhouse');
CREATE TYPE public.property_status AS ENUM ('available', 'reserved', 'sold', 'off_market');
CREATE TYPE public.portfolio_type AS ENUM ('residential', 'commercial', 'off_plan', 'mixed');
CREATE TYPE public.client_type AS ENUM ('prospect', 'active_lead', 'previous_buyer', 'investor', 'lost_lead');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'viewing', 'negotiation', 'closed_won', 'closed_lost');
CREATE TYPE public.lead_source AS ENUM ('bayut', 'property_finder', 'dubizzle', 'website', 'referral', 'walk_in');
CREATE TYPE public.commission_status AS ENUM ('pending', 'approved', 'paid');
CREATE TYPE public.activity_type AS ENUM ('call', 'email', 'whatsapp', 'note', 'viewing', 'status_change');
CREATE TYPE public.email_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'salesperson', 'finance');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  department TEXT,
  base_salary NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- ========== COMPANIES ==========
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== PORTFOLIOS ==========
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type portfolio_type NOT NULL DEFAULT 'residential',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== PROPERTIES ==========
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  type property_type NOT NULL DEFAULT 'apartment',
  price NUMERIC NOT NULL DEFAULT 0,
  bedrooms INT NOT NULL DEFAULT 0,
  bathrooms INT NOT NULL DEFAULT 0,
  area NUMERIC NOT NULL DEFAULT 0,
  status property_status NOT NULL DEFAULT 'available',
  listing_id TEXT UNIQUE,
  commission_rate NUMERIC NOT NULL DEFAULT 2,
  bayut_url TEXT,
  pf_url TEXT,
  dubizzle_url TEXT,
  images TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== PROPERTY AGENT ASSIGNMENTS ==========
CREATE TABLE public.property_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, agent_id)
);

-- ========== LEADS ==========
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  client_type client_type NOT NULL DEFAULT 'prospect',
  status lead_status NOT NULL DEFAULT 'new',
  source lead_source NOT NULL DEFAULT 'website',
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  budget TEXT,
  score INT DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  sla_deadline TIMESTAMPTZ,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== LEAD ACTIVITIES ==========
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  description TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== DEALS ==========
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  stage lead_status NOT NULL DEFAULT 'new',
  probability INT DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  expected_close DATE,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== COMMISSIONS ==========
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deal_value NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status commission_status NOT NULL DEFAULT 'pending',
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== EMAIL THREADS ==========
CREATE TABLE public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  is_unread BOOLEAN DEFAULT true,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== EMAIL MESSAGES ==========
CREATE TABLE public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  body TEXT NOT NULL,
  direction email_direction NOT NULL DEFAULT 'outbound',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== INGESTION SOURCES ==========
CREATE TABLE public.ingestion_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('api', 'email_parser', 'webhook')),
  platform TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  leads_ingested INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== ASSIGNMENT RULES ==========
CREATE TABLE public.assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  match_field TEXT NOT NULL,
  match_value TEXT NOT NULL,
  assign_to_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== AUDIT LOG ==========
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  user_name TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== DOCUMENTS ==========
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== NOTIFICATIONS ==========
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  entity_type TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== CATALOG TEMPLATES ==========
CREATE TABLE public.catalog_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'buyer',
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== BRANDING SETTINGS ==========
CREATE TABLE public.branding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '#10b981',
  secondary_color TEXT DEFAULT '#0f172a',
  accent_color TEXT DEFAULT '#f59e0b',
  font_heading TEXT DEFAULT 'Plus Jakarta Sans',
  font_body TEXT DEFAULT 'DM Sans',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== UPDATED_AT TRIGGER ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ingestion_sources_updated_at BEFORE UPDATE ON public.ingestion_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_catalog_templates_updated_at BEFORE UPDATE ON public.catalog_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branding_settings_updated_at BEFORE UPDATE ON public.branding_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== INDEXES ==========
CREATE INDEX idx_portfolios_company ON public.portfolios(company_id);
CREATE INDEX idx_properties_portfolio ON public.properties(portfolio_id);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_listing_id ON public.properties(listing_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_leads_assigned_agent ON public.leads(assigned_agent_id);
CREATE INDEX idx_leads_property ON public.leads(property_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_deals_agent ON public.deals(assigned_agent_id);
CREATE INDEX idx_commissions_agent ON public.commissions(agent_id);
CREATE INDEX idx_commissions_status ON public.commissions(status);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity, entity_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_email_threads_lead ON public.email_threads(lead_id);

-- ========== RLS ==========
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anon read profiles" ON public.profiles FOR SELECT TO anon USING (true);

-- User roles
CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Companies
CREATE POLICY "Read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Auth insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update companies" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete companies" ON public.companies FOR DELETE TO authenticated USING (true);

-- Portfolios
CREATE POLICY "Read portfolios" ON public.portfolios FOR SELECT USING (true);
CREATE POLICY "Auth insert portfolios" ON public.portfolios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update portfolios" ON public.portfolios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete portfolios" ON public.portfolios FOR DELETE TO authenticated USING (true);

-- Properties
CREATE POLICY "Read properties" ON public.properties FOR SELECT USING (true);
CREATE POLICY "Auth insert properties" ON public.properties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update properties" ON public.properties FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete properties" ON public.properties FOR DELETE TO authenticated USING (true);

-- Property agents
CREATE POLICY "Read property_agents" ON public.property_agents FOR SELECT USING (true);
CREATE POLICY "Auth insert property_agents" ON public.property_agents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete property_agents" ON public.property_agents FOR DELETE TO authenticated USING (true);

-- Leads
CREATE POLICY "Read leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Auth insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update leads" ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete leads" ON public.leads FOR DELETE TO authenticated USING (true);

-- Lead activities
CREATE POLICY "Read lead_activities" ON public.lead_activities FOR SELECT USING (true);
CREATE POLICY "Auth insert lead_activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (true);

-- Deals
CREATE POLICY "Read deals" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Auth insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update deals" ON public.deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete deals" ON public.deals FOR DELETE TO authenticated USING (true);

-- Commissions
CREATE POLICY "Read commissions" ON public.commissions FOR SELECT USING (true);
CREATE POLICY "Auth insert commissions" ON public.commissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update commissions" ON public.commissions FOR UPDATE TO authenticated USING (true);

-- Email threads & messages
CREATE POLICY "Read email_threads" ON public.email_threads FOR SELECT USING (true);
CREATE POLICY "Auth insert email_threads" ON public.email_threads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update email_threads" ON public.email_threads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Read email_messages" ON public.email_messages FOR SELECT USING (true);
CREATE POLICY "Auth insert email_messages" ON public.email_messages FOR INSERT TO authenticated WITH CHECK (true);

-- Ingestion sources & assignment rules
CREATE POLICY "Read ingestion_sources" ON public.ingestion_sources FOR SELECT USING (true);
CREATE POLICY "Auth manage ingestion_sources" ON public.ingestion_sources FOR ALL TO authenticated USING (true);
CREATE POLICY "Read assignment_rules" ON public.assignment_rules FOR SELECT USING (true);
CREATE POLICY "Auth manage assignment_rules" ON public.assignment_rules FOR ALL TO authenticated USING (true);

-- Audit log
CREATE POLICY "Read audit_log" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "Auth insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Documents
CREATE POLICY "Read documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Auth insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete documents" ON public.documents FOR DELETE TO authenticated USING (true);

-- Notifications
CREATE POLICY "Read notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Auth insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update notifications" ON public.notifications FOR UPDATE TO authenticated USING (true);

-- Catalog templates
CREATE POLICY "Read catalog_templates" ON public.catalog_templates FOR SELECT USING (true);
CREATE POLICY "Auth manage catalog_templates" ON public.catalog_templates FOR ALL TO authenticated USING (true);

-- Branding settings
CREATE POLICY "Read branding_settings" ON public.branding_settings FOR SELECT USING (true);
CREATE POLICY "Auth manage branding_settings" ON public.branding_settings FOR ALL TO authenticated USING (true);
