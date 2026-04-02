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
