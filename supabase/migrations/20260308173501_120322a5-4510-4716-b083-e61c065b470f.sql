
-- Extend escrow_vaults for new vault types
ALTER TABLE public.escrow_vaults 
ADD COLUMN IF NOT EXISTS unlock_time timestamptz,
ADD COLUMN IF NOT EXISTS vault_type text NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS arbitrator_address text,
ADD COLUMN IF NOT EXISTS co_signer_address text,
ADD COLUMN IF NOT EXISTS asset_id bigint,
ADD COLUMN IF NOT EXISTS co_signer_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS nft_asset_id bigint;

-- Shareable resume links
CREATE TABLE IF NOT EXISTS public.resume_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resume_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own resume shares"
ON public.resume_shares
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_resume_shares_updated_at
BEFORE UPDATE ON public.resume_shares
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
