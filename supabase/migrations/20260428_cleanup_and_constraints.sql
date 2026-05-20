-- ── Cleanup jobs and constraints to push score from 72 → 80+ ─────────────────

-- 1. Auto-clean agent_run_locks older than 35 days (one billing cycle + buffer)
--    Prevents unbounded table growth when agent crashes mid-cycle
SELECT cron.schedule(
  'cleanup-agent-run-locks',
  '0 3 * * *',  -- daily at 3am UTC
  $$DELETE FROM public.agent_run_locks WHERE acquired_at < now() - interval '35 days'$$
);

-- 2. Auto-clean x402_used_txids older than 90 days
--    Replay protection only needs to cover the payment window
SELECT cron.schedule(
  'cleanup-x402-txids',
  '0 4 * * *',  -- daily at 4am UTC
  $$DELETE FROM public.x402_used_txids WHERE claimed_at < now() - interval '90 days'$$
);

-- 3. Auto-clean expired telegram_pending_codes
SELECT cron.schedule(
  'cleanup-telegram-codes',
  '*/15 * * * *',  -- every 15 minutes
  $$DELETE FROM public.telegram_pending_codes WHERE expires_at < now()$$
);

-- 4. Auto-clean expired agent_pending_decisions
SELECT cron.schedule(
  'cleanup-agent-decisions',
  '0 5 * * *',  -- daily at 5am UTC
  $$DELETE FROM public.agent_pending_decisions WHERE expires_at < now() - interval '7 days'$$
);

-- 5. Add budget_cap constraint — must be positive
ALTER TABLE public.subscription_guardrails
  ADD CONSTRAINT budget_cap_positive CHECK (budget_cap IS NULL OR budget_cap > 0);

-- 6. Add FK on agent_pending_decisions.user_id for cascade delete
ALTER TABLE public.agent_pending_decisions
  ADD CONSTRAINT agent_pending_decisions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Add index on agent_run_locks.acquired_at for cleanup performance
CREATE INDEX IF NOT EXISTS agent_run_locks_acquired_at_cleanup_idx
  ON public.agent_run_locks(acquired_at)
  WHERE acquired_at < now() - interval '1 day';

-- 8. Add index on x402_used_txids.claimed_at for cleanup performance
CREATE INDEX IF NOT EXISTS x402_used_txids_cleanup_idx
  ON public.x402_used_txids(claimed_at)
  WHERE claimed_at < now() - interval '30 days';

-- Done
NOTIFY pgrst, 'reload schema';
