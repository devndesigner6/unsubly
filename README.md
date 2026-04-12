<div align="center">
  <a href="https://unsubly2.vercel.app">
    <img src="public/logo.svg" alt="Unsubscribely Logo" width="80" height="80">
  </a>

  <h1 align="center">Unsubscribely</h1>

  <p align="center">
    A DeFi-powered subscription management platform built on Algorand blockchain.
    <br />
    <strong>Track. Control. Save.</strong>
    <br /><br />
    <a href="https://unsubly2.vercel.app"><strong>View Live Demo »</strong></a>
    <br /><br />
    <a href="https://unsubly2.vercel.app">Live App</a>
    ·
    <a href="https://github.com/devndesigner6/unsubly/issues/new?labels=bug">Report Bug</a>
    ·
    <a href="https://github.com/devndesigner6/unsubly/issues/new?labels=enhancement">Request Feature</a>
  </p>

  <br />

  [![TypeScript][typescript-shield]][typescript-url]
  [![React][react-shield]][react-url]
  [![Algorand][algorand-shield]][algorand-url]
  [![AlgoKit][algokit-shield]][algokit-url]
  [![Supabase][supabase-shield]][supabase-url]
  [![Vercel][vercel-shield]][vercel-url]
  [![License][license-shield]][license-url]

</div>

---

## Table of Contents

