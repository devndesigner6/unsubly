# Agent Operating Rules

## Hard Rules — Never Break These

1. NEVER release a vault before its subscription next_billing_date
2. NEVER release the same vault twice in the same billing period (idempotency lock)
3. NEVER release if vault.status is not "locked"
4. NEVER release a non-agent vault type (standard, multi_sig, dispute require creator signature)
5. ALWAYS check guardrails before releasing
6. ALWAYS log every action to agent_actions table regardless of outcome
7. ALWAYS notify the user via Telegram after every release attempt
8. ALWAYS release the idempotency lock if a release fails so retry works next cycle

## Guardrail Rules

- If vault.amount > guardrails.budget_cap → SKIP, notify user
- If guardrails.trial_end_date is in the future → SKIP, notify user
- If guardrails.pause_before_paid_renewal = true → SKIP, ask user to confirm

## Error Rules

- If on-chain release fails → log error, release idempotency lock, notify user
- If agent wallet balance < 0.002 ALGO → alert immediately, skip all releases
- Max 3 retry attempts across cycles for the same vault

## Notification Rules

- Every successful release: send Telegram with txid and Lora Explorer link
- Every skip: send Telegram explaining why
- Every failure: send Telegram with error message and manual release instructions
- Low balance: send Telegram alert immediately
