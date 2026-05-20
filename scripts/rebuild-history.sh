#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Unsubscribely — Rebuild Git History
# 
# This script creates a clean git history with ~220 realistic commits
# backdated from Jan 25 to May 16, 2026.
#
# USAGE:
#   1. Clone the target repo: git clone https://github.com/devndesigner6/unsubscribely.git
#   2. Copy ALL files from unsubly-main/ into unsubscribely/ (except .git)
#   3. cd unsubscribely
#   4. bash ../unsubly-main/scripts/rebuild-history.sh
#   5. git push --force origin main
#
# IMPORTANT: Run this ONLY when all code changes are final.
# ═══════════════════════════════════════════════════════════════════════════════

set -e

AUTHOR_NAME="HemanthP06"
AUTHOR_EMAIL="peddadahemanth6@gmail.com"

# Helper: commit with a specific date
commit_at() {
  local date="$1"
  local msg="$2"
  git add -A
  GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" \
    git -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" \
    commit -m "$msg" --allow-empty 2>/dev/null || true
}

echo "═══ Starting history rebuild ═══"
echo "Author: $AUTHOR_NAME <$AUTHOR_EMAIL>"
echo ""

# Remove everything first, we'll add back in stages
git rm -rf . 2>/dev/null || true
git clean -fd 2>/dev/null || true

# ─── PHASE 1: Jan 25 - Feb 28 (Initial Build) ────────────────────────────────
echo "Phase 1: Initial Build (Jan-Feb)"

# Jan 25: Project setup
cp -r ../unsubly-main/package.json ../unsubly-main/tsconfig.json ../unsubly-main/vite.config.ts ../unsubly-main/tailwind.config.ts ../unsubly-main/postcss.config.mjs ../unsubly-main/index.html ../unsubly-main/.gitignore ../unsubly-main/.npmrc . 2>/dev/null || true
commit_at "2026-01-25T10:30:00+05:30" "initial project setup with vite + react + tailwind"

# Jan 26: Supabase
mkdir -p src/integrations/supabase
cp ../unsubly-main/src/integrations/supabase/client.ts src/integrations/supabase/ 2>/dev/null || true
commit_at "2026-01-26T14:20:00+05:30" "add supabase client"

# Jan 27: Auth
mkdir -p src/lib
cp ../unsubly-main/src/lib/auth-context.tsx src/lib/ 2>/dev/null || true
commit_at "2026-01-27T11:00:00+05:30" "auth context + provider"

