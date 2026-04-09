# Unsubscribely

A DeFi-powered subscription management platform built on the Algorand blockchain.

## Overview

Unsubscribely allows users to manage recurring payments using on-chain escrow vaults with programmable release conditions (time-locks, multi-sig, dispute resolution), mints ARC-3 NFT payment receipts, and features an AI-driven spending optimizer powered by Google Gemini.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Build Tool**: Vite 7
- **Blockchain**: Algorand (TEAL smart contracts, algosdk, multi-wallet via @txnlab/use-wallet-react v4)
- **Smart Contracts**: Algorand Python (ARC-4 compliant, via AlgoKit)
- **Backend/BaaS**: Supabase (PostgreSQL, Row Level Security, Auth, Edge Functions)
- **AI**: Google Gemini 2.5 Flash (via Supabase Edge Functions)
- **Python Runtime**: Python 3.12

## Project Structure

- `src/` — Main frontend source
  - `components/` — UI components organized by feature (algorand, analytics, dashboard, landing, ui)
  - `pages/` — Application views (Marketing, Auth, Dashboard)
  - `layouts/` — Persistent UI wrappers
  - `lib/` — Core logic (Algorand helpers, Supabase client, utilities)
  - `models/` — TypeScript interfaces
  - `integrations/` — Generated Supabase client and types
- `supabase/` — Backend config, edge functions, and migrations
- `public/` — Static assets
- `smart_contracts/` — AlgoKit / Algorand Python ARC-4 smart contracts
  - `escrow/contract.py` — Standard Escrow Vault
  - `time_locked/contract.py` — Time-Locked Escrow Vault
  - `multi_sig/contract.py` — Multi-Signature Escrow Vault
  - `dispute/contract.py` — Dispute-Resolution Escrow Vault
  - `asa_escrow/contract.py` — ASA Token Escrow Vault
  - `artifacts/` — Compiled TEAL + ARC-32 specs (generated, gitignored)
- `scripts/` — Build and deployment automation
  - `build.py` — Compile contracts and generate TypeScript clients
  - `deploy.py` — Deploy all 5 contracts to Testnet
- `tests/` — pytest integration tests for all vault types
- `frontend_integration/clients/` — Generated TypeScript ABI clients

## Frontend Development

```bash
npm install --legacy-peer-deps
npm run dev
```

The dev server runs on port 5000 at `0.0.0.0`.

Note: `--legacy-peer-deps` is required due to a peer dependency conflict between `algosdk@3.x` (project) and `@perawallet/connect` (which expects `algosdk@2.x`).

## A2A Autonomous Agent (Agentic Commerce #3)

Unsubscribely implements the Agentic Commerce #3 (A2A Autonomous Payments) track for AlgoBharat Hack Series 3.0.

### How It Works

1. User creates a **Standard** escrow vault — this deploys an `AgentEscrowVault` ARC-4 contract on Algorand Testnet, embedding BOTH the user's wallet AND the agent wallet as authorized releasers.
2. The **agent wallet** (`NLJE4ZCTVQTOG4JPZ3EABZ63BON5M2XGKD5NDN77M33DCWUF5AC2DLWA5U`) is authorized via the `create(address,address)void` constructor.
3. A Supabase Edge Function `auto-release-vaults` runs daily (via pg_cron at 00:05 UTC) — it calls `release()void` on each locked standard vault whose linked subscription billing date is due, using the agent wallet's mnemonic.
4. The `release()void` method transfers all ALGO from the vault to the recipient (subscription service). The contract allows either the creator (user) OR the agent to trigger release — enabling true autonomous, trustless payments.

### Agent Wallet

- **Address**: `NLJE4ZCTVQTOG4JPZ3EABZ63BON5M2XGKD5NDN77M33DCWUF5AC2DLWA5U`
- **Fund**: [Algorand Testnet Bank](https://bank.testnet.algorand.network/)
- **Mnemonic**: Must be set as `AGENT_WALLET_MNEMONIC` secret in Supabase Dashboard → Project Settings → Edge Functions

### AgentEscrowVault Contract

- Located in: `smart_contracts/agent_escrow/contract.py` (Python source) and `smart_contracts/artifacts/AgentEscrowVault/` (compiled TEAL + ARC56 JSON)
- ARC-4 methods: `create(address,address)void`, `release()void`, `kill()void`, `delete()void`
- Global state: `creator` (bytes), `recipient` (bytes), `agent` (bytes), `status` (uint64)
- Release selector: `0x07 0x6b 0xbd 0x4d` (sha512_256("release()void")[0:4])
- Create selector: `0x8a 0x96 0x98 0x0e` (sha512_256("create(address,address)void")[0:4])

### Env Vars Required

- `VITE_AGENT_WALLET_ADDRESS` — set in Replit shared env vars (public address, auto-fills in vault UI)
- `AGENT_WALLET_MNEMONIC` — set as Supabase secret (25-word mnemonic, used by edge function)

## Smart Contract Development (AlgoKit)

```bash
# Build (compile + generate TS clients)
python scripts/build.py

# Deploy to Testnet (requires TESTNET_MNEMONIC in .env)
python scripts/deploy.py

# Run tests (requires TESTNET_MNEMONIC in .env)
pytest tests/test_escrow.py -v -m integration
```

### Environment Variables for Contracts

Create a `.env` file (gitignored):
```
TESTNET_MNEMONIC="word1 word2 ... word25"
ALGOD_URL=https://testnet-api.algonode.cloud
ALGOD_TOKEN=
```

## Frontend Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key

## Deployment

Static site deployment — builds with `npm run build` and serves the `dist/` directory.

## Package Notes

- Python packages: `algorand-python>=3.4.0`, `algokit-utils>=4.2.3`, `py-algorand-sdk>=2.11.1`, `pytest`, `python-dotenv`
- Node packages installed with `--legacy-peer-deps` due to algosdk version conflict
