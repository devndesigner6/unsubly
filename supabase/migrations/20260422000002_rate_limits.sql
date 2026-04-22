-- Persistent rate-limit counters.
--
-- Schema is intentionally minimal — one row per (bucket, key) pair, with the
-- rolling window expressed as a "reset_at" timestamp. The helper increments
-- count if reset_at is in the future, otherwise resets count to 1 and pushes
-- reset_at forward by the window. Using Postgres lets us survive process
-- restarts (which an in-memory limiter would not).

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket    text        NOT NULL,
  key       text        NOT NULL,
  count     integer     NOT NULL DEFAULT 0,
  reset_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_reset_at_idx
  ON public.api_rate_limits (reset_at);

-- Atomic increment+window-reset RPC. Returns true if the call is allowed.
CREATE OR REPLACE FUNCTION public.rate_limit_check(
  p_bucket text,
  p_key    text,
  p_limit  integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_reset timestamptz;
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
GRANT  EXECUTE ON FUNCTION public.rate_limit_check(text, text, integer, integer) TO service_role;
