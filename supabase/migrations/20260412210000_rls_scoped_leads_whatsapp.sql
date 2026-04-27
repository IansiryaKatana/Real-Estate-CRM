-- Role-scoped RLS for leads/deals/communications + WhatsApp (single business number) message store.
-- Helpers (invoker): map auth user → profile and detect management roles.

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team_data()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
$$;

-- Per-row visibility using assigned_agent_id from the row being checked (not a bare table reference).
CREATE OR REPLACE FUNCTION public.lead_assigned_row_is_visible(p_assigned_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.can_manage_team_data()
      OR (
        public.has_role(auth.uid(), 'salesperson'::public.app_role)
        AND (
          p_assigned_agent_id = public.current_profile_id()
          OR p_assigned_agent_id IS NULL
        )
      )
$$;

CREATE OR REPLACE FUNCTION public.deal_assigned_row_is_visible(p_assigned_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.can_manage_team_data()
      OR (
        public.has_role(auth.uid(), 'salesperson'::public.app_role)
        AND (
          p_assigned_agent_id = public.current_profile_id()
          OR p_assigned_agent_id IS NULL
        )
      )
$$;

CREATE OR REPLACE FUNCTION public.can_access_commission_row(p_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.can_manage_team_data()
      OR public.has_role(auth.uid(), 'finance'::public.app_role)
      OR p_agent_id = public.current_profile_id()
$$;

-- ---------- WhatsApp ----------
CREATE TYPE public.whatsapp_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  direction public.whatsapp_direction NOT NULL,
  body text NOT NULL DEFAULT '',
  wa_message_id text UNIQUE,
  contact_wa_id text,
  sent_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider_status text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_lead_created ON public.whatsapp_messages(lead_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_contact ON public.whatsapp_messages(contact_wa_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- ---------- Drop old permissive policies ----------
DROP POLICY IF EXISTS "Read leads" ON public.leads;
DROP POLICY IF EXISTS "Auth insert leads" ON public.leads;
DROP POLICY IF EXISTS "Auth update leads" ON public.leads;
DROP POLICY IF EXISTS "Auth delete leads" ON public.leads;

DROP POLICY IF EXISTS "Read lead_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Auth insert lead_activities" ON public.lead_activities;

DROP POLICY IF EXISTS "Read deals" ON public.deals;
DROP POLICY IF EXISTS "Auth insert deals" ON public.deals;
DROP POLICY IF EXISTS "Auth update deals" ON public.deals;
DROP POLICY IF EXISTS "Auth delete deals" ON public.deals;

DROP POLICY IF EXISTS "Read commissions" ON public.commissions;
DROP POLICY IF EXISTS "Auth insert commissions" ON public.commissions;
DROP POLICY IF EXISTS "Auth update commissions" ON public.commissions;

DROP POLICY IF EXISTS "Read email_threads" ON public.email_threads;
DROP POLICY IF EXISTS "Auth insert email_threads" ON public.email_threads;
DROP POLICY IF EXISTS "Auth update email_threads" ON public.email_threads;

DROP POLICY IF EXISTS "Read email_messages" ON public.email_messages;
DROP POLICY IF EXISTS "Auth insert email_messages" ON public.email_messages;

DROP POLICY IF EXISTS "Read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Auth insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Auth update notifications" ON public.notifications;

-- ---------- Leads ----------
CREATE POLICY "leads_select_scoped" ON public.leads FOR SELECT TO authenticated
  USING (public.lead_assigned_row_is_visible(assigned_agent_id));

CREATE POLICY "leads_insert_scoped" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_team_data()
    OR (
      public.has_role(auth.uid(), 'salesperson'::public.app_role)
      AND (
        assigned_agent_id IS NULL
        OR assigned_agent_id = public.current_profile_id()
      )
    )
  );

CREATE POLICY "leads_update_scoped" ON public.leads FOR UPDATE TO authenticated
  USING (public.lead_assigned_row_is_visible(assigned_agent_id))
  WITH CHECK (
    public.can_manage_team_data()
    OR (
      public.has_role(auth.uid(), 'salesperson'::public.app_role)
      AND (
        assigned_agent_id IS NULL
        OR assigned_agent_id = public.current_profile_id()
      )
    )
  );

CREATE POLICY "leads_delete_scoped" ON public.leads FOR DELETE TO authenticated
  USING (
    public.can_manage_team_data()
    OR (
      public.has_role(auth.uid(), 'salesperson'::public.app_role)
      AND assigned_agent_id = public.current_profile_id()
    )
  );

-- ---------- Lead activities ----------
CREATE POLICY "lead_activities_select_scoped" ON public.lead_activities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_activities.lead_id
        AND (
          public.can_manage_team_data()
          OR (
            public.has_role(auth.uid(), 'salesperson'::public.app_role)
            AND (
              l.assigned_agent_id = public.current_profile_id()
              OR l.assigned_agent_id IS NULL
            )
          )
        )
    )
  );

CREATE POLICY "lead_activities_insert_scoped" ON public.lead_activities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_activities.lead_id
        AND (
          public.can_manage_team_data()
          OR (
            public.has_role(auth.uid(), 'salesperson'::public.app_role)
            AND (
              l.assigned_agent_id = public.current_profile_id()
              OR l.assigned_agent_id IS NULL
            )
          )
        )
    )
  );

