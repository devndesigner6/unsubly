-- Agent run locks: idempotency table preventing double-release of the same
-- vault in the same billing period. Keyed on (vault_id, billing_date).
-- The agent inserts a row before releasing; unique constraint prevents dupes.

CREATE TABLE IF NOT EXISTS public.agent_run_locks (
  lock_key TEXT PRIMARY KEY,
  vault_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_run_locks_vault_id_idx
  ON public.agent_run_locks(vault_id);

CREATE INDEX IF NOT EXISTS agent_run_locks_created_at_idx
  ON public.agent_run_locks(created_at DESC);

ALTER TABLE public.agent_run_locks ENABLE ROW LEVEL SECURITY;

-- Only the service role (agent process) can manage locks.
CREATE POLICY "Service role manages agent run locks"
  ON public.agent_run_locks
  FOR ALL
  USING (auth.role() = 'service_role');
