import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ALGOD_SERVER = "https://testnet-api.algonode.cloud"

async function compileTeal(source: string): Promise<string> {
  const res = await fetch(`${ALGOD_SERVER}/v2/teal/compile`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: source })
  if (!res.ok) throw new Error(`TEAL compilation failed: ${await res.text()}`)
  return (await res.json()).result
}

const CLEAR = `#pragma version 10\nint 1\nreturn\n`

const HEADER = `#pragma version 10
txn ApplicationID
int 0
==
bnz handle_create
txn OnCompletion
int DeleteApplication
==
bnz handle_delete
txn OnCompletion
int NoOp
==
bnz handle_call
txn OnCompletion
int OptIn
==
bnz handle_optin
int 0
return
handle_optin:
int 1
return
`

const DELETE_BLOCK = `handle_delete:
txn Sender
byte "creator"
app_global_get
==
assert
byte "status"
app_global_get
int 0
!=
assert
int 1
return
`

const RELEASE_PAY = `itxn_begin
int pay
itxn_field TypeEnum
byte "recipient"
app_global_get
itxn_field Receiver
global CurrentApplicationAddress
balance
global CurrentApplicationAddress
min_balance
-
itxn_field Amount
int 0
itxn_field Fee
itxn_submit
byte "status"
int 1
app_global_put
int 1
return
`

const KILL_PAY = `itxn_begin
int pay
itxn_field TypeEnum
byte "creator"
app_global_get
itxn_field Receiver
global CurrentApplicationAddress
balance
global CurrentApplicationAddress
min_balance
-
itxn_field Amount
int 0
itxn_field Fee
itxn_submit
byte "status"
int 2
app_global_put
int 1
return
`

const STANDARD = HEADER + `handle_create:
txn NumAppArgs
int 1
==
assert
byte "creator"
txn Sender
app_global_put
byte "recipient"
txn ApplicationArgs 0
app_global_put
byte "status"
int 0
app_global_put
int 1
return
handle_call:
txn Sender
byte "creator"
app_global_get
==
assert
byte "status"
app_global_get
int 0
==
assert
txn ApplicationArgs 0
byte "release"
==
bnz do_release
txn ApplicationArgs 0
byte "kill"
==
bnz do_kill
int 0
return
do_release:
` + RELEASE_PAY + `do_kill:
` + KILL_PAY + DELETE_BLOCK

const TIME_LOCKED = HEADER + `handle_create:
txn NumAppArgs
int 2
==
assert
byte "creator"
txn Sender
app_global_put
byte "recipient"
txn ApplicationArgs 0
app_global_put
byte "unlock_time"
txn ApplicationArgs 1
btoi
app_global_put
byte "status"
int 0
app_global_put
int 1
return
handle_call:
txn Sender
byte "creator"
app_global_get
==
assert
byte "status"
app_global_get
int 0
==
assert
txn ApplicationArgs 0
byte "release"
==
bnz do_release
txn ApplicationArgs 0
byte "kill"
==
bnz do_kill
int 0
return
do_release:
global LatestTimestamp
byte "unlock_time"
app_global_get
>=
assert
` + RELEASE_PAY + `do_kill:
` + KILL_PAY + DELETE_BLOCK

const MULTI_SIG = HEADER + `handle_create:
txn NumAppArgs
int 2
==
assert
byte "creator"
txn Sender
app_global_put
byte "recipient"
txn ApplicationArgs 0
app_global_put
byte "co_signer"
txn ApplicationArgs 1
app_global_put
byte "status"
int 0
app_global_put
byte "creator_approved"
int 0
app_global_put
byte "cosigner_approved"
int 0
app_global_put
int 1
return
handle_call:
txn Sender
byte "creator"
app_global_get
==
txn Sender
byte "co_signer"
app_global_get
==
||
assert
byte "status"
app_global_get
int 0
==
assert
txn ApplicationArgs 0
byte "approve"
==
bnz do_approve
txn ApplicationArgs 0
byte "kill"
==
bnz do_kill
int 0
return
do_approve:
txn Sender
byte "creator"
app_global_get
==
bnz set_creator_approved
byte "cosigner_approved"
int 1
app_global_put
b check_both
set_creator_approved:
byte "creator_approved"
int 1
app_global_put
check_both:
byte "creator_approved"
app_global_get
byte "cosigner_approved"
app_global_get
&&
bnz auto_release
int 1
return
auto_release:
` + RELEASE_PAY + `do_kill:
txn Sender
byte "creator"
app_global_get
==
assert
` + KILL_PAY + DELETE_BLOCK