-- ---------- Deals ----------
CREATE POLICY "deals_select_scoped" ON public.deals FOR SELECT TO authenticated
  USING (public.deal_assigned_row_is_visible(assigned_agent_id));

CREATE POLICY "deals_insert_scoped" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_team_data()
    OR (
      public.has_role(auth.uid(), 'salesperson'::public.app_role)
      AND (
        assigned_agent_id IS NULL
        OR assigned_agent_id = public.current_profile_id()
      )
    )
  );

CREATE POLICY "deals_update_scoped" ON public.deals FOR UPDATE TO authenticated
  USING (public.deal_assigned_row_is_visible(assigned_agent_id))
  WITH CHECK (
    public.can_manage_team_data()
    OR (
      public.has_role(auth.uid(), 'salesperson'::public.app_role)
      AND (
        assigned_agent_id IS NULL
        OR assigned_agent_id = public.current_profile_id()
      )
    )
  );

CREATE POLICY "deals_delete_scoped" ON public.deals FOR DELETE TO authenticated
  USING (
    public.can_manage_team_data()
    OR (
      public.has_role(auth.uid(), 'salesperson'::public.app_role)
      AND assigned_agent_id = public.current_profile_id()
    )
  );

-- ---------- Commissions ----------
CREATE POLICY "commissions_select_scoped" ON public.commissions FOR SELECT TO authenticated
  USING (public.can_access_commission_row(agent_id));

CREATE POLICY "commissions_insert_scoped" ON public.commissions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_commission_row(agent_id));

CREATE POLICY "commissions_update_scoped" ON public.commissions FOR UPDATE TO authenticated
  USING (public.can_access_commission_row(agent_id))
  WITH CHECK (public.can_access_commission_row(agent_id));

-- ---------- Email threads / messages (via lead) ----------
CREATE POLICY "email_threads_select_scoped" ON public.email_threads FOR SELECT TO authenticated
  USING (
    (lead_id IS NULL AND public.can_manage_team_data())
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = email_threads.lead_id
        AND (
          public.can_manage_team_data()
          OR (
            public.has_role(auth.uid(), 'salesperson'::public.app_role)
            AND (
              l.assigned_agent_id = public.current_profile_id()
              OR l.assigned_agent_id IS NULL
            )
          )
        )
    )
  );

CREATE POLICY "email_threads_insert_scoped" ON public.email_threads FOR INSERT TO authenticated
  WITH CHECK (
    (lead_id IS NULL AND public.can_manage_team_data())
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = email_threads.lead_id
        AND (
          public.can_manage_team_data()
          OR (
            public.has_role(auth.uid(), 'salesperson'::public.app_role)
            AND (
              l.assigned_agent_id = public.current_profile_id()
              OR l.assigned_agent_id IS NULL
            )
          )
        )
    )
  );

CREATE POLICY "email_threads_update_scoped" ON public.email_threads FOR UPDATE TO authenticated
  USING (
    (lead_id IS NULL AND public.can_manage_team_data())
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = email_threads.lead_id
        AND (
          public.can_manage_team_data()
          OR (
            public.has_role(auth.uid(), 'salesperson'::public.app_role)
            AND (
              l.assigned_agent_id = public.current_profile_id()
              OR l.assigned_agent_id IS NULL
            )
          )
        )
    )
  );

CREATE POLICY "email_messages_select_scoped" ON public.email_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      LEFT JOIN public.leads l ON l.id = t.lead_id
      WHERE t.id = email_messages.thread_id
        AND (
          (t.lead_id IS NULL AND public.can_manage_team_data())
          OR (
            l.id IS NOT NULL
            AND (
              public.can_manage_team_data()
              OR (
                public.has_role(auth.uid(), 'salesperson'::public.app_role)
                AND (
                  l.assigned_agent_id = public.current_profile_id()
                  OR l.assigned_agent_id IS NULL
                )
              )
            )
          )
        )
    )
  );

CREATE POLICY "email_messages_insert_scoped" ON public.email_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      LEFT JOIN public.leads l ON l.id = t.lead_id
      WHERE t.id = email_messages.thread_id
        AND (
          (t.lead_id IS NULL AND public.can_manage_team_data())
          OR (
            l.id IS NOT NULL
            AND (
              public.can_manage_team_data()
              OR (
                public.has_role(auth.uid(), 'salesperson'::public.app_role)
                AND (
                  l.assigned_agent_id = public.current_profile_id()
                  OR l.assigned_agent_id IS NULL
                )
              )
            )
          )
        )
    )
  );

-- ---------- Notifications (profile-scoped) ----------
CREATE POLICY "notifications_select_scoped" ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = public.current_profile_id()
    OR public.can_manage_team_data()
  );

CREATE POLICY "notifications_insert_scoped" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.current_profile_id()
    OR public.can_manage_team_data()
  );

CREATE POLICY "notifications_update_scoped" ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = public.current_profile_id()
    OR public.can_manage_team_data()
  );

-- ---------- WhatsApp messages ----------
CREATE POLICY "whatsapp_messages_select_scoped" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (
    (lead_id IS NULL AND public.can_manage_team_data())
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = whatsapp_messages.lead_id
        AND (
          public.can_manage_team_data()
          OR (
            public.has_role(auth.uid(), 'salesperson'::public.app_role)
            AND (
              l.assigned_agent_id = public.current_profile_id()
              OR l.assigned_agent_id IS NULL
            )
          )
        )
    )
  );

-- Rows are written only by Edge Functions (service role). No direct client insert/update.
