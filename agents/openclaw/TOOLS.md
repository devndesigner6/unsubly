# Tools

## Agent Commands

```bash
# Run vault monitor (checks due vaults, releases payments, sends alerts)
npm run monitor:vaults

# Start full agent (HTTP server + nanobot cron + fallback cron)
npm start
```

## MCP Server

The agent exposes a Model Context Protocol (MCP) server at `/mcp` for external AI agents.

### Endpoint
```
POST https://unsubscribely-agent-agent-production.up.railway.app/mcp
POST https://unsubscribely-agent-agent-production.up.railway.app/mcp/v1
```

Both paths are equivalent. Use `/mcp/v1` for versioned access.

### Authentication
```
Authorization: Bearer <your_mcp_token>
```

Tokens are generated via `POST /api/mcp-token` with a valid Supabase session.

### Available Tools (12)

| Tool | Scope | Description |
|------|-------|-------------|
| `list_subscriptions` | read | List all subscriptions with vault info, pagination |
| `get_spending_summary` | read | Monthly/yearly cost, category breakdown, overlap detection |
| `get_vault_status` | read | Check escrow vault status for a subscription |
| `list_upcoming_renewals` | read | Subscriptions renewing within N days |
| `get_agent_status` | read | Agent health, last run, recent actions |
| `get_payment_history` | read | On-chain payment history with txids |
| `get_subscription_health` | read | Health score and risk assessment |
| `trigger_cancellation` | write | Initiate cancellation flow |
| `pause_subscription` | write | Pause/unpause a subscription |
| `trigger_vault_release` | admin | Manually release a vault on-chain |
| `kill_vault` | admin | Kill vault, return ALGO to user |
| `verify_cancellation_proof` | read | Verify on-chain cancellation proof |

### Resources (4)

| URI | Description |
|-----|-------------|
| `unsubscribely://subscriptions/{user_id}` | All subscription data |
| `unsubscribely://vaults/{user_id}` | All escrow vaults |
| `unsubscribely://agent-actions/{user_id}` | Agent action history |
| `unsubscribely://spending-report/{user_id}` | Monthly spending report |

### Prompts (3)

| Prompt | Description |
|--------|-------------|
| `subscription_audit` | Analyze subscriptions for savings |
| `cancellation_guide` | Step-by-step cancel instructions |
| `vault_explainer` | How Algorand vaults work |

### Example: Claude Desktop Config

```json
{
  "mcpServers": {
    "unsubscribely": {
      "url": "https://unsubscribely-agent-agent-production.up.railway.app/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer umcp_your_token_here"
      }
    }
  }
}
```

### Example: List Subscriptions

```bash
curl -X POST https://unsubscribely-agent-agent-production.up.railway.app/mcp \
  -H "Authorization: Bearer umcp_your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_subscriptions",
      "arguments": { "user_id": "your-uuid" }
    }
  }'
```

### Features
- Bearer token auth with scoped permissions (read/write/admin)
- Rate limiting: 30 requests/minute per token
- Request audit logging to Supabase
- Batch request support (up to 10 per batch)
- User isolation (tokens scoped to specific user)
- CORS headers for browser-based MCP clients
- Health/discovery endpoint at `/mcp/health`

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Agent health check |
| POST | `/api/cancel` | Trigger guided cancellation |
| GET | `/api/proof/:txid` | Verify cancellation proof |
| POST | `/api/v1/message` | Legacy message handler |
| POST | `/mcp` | MCP protocol endpoint |
| GET | `/mcp/health` | MCP discovery/capabilities |
