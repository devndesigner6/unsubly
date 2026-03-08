
-- Add algorand_address to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS algorand_address TEXT;

-- Create escrow_vaults table
CREATE TABLE public.escrow_vaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  algorand_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ALGO',
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'killed', 'pending')),
  txn_id TEXT,
  escrow_address TEXT,
  kill_switch_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  released_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.escrow_vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own vaults" ON public.escrow_vaults
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create onchain_payments table for the resume
CREATE TABLE public.onchain_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  algorand_txn_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  recipient_address TEXT,
  sender_address TEXT NOT NULL,
  note TEXT,
  block_round BIGINT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onchain_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own payments" ON public.onchain_payments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update trigger for escrow_vaults
CREATE TRIGGER update_escrow_vaults_updated_at
  BEFORE UPDATE ON public.escrow_vaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