- [About the Project](#about-the-project)
  - [Screenshots](#screenshots)
  - [Built With](#built-with)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgments](#acknowledgments)

---

## About the Project

Recurring subscription payments are opaque, hard to track, and impossible to govern on-chain. Users have no escrow protection, no programmable release conditions, and no transparent audit trail for their subscription spending. Renewals happen silently — there is no agent watching for you.

**Unsubscribely** brings subscription payments on-chain with five types of Algorand escrow vaults, a fully autonomous A2A payment agent that watches billing dates and releases vaults automatically (no human click required), ARC-3 NFT payment receipts, and an AI spending optimizer — all built with AlgoKit and deployed on Vercel.

---

### Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="public/image_1775979981666.png" alt="Landing Page" width="100%" />
      <br /><sub><b>Landing Page — Track. Control. Save.</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="public/image_1775980015034.png" alt="Blockchain Section" width="100%" />
      <br /><sub><b>Blockchain — Audit every payment on-chain</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="public/image_1775980062289.png" alt="Dashboard with Wallet" width="100%" />
      <br /><sub><b>Dashboard — Connected wallet & escrow vaults</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="public/image_1775980089179.png" alt="Dashboard Wide View" width="100%" />
      <br /><sub><b>Dashboard — Full subscription manager</b></sub>
    </td>
  </tr>
</table>

---

### Built With

[![TypeScript][typescript-shield]][typescript-url]
[![React][react-shield]][react-url]
[![Vite][vite-shield]][vite-url]
[![TailwindCSS][tailwind-shield]][tailwind-url]
[![Algorand][algorand-shield]][algorand-url]
[![AlgoKit][algokit-shield]][algokit-url]
[![Supabase][supabase-shield]][supabase-url]
[![Vercel][vercel-shield]][vercel-url]

---

## Features

- **5 Escrow Vault Types** — Standard, Time-Locked, Multi-Sig, Dispute-Resolution, and ASA-Based
- **A2A Autonomous Agent** — Watches billing dates daily via GitHub Actions and releases vaults on-chain without user intervention
- **ARC-3 NFT Receipts** — Immutable on-chain payment proof minted after every vault release
- **ARC-4 ABI Compliance** — All contracts use standardized method selectors compiled to TEAL v11
- **Kill Switch** — Emergency fund recovery on every vault type; your ALGO is always yours
- **AI Spending Optimizer** — Gemini-powered portfolio analysis with risk scores and savings recommendations
- **On-Chain Resume** — A verifiable DeFi payment history linked to your Algorand wallet
- **Calendar View** — Visual billing calendar with automatic advance-billing detection
- **Spending Analytics** — Multi-currency breakdowns, trend charts, and yearly projections
- **CSV Import & Export** — Bulk-import subscriptions from any spreadsheet in seconds
- **Smart Alerts** — Email notifications before every renewal so you're never surprised
- **Folders & Tags** — Organize subscriptions with color-coded folders and custom tags
- **Lora Explorer Integration** — Every transaction links directly to the live Algorand explorer

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      React 19 Frontend                        │
│   Dashboard · Vaults · Analytics · AI Optimizer · Agent      │
├──────────┬────────────┬─────────────┬────────────────────────┤
│  Pera /  │  Algorand  │  Supabase   │  Vercel Serverless     │
│  Defly / │  AVM TEAL  │  Postgres   │  agent-run.js          │
│  Lute    │  v11       │  + RLS      │  advance-billing.js    │
│  Wallet  │  AlgoNode  │  pg_cron    │  ai-optimizer.js       │
├──────────┴────────────┴─────────────┴────────────────────────┤
│                   Algorand Testnet / Mainnet                   │
│        ARC-2 Notes · ARC-3 NFTs · ARC-4 ABI Contracts        │
└──────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts

All contracts are written in Python using **AlgoKit** (`algorand-python` / algopy) and compiled to **TEAL v11** ARC-4 compliant bytecode. ARC56 JSON specs are loaded directly by the React frontend for deployment — no backend middleware needed.

| Contract | Purpose |
|---|---|
| `EscrowVault` | Standard escrow — creator locks ALGO, releases to recipient |
| `AgentEscrowVault` | A2A agent-managed — authorized agent wallet releases autonomously on billing date |
| `TimeLockEscrow` | Time-locked — funds release only after a Unix timestamp elapses |
| `MultiSigEscrow` | Co-signer required — both creator and co-signer must approve before release |
| `DisputeEscrow` | Arbitrator-controlled — a designated third party resolves disputes |
| `ASAEscrow` | ASA token escrow — works with any Algorand Standard Asset |

The **AgentEscrowVault** is the core of the A2A autonomous payments implementation. It stores `creator`, `recipient`, and `agent` addresses as on-chain global state. The autonomous agent wallet calls `release()void` via ARC-4 ABI on the billing date — zero user interaction required.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+ with AlgoKit (`pip install algokit`)
- A [Supabase](https://supabase.com) project with the schema applied
- A [Pera Wallet](https://perawallet.app) funded on Algorand Testnet
- A [Vercel](https://vercel.com) account for deployment

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/devndesigner6/unsubly.git
   cd unsubly
   ```

2. Install frontend dependencies
   ```sh
   npm install
   ```

3. Create a `.env` file at the root:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   AGENT_WALLET_MNEMONIC=your_25_word_algorand_mnemonic
   ```

4. *(Optional)* Recompile smart contracts with AlgoKit
   ```sh
   algokit compile py smart_contracts/
   ```

5. Start the development server
   ```sh
   npm run dev
   ```

6. Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## Usage

1. **Sign up** at [unsubly2.vercel.app](https://unsubly2.vercel.app) — completely free, no credit card
2. **Connect your Pera Wallet** from the dashboard to enable blockchain features
3. **Add subscriptions** manually or bulk-import via CSV
4. **Create an escrow vault** — choose a vault type and fund it with ALGO through Pera
5. The **autonomous agent** checks daily and releases locked vaults on-chain on billing date
6. **Mint an ARC-3 NFT receipt** after release — permanent, immutable on-chain payment proof
7. Use the **AI Optimizer** to spot wasted spend and receive actionable savings recommendations

---

## Roadmap

- [x] 5 escrow vault types (Standard, Time-Lock, Multi-Sig, Dispute, ASA)
- [x] A2A autonomous payment agent (GitHub Actions daily cron)
- [x] ARC-3 NFT payment receipts
- [x] ARC-4 ABI compliant contracts compiled to TEAL v11
- [x] AI spending optimizer (Gemini-powered)
- [x] On-chain payment resume
- [x] Kill switch on all vault types
- [x] Lora Explorer deep-linking on every transaction
- [ ] Mainnet deployment
- [ ] Mobile app (Expo + React Native)
- [ ] Multi-wallet support (Defly, Lute)
- [ ] Recurring ASA token payment automation
- [ ] DAO governance for arbitration pools

See [open issues](https://github.com/devndesigner6/unsubly/issues) for the full list of proposed features and known bugs.

---

## Contributing

Contributions make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also open an issue with the tag `enhancement`.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

---

## License

Distributed under the **Apache License 2.0**. See [`LICENSE`](LICENSE) for the full text.

---

## Contact

**Hemanth Peddada**

- Website: [hemanthme.in](https://hemanthme.in)
- GitHub: [@devndesigner6](https://github.com/devndesigner6)
- Twitter / X: [@hemanttbuilds](https://x.com/hemanttbuilds)
- LinkedIn: [hemanthp15gr6](https://www.linkedin.com/in/hemanthp15gr6)
- Email: peddadahemanth6@gmail.com

**Project Repository:** [github.com/devndesigner6/unsubly](https://github.com/devndesigner6/unsubly)

**Live App:** [unsubly2.vercel.app](https://unsubly2.vercel.app)

---

## Acknowledgments

- [Algorand Foundation](https://algorand.foundation) — for building the fastest, greenest Layer-1 blockchain
- [AlgoKit](https://github.com/algorandfoundation/algokit-cli) — the developer toolkit powering the smart contract layer
- [Pera Wallet](https://perawallet.app) — seamless Algorand wallet integration
- [AlgoNode](https://algonode.io) — free Algorand API node infrastructure used throughout
- [Lora Explorer](https://lora.algokit.io) — real-time on-chain transaction visibility
- [Supabase](https://supabase.com) — open-source Firebase alternative powering the backend
- [shadcn/ui](https://ui.shadcn.com) — beautifully designed, accessible component system
- [Remix Icons](https://remixicon.com) — clean, consistent icon library
- [othneildrew/Best-README-Template](https://github.com/othneildrew/Best-README-Template) — README structure and inspiration

---

<!-- BADGE LINKS -->
[typescript-shield]: https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org
[react-shield]: https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black
[react-url]: https://react.dev
[algorand-shield]: https://img.shields.io/badge/Algorand-TEAL%20v11-black?style=for-the-badge&logo=algorand&logoColor=white
[algorand-url]: https://algorand.com
[algokit-shield]: https://img.shields.io/badge/AlgoKit-v2.0-00A97F?style=for-the-badge&logo=algorand&logoColor=white
[algokit-url]: https://github.com/algorandfoundation/algokit-cli
[supabase-shield]: https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white
[supabase-url]: https://supabase.com
[vercel-shield]: https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white
[vercel-url]: https://unsubly2.vercel.app
[license-shield]: https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge
[license-url]: https://github.com/devndesigner6/unsubly/blob/main/LICENSE
[vite-shield]: https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white
[vite-url]: https://vite.dev
[tailwind-shield]: https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white
[tailwind-url]: https://tailwindcss.com
