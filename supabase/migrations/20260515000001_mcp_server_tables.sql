-- MCP Server Infrastructure Tables
-- Supports authentication, rate limiting, audit logging, and replay protection

-- ─── MCP API Tokens ──────────────────────────────────────────────────────────
-- Stores hashed API tokens for MCP clients (Claude, ChatGPT, custom agents)
CREATE TABLE IF NOT EXISTS mcp_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Token',
  token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the actual token
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'], -- read, write, admin, all
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_scopes CHECK (
    scopes <@ ARRAY['read', 'write', 'admin', 'all']::TEXT[]
  )
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_hash ON mcp_api_tokens(token_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_api_tokens(user_id);

-- RLS: users can only see/manage their own tokens
ALTER TABLE mcp_api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON mcp_api_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ─── MCP Request Logs ────────────────────────────────────────────────────────
-- Audit trail of all MCP requests for monitoring and debugging
CREATE TABLE IF NOT EXISTS mcp_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL, -- e.g. 'tools/call', 'resources/read'
  tool_name TEXT, -- which tool was called (null for non-tool requests)
  token_id TEXT, -- which token was used
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying recent logs
CREATE INDEX IF NOT EXISTS idx_mcp_logs_created ON mcp_request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_logs_user ON mcp_request_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_logs_tool ON mcp_request_logs(tool_name, created_at DESC);

-- Auto-cleanup: delete logs older than 30 days (run via pg_cron or manual)
-- No RLS needed — only service role accesses this table

-- ─── x402 Used Transaction IDs (Replay Protection) ──────────────────────────
-- Prevents the same signed Algorand payment from being reused
CREATE TABLE IF NOT EXISTS x402_used_txids (
  txid TEXT PRIMARY KEY,
  resource TEXT,
  amount_microalgos BIGINT,
  pay_to TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup of old entries
CREATE INDEX IF NOT EXISTS idx_x402_txids_claimed ON x402_used_txids(claimed_at);

-- ─── Add paused_at and resume_date to subscriptions ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'paused_at') THEN
    ALTER TABLE subscriptions ADD COLUMN paused_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'resume_date') THEN
    ALTER TABLE subscriptions ADD COLUMN resume_date DATE;
  END IF;
END $$;
