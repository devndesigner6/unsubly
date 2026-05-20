-- ── Feature 2: Per-user Telegram notifications ───────────────────────────────
-- Add telegram_chat_id to profiles so each user gets their own notifications
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Temp table for the /start code flow (expires after 10 minutes)
CREATE TABLE IF NOT EXISTS public.telegram_pending_codes (
  code        TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_pending_codes ENABLE ROW LEVEL SECURITY;
-- No user policies — service role only (webhook writes, verify endpoint reads)

-- Auto-clean expired codes
CREATE INDEX IF NOT EXISTS telegram_pending_codes_expires_idx
  ON public.telegram_pending_codes(expires_at);

-- ── Feature 4: Trial-to-paid human-in-the-loop guard ─────────────────────────
-- Pending agent decisions: agent pauses and waits for user reply via Telegram
CREATE TABLE IF NOT EXISTS public.agent_pending_decisions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id     UUID REFERENCES public.escrow_vaults(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  chat_id      TEXT,                          -- user's telegram chat_id
  decision     TEXT CHECK (decision IN ('pay', 'cancel', 'timeout')),
  notified_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_pending_decisions_vault_idx
  ON public.agent_pending_decisions(vault_id) WHERE decision IS NULL;

CREATE INDEX IF NOT EXISTS agent_pending_decisions_user_idx
  ON public.agent_pending_decisions(user_id);

ALTER TABLE public.agent_pending_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pending decisions"
  ON public.agent_pending_decisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages pending decisions"
  ON public.agent_pending_decisions FOR ALL
  USING (auth.role() = 'service_role');

-- Add trial fields to subscription_guardrails (already exists, just add columns)
ALTER TABLE public.subscription_guardrails
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_confirmation BOOLEAN DEFAULT FALSE;

-- Done
NOTIFY pgrst, 'reload schema';