const DISPUTE = HEADER + `handle_create:
txn NumAppArgs
int 2
==
assert
byte "creator"
txn Sender
app_global_put
byte "recipient"
txn ApplicationArgs 0
app_global_put
byte "arbitrator"
txn ApplicationArgs 1
app_global_put
byte "status"
int 0
app_global_put
int 1
return
handle_call:
txn Sender
byte "creator"
app_global_get
==
txn Sender
byte "arbitrator"
app_global_get
==
||
assert
byte "status"
app_global_get
int 0
==
assert
txn ApplicationArgs 0
byte "release"
==
bnz do_release
txn ApplicationArgs 0
byte "kill"
==
bnz do_kill
int 0
return
do_release:
` + RELEASE_PAY + `do_kill:
` + KILL_PAY + DELETE_BLOCK

const ASA = HEADER + `handle_create:
txn NumAppArgs
int 2
==
assert
byte "creator"
txn Sender
app_global_put
byte "recipient"
txn ApplicationArgs 0
app_global_put
byte "asset_id"
txn ApplicationArgs 1
btoi
app_global_put
byte "status"
int 0
app_global_put
int 1
return
handle_call:
txn Sender
byte "creator"
app_global_get
==
assert
txn ApplicationArgs 0
byte "optin"
==
bnz do_optin
byte "status"
app_global_get
int 0
==
assert
txn ApplicationArgs 0
byte "release"
==
bnz do_release
txn ApplicationArgs 0
byte "kill"
==
bnz do_kill
int 0
return
do_optin:
itxn_begin
int axfer
itxn_field TypeEnum
global CurrentApplicationAddress
itxn_field AssetReceiver
byte "asset_id"
app_global_get
itxn_field XferAsset
int 0
itxn_field AssetAmount
int 0
itxn_field Fee
itxn_submit
int 1
return
do_release:
itxn_begin
int axfer
itxn_field TypeEnum
byte "recipient"
app_global_get
itxn_field AssetReceiver
byte "asset_id"
app_global_get
itxn_field XferAsset
byte "recipient"
app_global_get
itxn_field AssetCloseTo
int 0
itxn_field AssetAmount
int 0
itxn_field Fee
itxn_submit
byte "status"
int 1
app_global_put
int 1
return
do_kill:
itxn_begin
int axfer
itxn_field TypeEnum
byte "creator"
app_global_get
itxn_field AssetReceiver
byte "asset_id"
app_global_get
itxn_field XferAsset
byte "creator"
app_global_get
itxn_field AssetCloseTo
int 0
itxn_field AssetAmount
int 0
itxn_field Fee
itxn_submit
byte "status"
int 2
app_global_put
int 1
return
` + DELETE_BLOCK

const PROGRAMS: Record<string, { approval: string; globalSchema: { numUints: number; numByteSlices: number } }> = {
  standard: { approval: STANDARD, globalSchema: { numUints: 1, numByteSlices: 2 } },
  time_locked: { approval: TIME_LOCKED, globalSchema: { numUints: 2, numByteSlices: 2 } },
  multi_sig: { approval: MULTI_SIG, globalSchema: { numUints: 3, numByteSlices: 3 } },
  dispute: { approval: DISPUTE, globalSchema: { numUints: 1, numByteSlices: 3 } },
  asa: { approval: ASA, globalSchema: { numUints: 2, numByteSlices: 2 } },
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const type = body.type || "standard"
    const program = PROGRAMS[type]
    if (!program) {
      return new Response(JSON.stringify({ error: `Invalid vault type: ${type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const [approvalB64, clearB64] = await Promise.all([compileTeal(program.approval), compileTeal(CLEAR)])

    return new Response(JSON.stringify({
      approval: approvalB64, clear: clearB64,
      globalSchema: program.globalSchema,
      localSchema: { numUints: 0, numByteSlices: 0 },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
