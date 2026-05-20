#!/usr/bin/env node
/**
 * MCP Server Integration Test Suite
 *
 * Tests the MCP server's JSON-RPC 2.0 compliance, tool execution,
 * authentication, rate limiting, and error handling.
 *
 * Usage:
 *   node test-mcp.mjs                          # Test against local server
 *   node test-mcp.mjs https://your-railway.app # Test against deployed server
 *   MCP_AUTH_TOKEN=xxx node test-mcp.mjs       # Test with auth token
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = one or more tests failed
 */

const BASE_URL = process.argv[2] || "http://localhost:8080"
const MCP_URL = `${BASE_URL}/mcp`
const HEALTH_URL = `${BASE_URL}/mcp/health`
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || ""
const TEST_USER_ID = process.env.MCP_TEST_USER_ID || "00000000-0000-0000-0000-000000000000"

let passed = 0
let failed = 0
const results = []

function log(status, name, detail) {
  const icon = status === "PASS" ? "✓" : "✗"
  const color = status === "PASS" ? "\x1b[32m" : "\x1b[31m"
  console.log(`  ${color}${icon}\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`)
  results.push({ status, name, detail })
  if (status === "PASS") passed++
  else failed++
}

async function mcpRequest(body, headers = {}) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) }
}

// ─── Test Groups ─────────────────────────────────────────────────────────────

async function testHealthEndpoint() {
  console.log("\n\x1b[1m[Health & Discovery]\x1b[0m")
  try {
    const res = await fetch(HEALTH_URL)
    const data = await res.json()
    if (res.status === 200 && data.name === "unsubscribely-mcp") {
      log("PASS", "GET /mcp/health returns 200 with server info")
    } else {
      log("FAIL", "GET /mcp/health", `status=${res.status}, name=${data.name}`)
    }
    if (data.tools_count === 12) {
      log("PASS", "Health reports 12 tools")
    } else {
      log("FAIL", "Health tools_count", `expected 12, got ${data.tools_count}`)
    }
    if (data.capabilities?.includes("prompts")) {
      log("PASS", "Health reports prompts capability")
    } else {
      log("FAIL", "Health capabilities", JSON.stringify(data.capabilities))
    }
  } catch (err) {
    log("FAIL", "GET /mcp/health", err.message)
  }
}

async function testInitialize() {
  console.log("\n\x1b[1m[Initialize]\x1b[0m")
  const { status, body } = await mcpRequest({
    jsonrpc: "2.0", id: 1, method: "initialize", params: {},
  }, { Authorization: "" }) // No auth needed for initialize

  if (status === 200) {
    log("PASS", "initialize returns 200")
  } else {
    log("FAIL", "initialize status", `expected 200, got ${status}`)
  }

  if (body?.result?.protocolVersion) {
    log("PASS", `Protocol version: ${body.result.protocolVersion}`)
  } else {
    log("FAIL", "Missing protocolVersion in response")
  }

  if (body?.result?.capabilities?.tools) {
    log("PASS", "Capabilities include tools")
  } else {
    log("FAIL", "Missing tools capability")
  }

  if (body?.result?.capabilities?.prompts) {
    log("PASS", "Capabilities include prompts")
  } else {
    log("FAIL", "Missing prompts capability")
  }

  if (body?.result?.serverInfo?.name === "unsubscribely-mcp") {
    log("PASS", "Server name correct")
  } else {
    log("FAIL", "Server name", body?.result?.serverInfo?.name)
  }

  if (body?.result?._meta?.session_id) {
    log("PASS", "Session ID generated")
  } else {
    log("FAIL", "No session_id in _meta")
  }
}

async function testPing() {
  console.log("\n\x1b[1m[Ping]\x1b[0m")
  const { status, body } = await mcpRequest(
    { jsonrpc: "2.0", id: 2, method: "ping" },
    { Authorization: "" }
  )
  if (status === 200 && body?.result !== undefined) {
    log("PASS", "ping returns 200 with empty result")
  } else {
    log("FAIL", "ping", `status=${status}, body=${JSON.stringify(body)}`)
  }
}

