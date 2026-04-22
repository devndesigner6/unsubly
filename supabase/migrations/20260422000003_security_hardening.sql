-- Batch 1: Security & data integrity hardening
-- 1. x402 replay protection: track every claimed payment txid
CREATE TABLE IF NOT EXISTS public.x402_used_txids (
  txid TEXT PRIMARY KEY,
  resource TEXT,
  amount_microalgos BIGINT,
  pay_to TEXT,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS x402_used_txids_claimed_at_idx
  ON public.x402_used_txids(claimed_at DESC);

-- 2. agent-run idempotency lock per (vault_id, billing_period)
CREATE TABLE IF NOT EXISTS public.agent_run_locks (
  lock_key TEXT PRIMARY KEY,
  vault_id UUID,
  acquired_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_run_locks_acquired_at_idx
  ON public.agent_run_locks(acquired_at DESC);

-- 3. UNIQUE on onchain_payments.algorand_txn_id (prevent dupe inserts on retry)
-- Pre-dedupe first: keep the OLDEST row for each duplicated txid, drop the rest.
-- This is safe because retry-induced dupes are functionally identical anyway.
DELETE FROM public.onchain_payments a
USING public.onchain_payments b
WHERE a.algorand_txn_id IS NOT NULL
  AND a.algorand_txn_id = b.algorand_txn_id
  AND a.ctid > b.ctid;

DO $$ BEGIN
  ALTER TABLE public.onchain_payments
    ADD CONSTRAINT onchain_payments_algorand_txn_id_key UNIQUE (algorand_txn_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- 4. Composite index for the auto-release cron query
CREATE INDEX IF NOT EXISTS escrow_vaults_status_agent_idx
  ON public.escrow_vaults(status, agent_address)
  WHERE status = 'locked' AND agent_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS escrow_vaults_status_subscription_idx
  ON public.escrow_vaults(status, subscription_id)
  WHERE status = 'locked';

-- 5. RLS for the new tables (server-side-only, no user access)
ALTER TABLE public.x402_used_txids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_locks ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated; only service-role bypasses RLS.

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
