# Agent Rules — Unsubscribely Payment Agent

Operational rules that the agent **must** follow on every tick.
These rules are hard constraints — the LLM brain applies them before
deciding whether to proceed with any action.

---

## Pre-Release Checks

1. **Billing date gate** — never release a vault if
   `subscription.next_billing_date > today`.
2. **Idempotency lock** — acquire a lock keyed on `(vault_id, billing_date)`.
   If the lock already exists, skip.
3. **Guardrail: budget cap** — if `subscription_guardrails.budget_cap` is set
   and `vault.amount > budget_cap`, skip and notify the user.
4. **Guardrail: trial end** — if `subscription_guardrails.trial_end_date` is in
   the future, skip and notify the user.
5. **Guardrail: pause flag** — if
   `subscription_guardrails.pause_before_paid_renewal = true`, skip and ask the
   user to confirm before releasing.

## Release Rules

6. **Network verification** — always check the vault's `network` column before
   signing. Never submit a testnet txn to mainnet or vice-versa.
7. **Vault type dispatch** —
   - `agent_v2` → `release(uint64)uint64` with box ref
   - `agent` / `standard` → `release()void`
   - `asa` → `release()void` with ASA opt-in + foreignAssets
8. **Fee budget** — set `flatFee: true` with 2 000 microALGO (3 000 for ASA).
   Never allow unbounded fees.
9. **Confirmation** — wait for on-chain confirmation (`waitForConfirmation`,
   4 rounds). Verify `confirmed-round` is set and `pool-error` is absent.

## Post-Release

10. **DB sync** — update `escrow_vaults.status = 'released'` with `txn_id` and
    `released_at`.
11. **Log action** — insert into `agent_actions` with `action_type`,
    `vault_id`, `txid`, `mode`, and a timestamped payload.
12. **Advance billing** — compute the next billing date from the subscription's
    `billing_cycle` (weekly / monthly / quarterly / yearly) and update
    `subscriptions.next_billing_date`.
13. **Notify user** — send a Telegram message with the subscription name,
    amount, txid, and Lora explorer link.

## x402 Rules

14. **402 detection** — if an HTTP response returns status 402, parse the
    `accepts` array from the JSON body.
15. **Payment construction** — build an Algorand Payment txn for
    `maxAmountRequired` microALGO to `payTo`. Sign with the agent wallet.
16. **Retry** — resubmit the original request with `X-PAYMENT` header
    containing the base64-encoded signed txn.
17. **Receipt** — read `X-PAYMENT-RESPONSE` header for the payment txid.
    Log it in `agent_actions.payload`.
18. **Replay protection** — never reuse a signed payment txn. Each 402
    challenge requires a fresh transaction.

## Safety Nets

19. **Balance watchdog** — if agent wallet balance < 0.1 ALGO (testnet) or
    < 0.5 ALGO (mainnet), log a warning and notify the user. Do not attempt
    releases that would fail due to insufficient fees.
20. **Error escalation** — after 3 consecutive failures for the same vault,
    stop retrying and notify the user with the error details.
21. **Clock skew** — use UTC everywhere. Never compare dates in local time.
22. **Graceful shutdown** — on SIGTERM / SIGINT, finish the current vault
    (do not interrupt a half-signed txn) then exit cleanly.
