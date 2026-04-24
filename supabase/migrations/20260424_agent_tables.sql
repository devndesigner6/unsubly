-- ── Agent run idempotency locks ──────────────────────────────────────────────
-- Prevents the agent from releasing the same vault twice in the same billing period.
CREATE TABLE IF NOT EXISTS agent_run_locks (
  lock_key   TEXT PRIMARY KEY,
  vault_id   UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-clean locks older than 35 days (one billing cycle + buffer)
CREATE INDEX IF NOT EXISTS agent_run_locks_created_at_idx ON agent_run_locks (created_at);

-- ── x402 replay protection ────────────────────────────────────────────────────
-- Ensures each signed Algorand payment txid can only be used once.
CREATE TABLE IF NOT EXISTS x402_used_txids (
  txid              TEXT PRIMARY KEY,
  resource          TEXT,
  amount_microalgos BIGINT,
  pay_to            TEXT,
  claimed_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Subscription guardrails ───────────────────────────────────────────────────
-- Per-subscription rules the agent must check before releasing a vault.
CREATE TABLE IF NOT EXISTS subscription_guardrails (
  subscription_id          UUID PRIMARY KEY REFERENCES subscriptions(id) ON DELETE CASCADE,
  budget_cap               NUMERIC,           -- max ALGO agent can release per cycle
  trial_end_date           DATE,              -- agent skips release until after this date
  pause_before_paid_renewal BOOLEAN DEFAULT FALSE, -- agent pauses and asks user to confirm
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only see/edit their own guardrails
ALTER TABLE subscription_guardrails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own guardrails"
  ON subscription_guardrails
  FOR ALL
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = auth.uid()
    )
  );

-- agent_run_locks: service role only (agent bypasses RLS with service key)
ALTER TABLE agent_run_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON agent_run_locks FOR ALL USING (false);

-- x402_used_txids: service role only
ALTER TABLE x402_used_txids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON x402_used_txids FOR ALL USING (false);
