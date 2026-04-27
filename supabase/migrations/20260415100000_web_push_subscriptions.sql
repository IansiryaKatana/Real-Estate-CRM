-- Web push subscriptions per browser/device for closed-tab notifications.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile_active
  ON public.push_subscriptions(profile_id, is_active, updated_at DESC);

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select_scoped"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.can_manage_team_data()
  );

CREATE POLICY "push_subscriptions_insert_scoped"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (profile_id = public.current_profile_id());

CREATE POLICY "push_subscriptions_update_scoped"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (profile_id = public.current_profile_id() OR public.can_manage_team_data());

CREATE POLICY "push_subscriptions_delete_scoped"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (profile_id = public.current_profile_id() OR public.can_manage_team_data());
