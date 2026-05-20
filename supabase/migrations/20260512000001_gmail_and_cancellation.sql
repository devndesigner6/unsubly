-- ── Gmail import + smart cancellation schema additions ───────────────────────

-- 1. Add google_access_token to profiles (stores Google OAuth provider_token)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_access_token TEXT;

-- 2. Add source, cancelled_at, cancellation_method to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_method TEXT;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS subscriptions_source_idx
  ON public.subscriptions(source);

-- 3. New table: agent_renewal_alerts
--    Tracks pre-renewal Telegram alerts sent by the OpenClaw agent.
--    user_decision: null = waiting, 'keep' = user wants to keep, 'cancel' = user wants to cancel, 'done' = cancellation confirmed
CREATE TABLE IF NOT EXISTS public.agent_renewal_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  vault_id         UUID REFERENCES public.escrow_vaults(id) ON DELETE SET NULL,
  alert_sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_decision    TEXT CHECK (user_decision IN ('keep', 'cancel', 'done')),
  decided_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_renewal_alerts_subscription_idx
  ON public.agent_renewal_alerts(subscription_id);

CREATE INDEX IF NOT EXISTS agent_renewal_alerts_alert_sent_at_idx
  ON public.agent_renewal_alerts(alert_sent_at DESC);

-- Only one pending alert per subscription at a time
CREATE UNIQUE INDEX IF NOT EXISTS agent_renewal_alerts_pending_unique_idx
  ON public.agent_renewal_alerts(subscription_id)
  WHERE user_decision IS NULL;

ALTER TABLE public.agent_renewal_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own renewal alerts"
  ON public.agent_renewal_alerts FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages renewal alerts"
  ON public.agent_renewal_alerts FOR ALL
  USING (auth.role() = 'service_role');

-- Done
NOTIFY pgrst, 'reload schema';
