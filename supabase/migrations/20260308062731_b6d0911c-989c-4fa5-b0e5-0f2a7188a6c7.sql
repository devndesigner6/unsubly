ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS app_id bigint DEFAULT NULL;
ALTER TABLE public.escrow_vaults ADD COLUMN IF NOT EXISTS app_address text DEFAULT NULL;