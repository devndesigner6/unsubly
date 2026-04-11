# Unsubscribely

A DeFi-powered subscription management platform built on Algorand. Track subscriptions, lock funds in on-chain escrow vaults, receive ARC-3 NFT payment receipts, and let an autonomous agent handle payment releases automatically — no manual intervention required.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Algorand](https://img.shields.io/badge/Algorand-AVM-black?logo=algorand&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Problem Statement

Recurring subscription payments are opaque, hard to track, and impossible to govern on-chain. Users have no escrow protection, no programmable release conditions, and no transparent audit trail for their subscription spending. Renewals happen silently — there's no agent watching for you.

## Solution

Unsubscribely brings subscription payments on-chain with **5 types of Algorand escrow vaults**, a **fully autonomous payment agent** that watches billing dates and releases vaults automatically (A2A — no human click required), an **AI spending optimizer**, and full **ARC-standard compliance**.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    React 19 Frontend                      │
│   Dashboard · Vaults · Analytics · AI Optimizer · Agent  │
├──────────┬───────────┬────────────┬──────────────────────┤
│  Pera /  │ Algorand  │  Supabase  │  Edge Functions      │
│  Defly / │ AVM (TEAL)│  Postgres  │  auto-release-vaults │
│  Lute    │ AlgoNode  │  + RLS     │  ai-optimizer        │
│  Wallet  │ Testnet   │  pg_cron   │  algorand-compile    │
├──────────┴───────────┴────────────┴──────────────────────┤
│                  Algorand Testnet / Mainnet               │
│      ARC-2 Notes · ARC-3 NFTs · ARC-4 ABI Calls         │
└──────────────────────────────────────────────────────────┘
```

---

## On-Chain Capabilities

### 🏦 Escrow Vaults
- **5 Vault Types**: Standard, Time-Locked, Multi-Sig, Dispute-Resolution, ASA-Based
- **ARC-3 NFT Receipts**: Immutable on-chain payment proof minted after vault release
- **ARC-2 Transaction Notes**: Structured metadata on every transaction (`unsubscribely:j{...}`)
- **ARC-4 ABI Methods**: Standardized smart contract interfaces (`fund()`, `release()`, `activate_kill_switch()`)
- **Kill Switch**: Emergency fund recovery mechanism on all vault types
- **Lora Explorer Integration**: Every vault links directly to the live transaction on Lora

### 🤖 Autonomous Payment Agent
- **A2A Agent**: Runs daily via GitHub Actions, scans all due subscriptions across all users, and releases linked escrow vaults on-chain — no user action required
- **Agent Wallet**: A dedicated Algorand wallet signs and submits release transactions autonomously on behalf of users
- **Agent Activity Dashboard**: Live panel on the dashboard shows every autonomous action, timestamp, amount, on-chain mode badge, and a direct Lora Explorer link
- **AI Spending Optimizer**: Gemini-powered analysis of the subscription portfolio — risk scores, cost-saving recommendations, vault health metrics
- **Audit Trail**: Every agent action is logged to the `agent_actions` table with full payload and txid

---

## Features

| Feature | Description |
|---------|-------------|
| **Escrow Vaults** | Lock subscription funds on Algorand with programmable release conditions |
| **Time Locks** | Funds auto-release after configurable unlock dates |
| **Multi-Sig** | Co-signer approval required before fund release |
| **Dispute Resolution** | Third-party arbitrator for contested payments |
| **ASA Vaults** | Lock Algorand Standard Assets (not just ALGO) |
| **Autonomous Agent** | Watches billing dates and releases vaults automatically (A2A) |
| **NFT Receipts** | ARC-3 compliant receipts minted on vault release |
| **AI Optimizer** | Portfolio analysis with risk scores and cost-saving insights |
| **Subscription Tracker** | Full CRUD with folders, tags, categories, multi-currency |
| **Analytics Dashboard** | Spending trends, category breakdowns, payment calendars |
| **On-Chain Resume** | Shareable public view of your Algorand payment history |
| **Payment Alerts** | Configurable email reminders before billing dates |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS, Recharts |
| Blockchain | Algorand SDK (algosdk 3.x), AlgoKit Utils, Pera / Defly / Lute Wallet |
| Smart Contracts | TEAL v10 (AVM) — 5 contract types |
| Backend | Supabase (Postgres + RLS + Edge Functions + pg_cron) |
| AI | Google Gemini 2.5 Flash |
| Deployment | Algorand Testnet via AlgoNode public API |

---

## Project Structure

```
src/
├── components/
│   ├── algorand/          # WalletSelectorModal, CreateVaultModal, EscrowVaultCard
│   ├── analytics/         # Spending charts & breakdowns
│   ├── dashboard/         # Metrics, agent activity panel, recent subscriptions
│   ├── landing/           # Hero, Features, Pricing, CTA
│   └── ui/                # Design system (Button, Input, Select, Sidebar)
├── lib/
│   └── algorand/
│       ├── algokit.ts     # ARC-2/3 helpers, account validation
│       ├── constants.ts   # Network configs (Testnet/Mainnet)
│       ├── context.tsx    # React context for wallet state
│       └── contract.ts    # TEAL compilation, vault operations
├── pages/
│   ├── dashboard/
│   │   ├── DashboardPageContent.tsx   # Main dashboard + Agent Activity panel
│   │   ├── EscrowVaultsPage.tsx
│   │   ├── VaultDetailsPage.tsx
│   │   ├── AIOptimizerPage.tsx
│   │   └── OnChainResumePage.tsx
│   └── auth/              # Login, Register, Password reset, Auth callback

smart_contracts/
├── EscrowVault.approval.teal
├── TimeLockEscrow.approval.teal
├── MultiSigEscrow.approval.teal
├── DisputeEscrow.approval.teal
├── ASAEscrow.approval.teal
└── artifacts/deployed.json    # App IDs populated after deployment

scripts/
└── deploy.js              # Node.js deployment script for all 5 vault contracts

supabase/
├── functions/
│   ├── auto-release-vaults/   # Autonomous A2A agent (runs daily via pg_cron)
│   ├── ai-optimizer/          # Gemini-powered portfolio analysis
│   ├── algorand-compile/      # Server-side TEAL compilation
│   ├── vault-health/          # Vault status monitoring
│   └── advance-billing/       # Automated billing cycle advancement
└── migrations/                # Database schema (managed)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Pera Wallet](https://perawallet.app/) (mobile or web), [Defly](https://defly.app/), or [Lute](https://lute.app/)
- Algorand Testnet account funded via [Testnet Dispenser](https://bank.testnet.algorand.network/)

### Install & Run

```bash
git clone https://github.com/devndesigner6/unsubly.git
cd unsubly
npm install
npm run dev
```

Open `http://localhost:5000`

### Deploy Smart Contracts (Testnet)

```bash
# 1. Fund the deployer wallet
#    Address: PTX3S4RB5WBP2W5YPWLOMIJSBKWTYOIKFUFPS3LGVSGBLNRUZNJF6T7WYY
#    Faucet:  https://bank.testnet.algorand.network/

# 2. Deploy all 5 vault contracts
npm run deploy:contracts

# App IDs and Lora Explorer links are saved to smart_contracts/artifacts/deployed.json
```

### Environment Variables

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
TESTNET_MNEMONIC=<25-word deployer mnemonic>
AGENT_WALLET_MNEMONIC=<25-word agent wallet mnemonic>
```

---

## Smart Contract Design

### Vault Lifecycle

```
Create → Fund → [Time Lock / Co-Sign / Arbitrate] → Release → Mint ARC-3 Receipt
                                                        ↓
                                                   Kill Switch
                                               (Emergency Recovery)
```

### TEAL Contract Highlights

- **Global State**: `receiver`, `amount`, `is_funded`, `is_released`, `kill_switch`
- **ABI Methods**: `fund()`, `release()`, `activate_kill_switch()`, `approve_cosigner()`
- **Minimum Balance**: 0.3 ALGO reserved for contract operations
- **Network Aware**: Automatic Testnet/Mainnet switching via connected wallet

---

## Autonomous Agent — A2A Architecture

```
GitHub Actions Cron (daily 00:05 UTC)
    │
    ▼
agents/release-agent.mjs  (Node.js — runs in CI, no server required)
    │
    ├── Query Supabase: subscriptions WHERE next_billing_date <= today
    │
    ├── For each due subscription:
    │     ├── Find linked escrow vault (status = locked)
    │     ├── Build release() ARC-4 call (algosdk)
    │     ├── Sign with agent wallet (AGENT_WALLET_MNEMONIC secret)
    │     ├── Submit to Algorand Testnet via AlgoNode
    │     └── Patch escrow_vaults status → "released" + txid in DB
    │
    └── Dashboard reads agent_actions → shows live Activity panel
```

---

## ARC Compliance

| Standard | Usage |
|----------|-------|
| **ARC-2** | Structured transaction notes (`unsubscribely:j{...}`) |
| **ARC-3** | NFT receipt metadata (name, description, image, properties) |
| **ARC-4** | ABI method signatures for all contract interactions |
| **ARC-32** | Application specification compliance |

---

## Demo Flow

1. **Connect Wallet** — Pera, Defly, or Lute on Testnet
2. **Add Subscriptions** — Netflix, Spotify, etc. with amounts and billing cycles
3. **Create an Escrow Vault** — Standard, Time-Locked, Multi-Sig, Dispute, or ASA
4. **Fund the Vault** — signs and submits on Algorand Testnet, view on Lora Explorer
5. **Release Funds** — manually or wait for the autonomous agent to release automatically
6. **Mint ARC-3 NFT Receipt** — immutable on-chain proof of payment
7. **Run AI Optimizer** — get portfolio risk scores and cost-saving recommendations
8. **Watch Agent Activity** — dashboard panel shows every autonomous release with txid

---

## Screenshots

> _Coming soon — dashboard, vault creation, AI optimizer, agent activity panel_

---

## Team

- **mesuryabuilds** — Full-stack development, smart contract design, AI & agent integration

---

## License

[MIT](LICENSE)
