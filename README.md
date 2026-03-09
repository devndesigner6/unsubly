# Unsubscribely

> **AlgoBharat Hack Series 3.0** — Future of Finance × Agentic Commerce

A DeFi-powered subscription management platform on Algorand. Users lock funds in on-chain escrow vaults (time-locked, multi-sig, dispute-resolution), receive ARC-3 NFT payment receipts, and get AI-driven spending optimization — all from a single dashboard.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Algorand](https://img.shields.io/badge/Algorand-AVM-black?logo=algorand&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Problem Statement

Recurring subscription payments are opaque, hard to track, and impossible to govern on-chain. Users have no escrow protection, no programmable release conditions, and no transparent audit trail for their subscription spending.

## Solution

Unsubscribely brings subscription payments on-chain with **5 types of Algorand escrow vaults**, an **AI spending optimizer**, and full **ARC-standard compliance**.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│   Dashboard · Analytics · Calendar · AI Agent    │
├──────────┬──────────┬───────────┬───────────────┤
│  Pera    │ Algorand │ Supabase  │  Edge         │
│  Wallet  │ AVM      │ Postgres  │  Functions    │
│  Connect │ (TEAL)   │  + RLS    │  (Deno)       │
├──────────┴──────────┴───────────┴───────────────┤
│              Algorand Testnet / Mainnet          │
│   ARC-2 Notes · ARC-3 NFTs · ARC-4 ABI Calls    │
└─────────────────────────────────────────────────┘
```

## Hackathon Tracks

### 🏦 Future of Finance
- **5 Escrow Vault Types**: Standard, Time-Locked, Multi-Sig, Dispute-Resolution, ASA-Based
- **ARC-3 NFT Receipts**: Immutable on-chain payment proof minted after vault release
- **ARC-2 Transaction Notes**: Structured metadata on every transaction
- **ARC-4 ABI Methods**: Standardized smart contract interfaces
- **Kill Switch**: Emergency fund recovery mechanism on all vaults

### 🤖 Agentic Commerce
- **AI Spending Optimizer**: Gemini-powered agent analyzes subscription portfolio and vault allocations
- **Risk Assessment**: Vault health scoring across lock duration, amount concentration, and diversification
- **Actionable Recommendations**: Automated suggestions for consolidation, cancellation, and reallocation

---

## Features

| Feature | Description |
|---------|-------------|
| **Escrow Vaults** | Lock subscription funds on Algorand with programmable release conditions |
| **Time Locks** | Funds auto-release after configurable unlock dates |
| **Multi-Sig** | Co-signer approval required before fund release |
| **Dispute Resolution** | Third-party arbitrator for contested payments |
| **ASA Vaults** | Lock Algorand Standard Assets (not just ALGO) |
| **NFT Receipts** | ARC-3 compliant receipts minted on vault release |
| **AI Optimizer** | Portfolio analysis with actionable cost-saving insights |
| **Subscription Tracker** | Full CRUD with folders, tags, categories, multi-currency |
| **Analytics Dashboard** | Spending trends, category breakdowns, payment calendars |
| **On-Chain Resume** | Shareable public view of your Algorand payment history |
| **Payment Alerts** | Configurable email reminders before billing dates |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS, Recharts |
| Blockchain | Algorand SDK (algosdk 3.x), AlgoKit Utils, Pera Wallet Connect |
| Backend | Supabase (Postgres + RLS + Edge Functions) |
| AI | Google Gemini 2.5 Flash (via Lovable AI gateway) |
| Smart Contracts | TEAL v10 (AVM) |

---

## Project Structure

```
src/
├── components/
│   ├── algorand/          # WalletConnect, CreateVaultModal, EscrowVaultCard
│   ├── analytics/         # Spending charts & breakdowns
│   ├── dashboard/         # Metrics, recent subs, upcoming payments
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
│   │   ├── EscrowVaultsPage.tsx
│   │   ├── VaultDetailsPage.tsx
│   │   ├── AIOptimizerPage.tsx
│   │   └── ...
│   └── auth/              # Login, Register, Password reset
├── models/                # TypeScript interfaces
└── data/                  # Static data & pSEO content

supabase/
├── functions/
│   ├── ai-optimizer/      # Gemini-powered portfolio analysis
│   ├── algorand-compile/  # Server-side TEAL compilation
│   ├── vault-health/      # Vault status monitoring
│   └── advance-billing/   # Automated billing cycle advancement
└── migrations/            # Database schema (managed)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Pera Wallet](https://perawallet.app/) (mobile or web)
- Algorand Testnet account funded via [dispenser](https://dispenser.testnet.aws.algodev.network/)

### Install & Run

```bash
git clone https://github.com/kalashvasaniya/unsubscribely.git
cd unsubscribely
npm install
npm run dev
```

Open `http://localhost:8080`

### Environment Variables

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

---

## Smart Contract Design

### Vault Lifecycle

```
Create → Fund → [Time Lock / Co-Sign / Arbitrate] → Release → Mint Receipt
                                                        ↓
                                                   Kill Switch
                                               (Emergency Recovery)
```

### TEAL Contract Highlights

- **Global State**: `receiver`, `amount`, `is_funded`, `is_released`, `kill_switch`
- **ABI Methods**: `fund()`, `release()`, `activate_kill_switch()`, `approve_cosigner()`
- **Minimum Balance**: 0.3 ALGO reserved for contract operations
- **Network Aware**: Automatic Testnet/Mainnet switching via Pera Wallet

---

## ARC Compliance

| Standard | Usage |
|----------|-------|
| **ARC-2** | Structured transaction notes (`unsubscribely:j{...}`) |
| **ARC-3** | NFT receipt metadata (name, description, properties) |
| **ARC-4** | ABI method signatures for contract interaction |
| **ARC-32** | Application specification compliance |

---

## Demo Flow

1. **Connect Pera Wallet** on Testnet
2. **Add subscriptions** (Netflix, Spotify, etc.) with amounts & billing cycles
3. **Create an Escrow Vault** — choose Standard, Time-Locked, or Multi-Sig
4. **Fund the vault** from connected wallet
5. **Release funds** when conditions are met
6. **Mint ARC-3 NFT receipt** as on-chain proof
7. **Run AI Optimizer** to get spending insights & vault health scores
8. **View Analytics** — charts, calendars, category breakdowns

---

## Screenshots

> Add screenshots of: Dashboard, Vault Creation, AI Optimizer, NFT Receipt

---

## Team

- **Kalash Vasaniya** — Full-stack development, smart contract design, AI integration

---

## License

[MIT](LICENSE.md)
