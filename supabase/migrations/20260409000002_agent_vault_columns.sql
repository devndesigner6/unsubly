-- Add agent_address column to escrow_vaults table
-- This stores the authorized autonomous release agent's Algorand address
-- for vaults deployed using AgentEscrowVault (A2A Autonomous Payments).
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS agent_address TEXT;

-- Index for fast lookup of agent-managed vaults
CREATE INDEX IF NOT EXISTS escrow_vaults_agent_address_idx
  ON public.escrow_vaults(agent_address)
  WHERE agent_address IS NOT NULL;

-- Add app_id and app_address columns if they don't exist (vault on-chain identifiers)
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS app_id BIGINT;
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS app_address TEXT;
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS vault_type TEXT DEFAULT 'standard';
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS unlock_time TIMESTAMPTZ;
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS co_signer_address TEXT;
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS arbitrator_address TEXT;
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS asset_id BIGINT;

-- pg_cron: Schedule daily autonomous vault release at 00:05 UTC
-- This is the core of the A2A Autonomous Payments demonstration.
-- Requires pg_cron extension (enabled in Supabase dashboard → Database → Extensions).
-- Replace YOUR_SUPABASE_URL and YOUR_SERVICE_ROLE_KEY with actual values.
--
-- Run this manually in Supabase SQL editor after enabling pg_cron:
--
-- SELECT cron.schedule(
--   'auto-release-vaults-daily',
--   '5 0 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'YOUR_SUPABASE_URL/functions/v1/auto-release-vaults',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
