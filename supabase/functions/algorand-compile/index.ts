import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// TEAL v10 Escrow Vault Contract
// Features:
// - Creator deposits ALGO into the app account
// - Creator can release funds to a designated recipient via inner transaction
// - Creator can kill (return funds to self) via inner transaction
// - Global state tracks: recipient, status (0=locked, 1=released, 2=killed)
const APPROVAL_PROGRAM = `#pragma version 10

// Handle creation
txn ApplicationID
int 0
==
bnz handle_create

// Handle DeleteApplication
txn OnCompletion
int DeleteApplication
==
bnz handle_delete

// Handle NoOp (function calls)
txn OnCompletion
int NoOp
==
bnz handle_call

// Handle OptIn - allow
txn OnCompletion
int OptIn
==
bnz handle_optin

// Reject everything else
int 0
return

handle_optin:
int 1
return

handle_create:
// Expect 1 arg: recipient address
txn NumAppArgs
int 1
==
assert

// Store creator
byte "creator"
txn Sender
app_global_put

// Store recipient
byte "recipient"
txn ApplicationArgs 0
app_global_put

// Set status to locked (0)
byte "status"
int 0
app_global_put

int 1
return

handle_call:
// Only creator can call
txn Sender
byte "creator"
app_global_get
==
assert

// Check status is still locked (0)
byte "status"
app_global_get
int 0
==
assert

// Route by action arg
txn ApplicationArgs 0
byte "release"
==
bnz do_release

txn ApplicationArgs 0
byte "kill"
==
bnz do_kill

// Unknown action
int 0
return

do_release:
// Send funds to recipient via inner transaction
itxn_begin
  int pay
  itxn_field TypeEnum

  byte "recipient"
  app_global_get
  itxn_field Receiver

  // Send all balance minus minimum (0.1 ALGO for MBR)
  global CurrentApplicationAddress
  balance
  global CurrentApplicationAddress
  min_balance
  -
  itxn_field Amount

  int 0
  itxn_field Fee
itxn_submit

// Update status to released (1)
byte "status"
int 1
app_global_put

int 1
return

do_kill:
// Return funds to creator via inner transaction
itxn_begin
  int pay
  itxn_field TypeEnum

  byte "creator"
  app_global_get
  itxn_field Receiver

  // Send all balance minus minimum
  global CurrentApplicationAddress
  balance
  global CurrentApplicationAddress
  min_balance
  -
  itxn_field Amount

  int 0
  itxn_field Fee
itxn_submit

// Update status to killed (2)
byte "status"
int 2
app_global_put

int 1
return

handle_delete:
// Only creator can delete
txn Sender
byte "creator"
app_global_get
==
assert

// Only allow delete if released or killed (status != 0)
byte "status"
app_global_get
int 0
!=
assert

int 1
return
`

const CLEAR_PROGRAM = `#pragma version 10
int 1
return
`

const ALGOD_SERVER = "https://testnet-api.algonode.cloud"

async function compileTeal(source: string): Promise<string> {
  const response = await fetch(`${ALGOD_SERVER}/v2/teal/compile`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: source,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`TEAL compilation failed: ${error}`)
  }

  const result = await response.json()
  return result.result // base64-encoded compiled bytes
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Compile both programs
    const [approvalB64, clearB64] = await Promise.all([
      compileTeal(APPROVAL_PROGRAM),
      compileTeal(CLEAR_PROGRAM),
    ])

    return new Response(
      JSON.stringify({
        approval: approvalB64,
        clear: clearB64,
        globalSchema: { numUints: 1, numByteSlices: 2 }, // status (uint), creator + recipient (bytes)
        localSchema: { numUints: 0, numByteSlices: 0 },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Compilation error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