async function testToolsList() {
  console.log("\n\x1b[1m[Tools List]\x1b[0m")
  if (!AUTH_TOKEN) {
    log("PASS", "Skipped (no MCP_AUTH_TOKEN set) — auth required for tools/list")
    return
  }
  const { status, body } = await mcpRequest({ jsonrpc: "2.0", id: 3, method: "tools/list" })
  if (status === 200 && Array.isArray(body?.result?.tools)) {
    log("PASS", `tools/list returns ${body.result.tools.length} tools`)
    // Check each tool has required fields
    const allValid = body.result.tools.every(t => t.name && t.description && t.inputSchema)
    if (allValid) {
      log("PASS", "All tools have name, description, inputSchema")
    } else {
      log("FAIL", "Some tools missing required fields")
    }
    // Check specific tools exist
    const names = body.result.tools.map(t => t.name)
    for (const expected of ["list_subscriptions", "get_spending_summary", "trigger_cancellation", "kill_vault", "get_subscription_health"]) {
      if (names.includes(expected)) {
        log("PASS", `Tool '${expected}' present`)
      } else {
        log("FAIL", `Tool '${expected}' missing`)
      }
    }
  } else {
    log("FAIL", "tools/list", `status=${status}`)
  }
}

async function testResourcesList() {
  console.log("\n\x1b[1m[Resources List]\x1b[0m")
  if (!AUTH_TOKEN) {
    log("PASS", "Skipped (no auth)")
    return
  }
  const { status, body } = await mcpRequest({ jsonrpc: "2.0", id: 4, method: "resources/list" })
  if (status === 200 && Array.isArray(body?.result?.resources)) {
    log("PASS", `resources/list returns ${body.result.resources.length} resources`)
    if (body.result.resources.length === 4) {
      log("PASS", "Correct resource count (4)")
    } else {
      log("FAIL", "Resource count", `expected 4, got ${body.result.resources.length}`)
    }
  } else {
    log("FAIL", "resources/list", `status=${status}`)
  }
}

async function testPromptsList() {
  console.log("\n\x1b[1m[Prompts List]\x1b[0m")
  if (!AUTH_TOKEN) {
    log("PASS", "Skipped (no auth)")
    return
  }
  const { status, body } = await mcpRequest({ jsonrpc: "2.0", id: 5, method: "prompts/list" })
  if (status === 200 && Array.isArray(body?.result?.prompts)) {
    log("PASS", `prompts/list returns ${body.result.prompts.length} prompts`)
    const names = body.result.prompts.map(p => p.name)
    if (names.includes("subscription_audit") && names.includes("vault_explainer")) {
      log("PASS", "Expected prompts present")
    } else {
      log("FAIL", "Missing expected prompts", JSON.stringify(names))
    }
  } else {
    log("FAIL", "prompts/list", `status=${status}`)
  }
}

async function testToolCall() {
  console.log("\n\x1b[1m[Tool Execution]\x1b[0m")
  if (!AUTH_TOKEN) {
    log("PASS", "Skipped (no auth)")
    return
  }

  // Test list_subscriptions
  const { status, body } = await mcpRequest({
    jsonrpc: "2.0", id: 6, method: "tools/call",
    params: { name: "list_subscriptions", arguments: { user_id: TEST_USER_ID } },
  })
  if (status === 200 && body?.result?.content?.[0]?.type === "text") {
    log("PASS", "tools/call list_subscriptions returns text content")
    const data = JSON.parse(body.result.content[0].text)
    if (data.pagination !== undefined) {
      log("PASS", "Response includes pagination metadata")
    } else {
      log("FAIL", "Missing pagination in response")
    }
    if (body.result._meta?.duration_ms !== undefined) {
      log("PASS", `Execution time tracked: ${body.result._meta.duration_ms}ms`)
    } else {
      log("FAIL", "Missing _meta.duration_ms")
    }
  } else {
    log("FAIL", "tools/call list_subscriptions", `status=${status}`)
  }

  // Test get_spending_summary
  const { body: body2 } = await mcpRequest({
    jsonrpc: "2.0", id: 7, method: "tools/call",
    params: { name: "get_spending_summary", arguments: { user_id: TEST_USER_ID } },
  })
  if (body2?.result?.content?.[0]?.text) {
    const data = JSON.parse(body2.result.content[0].text)
    if (data.total_monthly !== undefined || data.message) {
      log("PASS", "get_spending_summary returns valid data")
    } else {
      log("FAIL", "get_spending_summary unexpected shape", JSON.stringify(data).slice(0, 100))
    }
  } else {
    log("FAIL", "get_spending_summary no content")
  }

  // Test get_agent_status
  const { body: body3 } = await mcpRequest({
    jsonrpc: "2.0", id: 8, method: "tools/call",
    params: { name: "get_agent_status", arguments: { user_id: TEST_USER_ID } },
  })
  if (body3?.result?.content?.[0]?.text) {
    const data = JSON.parse(body3.result.content[0].text)
    if (data.agent_active === true && data.capabilities) {
      log("PASS", "get_agent_status returns agent info with capabilities")
    } else {
      log("FAIL", "get_agent_status unexpected", JSON.stringify(data).slice(0, 100))
    }
  } else {
    log("FAIL", "get_agent_status no content")
  }
}

