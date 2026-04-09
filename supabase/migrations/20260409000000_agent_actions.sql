-- Agent Actions table: records every autonomous action taken by the on-chain agent
-- This is the audit log for the Agentic Commerce feature (Agentic Commerce #3 track)

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  ON public.agent_actions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage agent actions"
  ON public.agent_actions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Enable pg_cron for scheduled agent runs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Daily cron: call auto-release-vaults edge function at 00:05 UTC every day
-- Replace <SUPABASE_URL> and <SERVICE_ROLE_KEY> with actual values when deploying
-- This is managed via Supabase dashboard > Database > Extensions > pg_cron
-- cron.schedule('auto-release-vaults-daily', '5 0 * * *', ...);
