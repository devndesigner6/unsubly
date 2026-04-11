-- RPC function so users can delete their own account entirely from the client.
-- SECURITY DEFINER lets it run with the function owner's privileges, which
-- means it can DELETE from auth.users (normally off-limits to anon/service).

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Clean up tables that may not cascade automatically
  DELETE FROM public.resume_shares      WHERE user_id = _uid;
  DELETE FROM public.onchain_payments   WHERE user_id = _uid;
  DELETE FROM public.agent_actions      WHERE user_id = _uid;

  -- Subscriptions cascade to escrow_vaults and notifications_log
  DELETE FROM public.subscriptions WHERE user_id = _uid;

  -- Profile (cascades to any remaining FK children)
  DELETE FROM public.profiles WHERE id = _uid;

  -- Finally remove the auth user — SECURITY DEFINER gives us permission
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;

-- Only authenticated users may call this
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
