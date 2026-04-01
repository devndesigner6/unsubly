# Unsubscribely

A DeFi-powered subscription management platform built on the Algorand blockchain.

## Overview

Unsubscribely allows users to manage recurring payments using on-chain escrow vaults with programmable release conditions (time-locks, multi-sig, dispute resolution), mints ARC-3 NFT payment receipts, and features an AI-driven spending optimizer powered by Google Gemini.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Build Tool**: Vite 7
- **Blockchain**: Algorand (TEAL smart contracts, algosdk, Pera Wallet Connect)
- **Backend/BaaS**: Supabase (PostgreSQL, Row Level Security, Auth, Edge Functions)
- **AI**: Google Gemini 2.5 Flash (via Supabase Edge Functions)

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

## Development

```bash
npm install --legacy-peer-deps
npm run dev
```

The dev server runs on port 5000 at `0.0.0.0`.

Note: `--legacy-peer-deps` is required due to a peer dependency conflict between `algosdk@3.x` (project) and `@perawallet/connect` (which expects `algosdk@2.x`).

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key

## Deployment

Static site deployment — builds with `npm run build` and serves the `dist/` directory.
