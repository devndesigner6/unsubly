-- ============================================================
-- Unsubscribely — Complete Database Setup
-- Run this ONCE in a fresh Supabase project SQL Editor
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── Shared updated_at trigger function ───────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Auto-create profile on signup ────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Enums ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'trial', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method_type AS ENUM ('credit_card', 'debit_card', 'paypal', 'bank_account', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── profiles ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  algorand_address TEXT,
  default_alert_days INTEGER NOT NULL DEFAULT 3,
  email_alerts BOOLEAN NOT NULL DEFAULT true,
  weekly_digest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own profile"
  ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── folders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own folders"
  ON public.folders FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── tags ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own tags"
  ON public.tags FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── payment_methods ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.payment_method_type NOT NULL DEFAULT 'credit_card',
  last_four TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own payment methods"
  ON public.payment_methods FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── subscriptions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  next_billing_date DATE NOT NULL,
  start_date DATE,
  status public.subscription_status NOT NULL DEFAULT 'active',
  category TEXT,
  url TEXT,
  notes TEXT,
  logo TEXT,
  alert_days INTEGER NOT NULL DEFAULT 3,
  alert_enabled BOOLEAN NOT NULL DEFAULT true,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  last_billed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── subscription_tags ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_tags (
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (subscription_id, tag_id)
);

ALTER TABLE public.subscription_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own subscription tags"
  ON public.subscription_tags FOR ALL TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

-- ── escrow_vaults ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escrow_vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  algorand_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ALGO',
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'killed', 'pending')),
  txn_id TEXT,
  escrow_address TEXT,
  kill_switch_active BOOLEAN NOT NULL DEFAULT false,
  app_id BIGINT,
  app_address TEXT,
  vault_type TEXT NOT NULL DEFAULT 'standard',
  unlock_time TIMESTAMPTZ,
  co_signer_address TEXT,
  co_signer_approved BOOLEAN DEFAULT false,
  arbitrator_address TEXT,
  asset_id BIGINT,
  nft_asset_id BIGINT,
  agent_address TEXT,
  network TEXT NOT NULL DEFAULT 'testnet' CHECK (network IN ('testnet', 'mainnet')),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escrow_vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own vaults"
  ON public.escrow_vaults FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_escrow_vaults_updated_at
  BEFORE UPDATE ON public.escrow_vaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS escrow_vaults_status_subscription_idx
  ON public.escrow_vaults(status, subscription_id) WHERE status = 'locked';

CREATE INDEX IF NOT EXISTS escrow_vaults_agent_address_idx
  ON public.escrow_vaults(agent_address) WHERE agent_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS escrow_vaults_network_status_idx
  ON public.escrow_vaults(network, status) WHERE status = 'locked';

-- ── onchain_payments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onchain_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  algorand_txn_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  recipient_address TEXT,
  sender_address TEXT NOT NULL,
  note TEXT,
  block_round BIGINT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT onchain_payments_algorand_txn_id_key UNIQUE (algorand_txn_id)
);

ALTER TABLE public.onchain_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own payments"
  ON public.onchain_payments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── agent_actions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL DEFAULT 'auto_release',
  vault_id UUID REFERENCES public.escrow_vaults(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  payload JSONB,
  txid TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_actions_user_id_idx ON public.agent_actions(user_id);
CREATE INDEX IF NOT EXISTS agent_actions_created_at_idx ON public.agent_actions(created_at DESC);

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent actions"
  ON public.agent_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage agent actions"
  ON public.agent_actions FOR ALL
  USING (auth.role() = 'service_role');

-- ── resume_shares ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resume_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resume_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own resume shares"
  ON public.resume_shares FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_resume_shares_updated_at
  BEFORE UPDATE ON public.resume_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── agent_run_locks ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_run_locks (
  lock_key TEXT PRIMARY KEY,
  vault_id UUID,
  acquired_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_run_locks_acquired_at_idx
  ON public.agent_run_locks(acquired_at DESC);

ALTER TABLE public.agent_run_locks ENABLE ROW LEVEL SECURITY;
-- No user policies — service role only

-- ── x402_used_txids ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.x402_used_txids (
  txid TEXT PRIMARY KEY,
  resource TEXT,
  amount_microalgos BIGINT,
  pay_to TEXT,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS x402_used_txids_claimed_at_idx
  ON public.x402_used_txids(claimed_at DESC);

ALTER TABLE public.x402_used_txids ENABLE ROW LEVEL SECURITY;
-- No user policies — service role only

-- ── subscription_guardrails ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_guardrails (
  subscription_id UUID PRIMARY KEY REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  budget_cap NUMERIC,
  trial_end_date DATE,
  pause_before_paid_renewal BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_guardrails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own guardrails"
  ON public.subscription_guardrails FOR ALL
  USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

-- ── api_rate_limits ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_reset_at_idx
  ON public.api_rate_limits(reset_at);

CREATE OR REPLACE FUNCTION public.rate_limit_check(
  p_bucket TEXT, p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_count integer; v_reset timestamptz;
BEGIN
  INSERT INTO public.api_rate_limits AS r (bucket, key, count, reset_at)
       VALUES (p_bucket, p_key, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (bucket, key) DO UPDATE
     SET count    = CASE WHEN r.reset_at < now() THEN 1 ELSE r.count + 1 END,
         reset_at = CASE WHEN r.reset_at < now() THEN now() + make_interval(secs => p_window_seconds) ELSE r.reset_at END
   RETURNING count, reset_at INTO v_count, v_reset;
  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_check(text, text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(text, text, integer, integer) TO service_role;

-- ── delete_my_account RPC ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.resume_shares    WHERE user_id = _uid;
  DELETE FROM public.onchain_payments WHERE user_id = _uid;
  DELETE FROM public.agent_actions    WHERE user_id = _uid;
  DELETE FROM public.subscriptions    WHERE user_id = _uid;
  DELETE FROM public.profiles         WHERE id = _uid;
  DELETE FROM auth.users              WHERE id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ── Auth trigger ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Storage bucket ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Done
NOTIFY pgrst, 'reload schema';
