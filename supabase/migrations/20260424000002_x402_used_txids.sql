-- x402 replay protection: stores every payment txid that has been claimed
-- by the x402 middleware. The unique constraint on txid ensures a signed
-- payment transaction can never be replayed.

CREATE TABLE IF NOT EXISTS public.x402_used_txids (
  txid TEXT PRIMARY KEY,
  resource TEXT,
  amount_microalgos BIGINT,
  pay_to TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS x402_used_txids_claimed_at_idx
  ON public.x402_used_txids(claimed_at DESC);

ALTER TABLE public.x402_used_txids ENABLE ROW LEVEL SECURITY;

-- Only the service role (server x402 middleware) can manage txids.
CREATE POLICY "Service role manages x402 txids"
  ON public.x402_used_txids
  FOR ALL
  USING (auth.role() = 'service_role');