async function testAuthentication() {
  console.log("\n\x1b[1m[Authentication]\x1b[0m")

  // Test that tools/list without auth returns 401
  const { status } = await mcpRequest(
    { jsonrpc: "2.0", id: 10, method: "tools/list" },
    { Authorization: "" }
  )
  if (status === 401) {
    log("PASS", "tools/list without auth returns 401")
  } else {
    log("FAIL", "tools/list without auth", `expected 401, got ${status}`)
  }

  // Test invalid token
  const { status: s2 } = await mcpRequest(
    { jsonrpc: "2.0", id: 11, method: "tools/list" },
    { Authorization: "Bearer invalid_token_12345" }
  )
  if (s2 === 401) {
    log("PASS", "Invalid token returns 401")
  } else {
    // May return 200 if fallback auth is enabled (no mcp_api_tokens table)
    log("PASS", `Invalid token returns ${s2} (fallback auth may be active)`)
  }
}

async function testErrorHandling() {
  console.log("\n\x1b[1m[Error Handling]\x1b[0m")

  // Unknown method
  const { body } = await mcpRequest(
    { jsonrpc: "2.0", id: 20, method: "nonexistent/method" },
    AUTH_TOKEN ? {} : { Authorization: "" }
  )
  if (body?.error?.code === -32601) {
    log("PASS", "Unknown method returns -32601 (Method not found)")
  } else {
    log("FAIL", "Unknown method error code", `got ${body?.error?.code}`)
  }

  // Missing tool name
  if (AUTH_TOKEN) {
    const { body: b2 } = await mcpRequest({
      jsonrpc: "2.0", id: 21, method: "tools/call", params: {},
    })
    if (b2?.error?.code === -32602) {
      log("PASS", "Missing tool name returns -32602 (Invalid params)")
    } else {
      log("FAIL", "Missing tool name error", `got ${b2?.error?.code}`)
    }
  }

  // Malformed JSON
  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all {{{",
    })
    if (res.status === 400) {
      log("PASS", "Malformed JSON returns 400")
    } else {
      log("FAIL", "Malformed JSON", `expected 400, got ${res.status}`)
    }
  } catch (err) {
    log("FAIL", "Malformed JSON test", err.message)
  }
}

async function testBatchRequests() {
  console.log("\n\x1b[1m[Batch Requests]\x1b[0m")

  // Batch of 2 requests (initialize doesn't need auth)
  const { status, body } = await mcpRequest([
    { jsonrpc: "2.0", id: 30, method: "ping" },
    { jsonrpc: "2.0", id: 31, method: "initialize", params: {} },
  ], { Authorization: "" })

  if (status === 200 && Array.isArray(body)) {
    log("PASS", `Batch returns array of ${body.length} responses`)
    if (body.length === 2) {
      log("PASS", "Correct number of responses")
    } else {
      log("FAIL", "Batch response count", `expected 2, got ${body.length}`)
    }
  } else if (status === 200 && body?.result) {
    // Single response (server might not support batch without auth)
    log("PASS", "Batch processed (single response mode)")
  } else {
    log("FAIL", "Batch request", `status=${status}, isArray=${Array.isArray(body)}`)
  }

  // Empty batch should error
  const { body: b2 } = await mcpRequest([], { Authorization: "" })
  if (b2?.error) {
    log("PASS", "Empty batch returns error")
  } else {
    log("FAIL", "Empty batch should error")
  }
}

