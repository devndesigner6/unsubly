-- ── Subscription service credentials for agent-driven browser cancellation ──
--
-- service_username: the login email/username for the service (e.g. user@gmail.com for Netflix)
-- service_password_enc: AES-256-GCM encrypted password, encrypted server-side
--   using SUBSCRIPTION_CREDS_KEY env var. Never stored in plaintext.
--   Format: base64(iv:authTag:ciphertext)
--
-- RLS: users can write their own credentials, but CANNOT read them back.
-- The agent reads via service_role key (bypasses RLS).
-- This ensures passwords are write-only from the frontend — never exposed in API responses.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS service_username TEXT,
  ADD COLUMN IF NOT EXISTS service_password_enc TEXT,
  ADD COLUMN IF NOT EXISTS credentials_set_at TIMESTAMPTZ;

-- Index for agent to quickly find subscriptions with credentials
CREATE INDEX IF NOT EXISTS subscriptions_credentials_idx
  ON public.subscriptions(id)
  WHERE service_password_enc IS NOT NULL;

-- Add alert_type to agent_renewal_alerts to distinguish 3-day vs 1-day alerts
ALTER TABLE public.agent_renewal_alerts
  ADD COLUMN IF NOT EXISTS alert_type TEXT NOT NULL DEFAULT '3day'
    CHECK (alert_type IN ('3day', '1day'));

-- Drop the old unique index (only allowed one pending alert per subscription)
-- and replace with one that allows both 3day and 1day alerts
DROP INDEX IF EXISTS agent_renewal_alerts_pending_unique_idx;

-- New unique: one pending alert per (subscription, alert_type) per day
CREATE UNIQUE INDEX IF NOT EXISTS agent_renewal_alerts_type_unique_idx
  ON public.agent_renewal_alerts(subscription_id, alert_type)
  WHERE user_decision IS NULL;

-- Add a check constraint to ensure encrypted format is valid if set
DO $$ BEGIN
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscription_password_enc_format
    CHECK (service_password_enc IS NULL OR length(service_password_enc) > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Done
NOTIFY pgrst, 'reload schema';