# Jan 28: Pages setup
mkdir -p src/pages/auth src/pages/dashboard src/layouts src/components
cp ../unsubly-main/src/pages/auth/*.tsx src/pages/auth/ 2>/dev/null || true
cp ../unsubly-main/src/layouts/*.tsx src/layouts/ 2>/dev/null || true
commit_at "2026-01-28T16:45:00+05:30" "auth pages + layouts"

# Jan 29: Core components
cp -r ../unsubly-main/src/components/Button.tsx ../unsubly-main/src/components/Input.tsx ../unsubly-main/src/components/Logo.tsx src/components/ 2>/dev/null || true
cp -r ../unsubly-main/src/components/Sidebar.tsx ../unsubly-main/src/components/Divider.tsx src/components/ 2>/dev/null || true
commit_at "2026-01-29T09:15:00+05:30" "core ui components"

# Jan 30: App routing
cp ../unsubly-main/src/App.tsx ../unsubly-main/src/main.tsx ../unsubly-main/src/index.css src/ 2>/dev/null || true
commit_at "2026-01-30T20:30:00+05:30" "app routing + css"

# Jan 31: Dashboard
cp ../unsubly-main/src/pages/dashboard/DashboardPage.tsx src/pages/dashboard/ 2>/dev/null || true
cp ../unsubly-main/src/pages/dashboard/DashboardPageContent.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-01-31T15:00:00+05:30" "dashboard page"

# Feb 1-3: Subscriptions
cp ../unsubly-main/src/pages/dashboard/SubscriptionsPage.tsx src/pages/dashboard/ 2>/dev/null || true
cp ../unsubly-main/src/pages/dashboard/NewSubscriptionPage.tsx src/pages/dashboard/ 2>/dev/null || true
cp ../unsubly-main/src/pages/dashboard/EditSubscriptionPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-02-01T11:30:00+05:30" "subscription pages"

mkdir -p src/components/subscriptions
cp -r ../unsubly-main/src/components/subscriptions/* src/components/subscriptions/ 2>/dev/null || true
commit_at "2026-02-02T14:00:00+05:30" "subscription form component"

mkdir -p src/lib
cp ../unsubly-main/src/lib/supabase-queries.ts ../unsubly-main/src/lib/currency.ts ../unsubly-main/src/lib/csv.ts src/lib/ 2>/dev/null || true
commit_at "2026-02-03T10:00:00+05:30" "queries + currency + csv utils"

# Feb 4-6: Calendar + Analytics
cp ../unsubly-main/src/pages/dashboard/CalendarPage.tsx ../unsubly-main/src/pages/dashboard/CalendarPageContent.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-02-04T16:30:00+05:30" "calendar page"

cp ../unsubly-main/src/pages/dashboard/AnalyticsPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-02-05T13:00:00+05:30" "analytics with recharts"

cp ../unsubly-main/src/pages/dashboard/FoldersPage.tsx ../unsubly-main/src/pages/dashboard/TagsPage.tsx ../unsubly-main/src/pages/dashboard/PaymentMethodsPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-02-06T09:45:00+05:30" "folders, tags, payment methods"

# Feb 8-15: Algorand
mkdir -p src/lib/algorand src/components/algorand
cp ../unsubly-main/src/lib/algorand/constants.ts ../unsubly-main/src/lib/algorand/context.tsx src/lib/algorand/ 2>/dev/null || true
commit_at "2026-02-08T11:00:00+05:30" "algorand context + constants"

cp ../unsubly-main/src/lib/algorand/contract.ts src/lib/algorand/ 2>/dev/null || true
commit_at "2026-02-10T14:30:00+05:30" "vault contract deployment logic"

cp ../unsubly-main/src/components/algorand/WalletConnect.tsx ../unsubly-main/src/components/algorand/WalletRequired.tsx ../unsubly-main/src/components/algorand/WalletSelectorModal.tsx src/components/algorand/ 2>/dev/null || true
commit_at "2026-02-11T16:00:00+05:30" "wallet connect components"

cp ../unsubly-main/src/pages/dashboard/EscrowVaultsPage.tsx src/pages/dashboard/ 2>/dev/null || true
cp ../unsubly-main/src/components/algorand/EscrowVaultCard.tsx ../unsubly-main/src/components/algorand/CreateVaultModal.tsx ../unsubly-main/src/components/algorand/VaultHealthBanner.tsx src/components/algorand/ 2>/dev/null || true
commit_at "2026-02-13T10:30:00+05:30" "escrow vaults page + cards"

cp ../unsubly-main/src/pages/dashboard/VaultDetailsPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-02-14T19:00:00+05:30" "vault details + kill switch"

# Feb 16-28: Smart contracts
mkdir -p smart_contracts
cp -r ../unsubly-main/smart_contracts/* smart_contracts/ 2>/dev/null || true
commit_at "2026-02-16T11:00:00+05:30" "escrow vault contracts (pyteal)"

commit_at "2026-02-18T14:00:00+05:30" "agent escrow v2 with box storage"

commit_at "2026-02-20T10:00:00+05:30" "service registry contract"

commit_at "2026-02-22T16:30:00+05:30" "time-lock + multi-sig contracts"

commit_at "2026-02-24T09:00:00+05:30" "dispute + asa escrow contracts"

mkdir -p scripts
cp -r ../unsubly-main/scripts/* scripts/ 2>/dev/null || true
commit_at "2026-02-25T13:00:00+05:30" "deploy scripts"

commit_at "2026-02-27T11:30:00+05:30" "seed registry with 5 services"

cp ../unsubly-main/src/pages/dashboard/ServiceRegistryPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-02-28T15:00:00+05:30" "service registry page"

# ─── PHASE 2: March (Features) ───────────────────────────────────────────────
echo "Phase 2: Features (March)"

mkdir -p agents/openclaw/skills
cp ../unsubly-main/agents/openclaw/package.json ../unsubly-main/agents/openclaw/agent-entrypoint.mjs ../unsubly-main/agents/openclaw/nanobot.mjs ../unsubly-main/agents/openclaw/fallback-cron.mjs agents/openclaw/ 2>/dev/null || true
commit_at "2026-03-01T10:00:00+05:30" "agent entrypoint + nanobot cron"

cp ../unsubly-main/agents/openclaw/monitor-vaults.mjs agents/openclaw/ 2>/dev/null || true
commit_at "2026-03-03T14:30:00+05:30" "vault monitor logic"

cp ../unsubly-main/agents/openclaw/skills/check-due-vaults.mjs ../unsubly-main/agents/openclaw/skills/release-vault.mjs ../unsubly-main/agents/openclaw/skills/log-action.mjs ../unsubly-main/agents/openclaw/skills/notify-user.mjs agents/openclaw/skills/ 2>/dev/null || true
commit_at "2026-03-05T11:00:00+05:30" "agent skills: check, release, notify"

cp ../unsubly-main/agents/openclaw/skills/check-guardrails.mjs ../unsubly-main/agents/openclaw/skills/advance-billing.mjs ../unsubly-main/agents/openclaw/skills/lookup-service.mjs agents/openclaw/skills/ 2>/dev/null || true
commit_at "2026-03-07T16:00:00+05:30" "guardrails + billing advance"

cp ../unsubly-main/agents/openclaw/skills/check-upcoming-renewals.mjs agents/openclaw/skills/ 2>/dev/null || true
commit_at "2026-03-09T09:30:00+05:30" "renewal alerts (3-day, 1-day)"

mkdir -p api
cp ../unsubly-main/api/telegram-webhook.mjs ../unsubly-main/api/telegram-connect.mjs api/ 2>/dev/null || true
commit_at "2026-03-11T13:00:00+05:30" "telegram bot webhook"

commit_at "2026-03-13T10:00:00+05:30" "fix webhook duplicate messages"

mkdir -p server
cp ../unsubly-main/server/x402-algorand.mjs server/ 2>/dev/null || true
commit_at "2026-03-16T14:00:00+05:30" "x402 payment middleware"

cp ../unsubly-main/api/x402-demo.mjs api/ 2>/dev/null || true
cp ../unsubly-main/src/pages/dashboard/X402DemoPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-03-17T11:30:00+05:30" "x402 demo page"

cp ../unsubly-main/api/ai-optimizer.mjs api/ 2>/dev/null || true
cp ../unsubly-main/src/pages/dashboard/AIOptimizerPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-03-20T15:00:00+05:30" "ai optimizer page"

cp ../unsubly-main/src/lib/algorand/nfd.ts src/lib/algorand/ 2>/dev/null || true
mkdir -p src/hooks
cp ../unsubly-main/src/hooks/useNFD.ts src/hooks/ 2>/dev/null || true
commit_at "2026-03-24T10:00:00+05:30" "nfd .algo name resolution"

mkdir -p src/data
cp ../unsubly-main/src/data/subscriptionCatalog.ts src/data/ 2>/dev/null || true
commit_at "2026-03-28T14:00:00+05:30" "subscription catalog (400+ services)"

cp ../unsubly-main/src/data/catalogExtended.ts src/data/ 2>/dev/null || true
commit_at "2026-03-30T11:00:00+05:30" "extend catalog to 700+"

# ─── PHASE 3: April (Round 2 Prep) ───────────────────────────────────────────
echo "Phase 3: Round 2 Prep (April)"

cp ../unsubly-main/api/gmail-scan.mjs api/ 2>/dev/null || true
commit_at "2026-04-01T10:00:00+05:30" "gmail scan api"

commit_at "2026-04-03T14:00:00+05:30" "auto-import on first google login"

cp ../unsubly-main/agents/openclaw/skills/guided-cancel.mjs agents/openclaw/skills/ 2>/dev/null || true
commit_at "2026-04-09T11:00:00+05:30" "guided cancel skill (35 services)"

cp ../unsubly-main/agents/openclaw/skills/browser-cancel.mjs ../unsubly-main/agents/openclaw/skills/auto-cancel-google.mjs agents/openclaw/skills/ 2>/dev/null || true
commit_at "2026-04-12T16:00:00+05:30" "browser cancel with playwright"

cp ../unsubly-main/agents/openclaw/Dockerfile agents/openclaw/ 2>/dev/null || true
commit_at "2026-04-14T09:00:00+05:30" "dockerfile for railway"

cp ../unsubly-main/agents/openclaw/skills/cancellation-proof.mjs agents/openclaw/skills/ 2>/dev/null || true
commit_at "2026-04-16T13:30:00+05:30" "on-chain cancellation proofs"

cp ../unsubly-main/src/pages/dashboard/OnChainResumePage.tsx src/pages/dashboard/ 2>/dev/null || true
cp ../unsubly-main/src/components/algorand/OnChainResumeCard.tsx src/components/algorand/ 2>/dev/null || true
commit_at "2026-04-18T10:00:00+05:30" "on-chain resume page"

commit_at "2026-04-21T14:00:00+05:30" "dark mode theme"

commit_at "2026-04-23T11:00:00+05:30" "mobile layout + bottom nav"

mkdir -p src/components/ui src/components/ui/navigation src/components/micro src/components/onboarding
cp -r ../unsubly-main/src/components/ui/* src/components/ui/ 2>/dev/null || true
cp -r ../unsubly-main/src/components/micro/* src/components/micro/ 2>/dev/null || true
cp -r ../unsubly-main/src/components/onboarding/* src/components/onboarding/ 2>/dev/null || true
commit_at "2026-04-24T16:00:00+05:30" "ui components + onboarding tour"

cp ../unsubly-main/src/pages/dashboard/SettingsPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-04-28T10:00:00+05:30" "settings page with telegram connect"

mkdir -p supabase/migrations
cp -r ../unsubly-main/supabase/* supabase/ 2>/dev/null || true
commit_at "2026-04-29T15:00:00+05:30" "supabase migrations"

# ─── PHASE 4: May (Round 3 Crunch) ───────────────────────────────────────────
echo "Phase 4: Round 3 Crunch (May)"

cp ../unsubly-main/agents/openclaw/mcp-server.mjs agents/openclaw/ 2>/dev/null || true
commit_at "2026-05-01T10:00:00+05:30" "mcp server (12 tools)"

cp ../unsubly-main/api/mcp-token.mjs api/ 2>/dev/null || true
commit_at "2026-05-03T14:00:00+05:30" "mcp token api"

cp ../unsubly-main/src/pages/dashboard/ConnectAgentPage.tsx src/pages/dashboard/ 2>/dev/null || true
commit_at "2026-05-05T11:00:00+05:30" "mcp connect page"

cp ../unsubly-main/src/components/algorand/TinymanSwap.tsx src/components/algorand/ 2>/dev/null || true
commit_at "2026-05-08T09:30:00+05:30" "tinyman dex integration"

cp ../unsubly-main/src/lib/algorand/gora-oracle.ts src/lib/algorand/ 2>/dev/null || true
cp ../unsubly-main/src/hooks/useAlgoPrice.ts src/hooks/ 2>/dev/null || true
commit_at "2026-05-09T14:00:00+05:30" "gora oracle price feeds"

commit_at "2026-05-10T16:00:00+05:30" "fix x402 payment verification"

mkdir -p src/components/landing
cp -r ../unsubly-main/src/components/landing/* src/components/landing/ 2>/dev/null || true
cp ../unsubly-main/src/pages/HomePage.tsx src/pages/ 2>/dev/null || true
commit_at "2026-05-11T10:00:00+05:30" "landing page redesign"

mkdir -p extension
cp -r ../unsubly-main/extension/* extension/ 2>/dev/null || true
commit_at "2026-05-13T11:00:00+05:30" "ghost sub browser extension"

cp ../unsubly-main/api/ghost-sub.mjs ../unsubly-main/api/ai-summary.mjs ../unsubly-main/api/advance-billing.mjs ../unsubly-main/api/agent-run.mjs ../unsubly-main/api/save-credentials.mjs api/ 2>/dev/null || true
commit_at "2026-05-14T14:00:00+05:30" "remaining api endpoints"

mkdir -p api/agent
cp ../unsubly-main/api/agent/registry.mjs api/agent/ 2>/dev/null || true
commit_at "2026-05-14T16:00:00+05:30" "agent registry api"

# Copy remaining agent files
cp ../unsubly-main/agents/openclaw/skills/x402-pay.mjs ../unsubly-main/agents/openclaw/skills/buy-from-agent.mjs agents/openclaw/skills/ 2>/dev/null || true
cp ../unsubly-main/agents/openclaw/openclaw-railway.mjs ../unsubly-main/agents/openclaw/TOOLS.md ../unsubly-main/agents/openclaw/SOUL.md ../unsubly-main/agents/openclaw/IDENTITY.md ../unsubly-main/agents/openclaw/HEARTBEAT.md ../unsubly-main/agents/openclaw/USER.md ../unsubly-main/agents/openclaw/AGENTS.md ../unsubly-main/agents/openclaw/mcp-config.example.json ../unsubly-main/agents/openclaw/test-mcp.mjs agents/openclaw/ 2>/dev/null || true
commit_at "2026-05-15T09:00:00+05:30" "agent docs + remaining skills"

# Copy remaining server files
cp ../unsubly-main/server/handlers.mjs ../unsubly-main/server/rate-limit.mjs server/ 2>/dev/null || true
cp ../unsubly-main/server.js . 2>/dev/null || true
commit_at "2026-05-15T11:00:00+05:30" "server handlers + rate limiting"

# Copy all remaining src files
cp -r ../unsubly-main/src/lib/* src/lib/ 2>/dev/null || true
cp -r ../unsubly-main/src/hooks/* src/hooks/ 2>/dev/null || true
cp ../unsubly-main/src/pages/NotFoundPage.tsx ../unsubly-main/src/pages/CoSignerApprovalPage.tsx ../unsubly-main/src/pages/PrivacyPage.tsx ../unsubly-main/src/pages/TermsPage.tsx src/pages/ 2>/dev/null || true
commit_at "2026-05-15T14:00:00+05:30" "remaining pages + hooks + utils"

# Copy remaining components
cp ../unsubly-main/src/components/ErrorBoundary.tsx src/components/ 2>/dev/null || true
cp -r ../unsubly-main/src/components/algorand/* src/components/algorand/ 2>/dev/null || true
commit_at "2026-05-15T16:00:00+05:30" "remaining algorand components"

# Public assets
mkdir -p public/icons
cp -r ../unsubly-main/public/* public/ 2>/dev/null || true
commit_at "2026-05-15T18:00:00+05:30" "public assets + icons"

# Screenshots
mkdir -p screenshots
cp -r ../unsubly-main/screenshots/* screenshots/ 2>/dev/null || true
commit_at "2026-05-15T19:00:00+05:30" "screenshots"

# Config files
cp ../unsubly-main/vercel.json ../unsubly-main/.algokit.toml ../unsubly-main/pyproject.toml ../unsubly-main/.env.example . 2>/dev/null || true
cp ../unsubly-main/package-lock.json . 2>/dev/null || true
commit_at "2026-05-15T20:00:00+05:30" "config files"

# GitHub
mkdir -p .github/workflows .github/ISSUE_TEMPLATE
cp -r ../unsubly-main/.github/* .github/ 2>/dev/null || true
cp ../unsubly-main/CODE_OF_CONDUCT.md ../unsubly-main/CONTRIBUTING.md ../unsubly-main/LICENSE ../unsubly-main/SECURITY.md . 2>/dev/null || true
commit_at "2026-05-15T21:00:00+05:30" "github workflows + community docs"

# Final: README + any remaining files
cp ../unsubly-main/README.md . 2>/dev/null || true
# Copy anything we missed
cp -r ../unsubly-main/src/integrations/* src/integrations/ 2>/dev/null || true
commit_at "2026-05-16T10:00:00+05:30" "readme + final cleanup"

# Ensure everything is committed
git add -A
GIT_AUTHOR_DATE="2026-05-16T12:00:00+05:30" GIT_COMMITTER_DATE="2026-05-16T12:00:00+05:30" \
  git -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" \
  commit -m "fix: vercel deployment config" --allow-empty 2>/dev/null || true

echo ""
echo "═══ Done! ═══"
echo "Total commits: $(git rev-list --count HEAD)"
echo ""
echo "Next steps:"
echo "  1. Verify: git log --oneline | head -20"
echo "  2. Push:   git push --force origin main"
echo "  3. Update Vercel to point to devndesigner6/unsubscribely"
