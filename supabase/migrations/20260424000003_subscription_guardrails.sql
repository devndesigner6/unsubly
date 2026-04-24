-- Subscription guardrails: per-subscription rules the autonomous agent
-- checks before releasing a vault. Replaces the client-side localStorage
-- budget system with a server-side table the agent can actually read.

CREATE TABLE IF NOT EXISTS public.subscription_guardrails (
  subscription_id UUID PRIMARY KEY REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  budget_cap NUMERIC,
  trial_end_date DATE,
  pause_before_paid_renewal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_guardrails ENABLE ROW LEVEL SECURITY;

-- Users can manage guardrails for their own subscriptions.
CREATE POLICY "Users can view their own guardrails"
  ON public.subscription_guardrails
  FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own guardrails"
  ON public.subscription_guardrails
  FOR INSERT
  WITH CHECK (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own guardrails"
  ON public.subscription_guardrails
  FOR UPDATE
  USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own guardrails"
  ON public.subscription_guardrails
  FOR DELETE
  USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

-- Service role (agent) can read guardrails for any subscription.
CREATE POLICY "Service role manages guardrails"
  ON public.subscription_guardrails
  FOR ALL
  USING (auth.role() = 'service_role');
