-- Drop legacy escrow columns that were superseded by the per-vault model.
-- Originally we stored a single escrow address on `subscriptions`. With the
-- escrow_vaults table (one-vault-per-billing-cycle) that column is dead.
-- Safe to drop because:
--   - `EscrowVaultsPage` and `VaultDetailsPage` read from `escrow_vaults`
--   - `agents/release-agent.mjs` reads from `escrow_vaults`
--   - Nothing in `src/` writes to or queries `subscriptions.escrow_address`

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'escrow_address'
  ) THEN
    ALTER TABLE public.subscriptions DROP COLUMN escrow_address;
  END IF;
END $$;

-- Tag every escrow vault with the network it lives on. Required for the
-- multi-network agent runner (`agents/release-agent.mjs` ALGO_NETWORK=all)
-- so we can target the right algod when iterating due vaults.
ALTER TABLE public.escrow_vaults
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'testnet'
    CHECK (network IN ('testnet', 'mainnet'));

CREATE INDEX IF NOT EXISTS escrow_vaults_network_status_idx
  ON public.escrow_vaults(network, status)
  WHERE status = 'locked';

NOTIFY pgrst, 'reload schema';
