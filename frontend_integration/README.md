# Frontend Integration — TypeScript AlgoKit Clients

This directory contains auto-generated TypeScript clients derived from the ARC-32 application
specs produced by `algokit compile python`.

## How to regenerate

```bash
python scripts/build.py
```

or step by step:

```bash
# 1. Compile contracts → smart_contracts/artifacts/<ContractName>/
algokit compile python smart_contracts/escrow/contract.py   --out-dir smart_contracts/artifacts/EscrowVault
algokit compile python smart_contracts/time_locked/contract.py --out-dir smart_contracts/artifacts/TimeLockEscrow
algokit compile python smart_contracts/multi_sig/contract.py  --out-dir smart_contracts/artifacts/MultiSigEscrow
algokit compile python smart_contracts/dispute/contract.py    --out-dir smart_contracts/artifacts/DisputeEscrow
algokit compile python smart_contracts/asa_escrow/contract.py --out-dir smart_contracts/artifacts/ASAEscrow

# 2. Generate TS clients from ARC-32 specs
algokit generate client smart_contracts/artifacts/EscrowVault/application.json    --output frontend_integration/clients/EscrowVaultClient.ts    --language typescript
algokit generate client smart_contracts/artifacts/TimeLockEscrow/application.json --output frontend_integration/clients/TimeLockEscrowClient.ts --language typescript
algokit generate client smart_contracts/artifacts/MultiSigEscrow/application.json --output frontend_integration/clients/MultiSigEscrowClient.ts --language typescript
algokit generate client smart_contracts/artifacts/DisputeEscrow/application.json  --output frontend_integration/clients/DisputeEscrowClient.ts  --language typescript
algokit generate client smart_contracts/artifacts/ASAEscrow/application.json      --output frontend_integration/clients/ASAEscrowClient.ts      --language typescript
```

## Copying clients to your frontend

Once generated, copy any `*Client.ts` file from `clients/` into your `src/lib/algorand/` directory
and import the typed client to replace manual `algosdk.makeApplicationCreateTxnFromObject` calls.
