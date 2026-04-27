-- Idempotency key for notification creation (prevents duplicate rows on webhook retries/races).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS external_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_external_event_id
  ON public.notifications (external_event_id)
  WHERE external_event_id IS NOT NULL;
