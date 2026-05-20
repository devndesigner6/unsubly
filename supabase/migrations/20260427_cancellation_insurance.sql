-- Feature 1: Cancellation Insurance Vault
-- Add proof columns to escrow_vaults

ALTER TABLE public.escrow_vaults
  ADD COLUMN IF NOT EXISTS cancellation_proof_hash TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_proof_text TEXT;

-- Index for quick lookup of insurance vaults
CREATE INDEX IF NOT EXISTS escrow_vaults_cancellation_type_idx
  ON public.escrow_vaults(vault_type) WHERE vault_type = 'cancellation_insurance';

-- Feature 8: A2A transactions log (reuses agent_actions table with action_type='a2a_purchase')
-- No schema changes needed — agent_actions.payload stores all A2A data

NOTIFY pgrst, 'reload schema';