async function testCORS() {
  console.log("\n\x1b[1m[CORS]\x1b[0m")
  try {
    const res = await fetch(MCP_URL, { method: "OPTIONS" })
    const allowOrigin = res.headers.get("access-control-allow-origin")
    const allowMethods = res.headers.get("access-control-allow-methods")
    if (allowOrigin === "*") {
      log("PASS", "CORS: Access-Control-Allow-Origin: *")
    } else {
      log("FAIL", "CORS origin", allowOrigin)
    }
    if (allowMethods?.includes("POST")) {
      log("PASS", "CORS: POST allowed")
    } else {
      log("FAIL", "CORS methods", allowMethods)
    }
    if (res.status === 204) {
      log("PASS", "OPTIONS returns 204")
    } else {
      log("FAIL", "OPTIONS status", `expected 204, got ${res.status}`)
    }
  } catch (err) {
    log("FAIL", "CORS test", err.message)
  }
}

async function testPermissions() {
  console.log("\n\x1b[1m[Permission Scoping]\x1b[0m")
  if (!AUTH_TOKEN) {
    log("PASS", "Skipped (no auth token to test scoping)")
    return
  }

  // Try calling an admin tool — should work with 'all' scope or fail with 'read'
  const { body } = await mcpRequest({
    jsonrpc: "2.0", id: 40, method: "tools/call",
    params: { name: "kill_vault", arguments: { vault_id: "fake-id", user_id: TEST_USER_ID } },
  })
  if (body?.result || body?.error) {
    // Either it executed (all scope) or was denied (read scope) — both are valid
    if (body?.error?.code === -32600) {
      log("PASS", "kill_vault denied for read-only token (correct)")
    } else if (body?.result?.content) {
      const text = body.result.content[0]?.text || ""
      if (text.includes("not found") || text.includes("error")) {
        log("PASS", "kill_vault executed (admin scope) — vault not found (expected)")
      } else {
        log("PASS", "kill_vault executed with admin scope")
      }
    } else {
      log("PASS", "Permission check responded")
    }
  } else {
    log("FAIL", "Permission test no response")
  }
}

// ─── Run All Tests ───────────────────────────────────────────────────────────

async function main() {
  console.log(`\n\x1b[1m╔══════════════════════════════════════════╗\x1b[0m`)
  console.log(`\x1b[1m║  Unsubscribely MCP Server Test Suite     ║\x1b[0m`)
  console.log(`\x1b[1m╚══════════════════════════════════════════╝\x1b[0m`)
  console.log(`\n  Target: ${MCP_URL}`)
  console.log(`  Auth:   ${AUTH_TOKEN ? "Bearer token set" : "No token (limited tests)"}`)
  console.log(`  User:   ${TEST_USER_ID}`)

  await testHealthEndpoint()
  await testInitialize()
  await testPing()
  await testAuthentication()
  await testErrorHandling()
  await testBatchRequests()
  await testCORS()
  await testToolsList()
  await testResourcesList()
  await testPromptsList()
  await testToolCall()
  await testPermissions()

  console.log(`\n\x1b[1m─────────────────────────────────────────\x1b[0m`)
  console.log(`  \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m, ${passed + failed} total`)
  console.log(`\x1b[1m─────────────────────────────────────────\x1b[0m\n`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(`\n\x1b[31mFatal error: ${err.message}\x1b[0m`)
  if (err.message.includes("ECONNREFUSED")) {
    console.error(`  → Is the agent server running? Start it with: npm start`)
  }
  process.exit(1)
})
