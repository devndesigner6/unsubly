export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
      <h1 className="font-display text-4xl text-foreground mb-6">Privacy Policy</h1>
      <div className="prose prose-sm text-muted-foreground space-y-4">
        <p>Last updated: May 2026</p>
        <h2 className="text-lg font-semibold text-foreground">What We Collect</h2>
        <p>Unsubscribely collects only what's needed to manage your subscriptions:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email address (via Google OAuth for authentication)</li>
          <li>Subscription data you add manually or import via Gmail</li>
          <li>Algorand wallet address (when you connect Pera/Defly/Lute)</li>
          <li>Telegram chat ID (when you connect the bot)</li>
        </ul>
        <h2 className="text-lg font-semibold text-foreground">Blockchain Data</h2>
        <p>Escrow vault transactions are recorded on the Algorand blockchain and are publicly visible by design. This is a feature, not a bug. It provides verifiable proof of payments and cancellations that you own permanently.</p>
        <h2 className="text-lg font-semibold text-foreground">Gmail Import</h2>
        <p>When you use Gmail Auto-Import, we scan your last 6 months of receipts to detect subscription charges. We only read email subjects and sender addresses matching known subscription providers. We do not store email content.</p>
        <h2 className="text-lg font-semibold text-foreground">Third-Party Services</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase (database, authentication) - EU data center</li>
          <li>Vercel (frontend hosting) - edge network</li>
          <li>Railway (agent server) - US region</li>
          <li>Algorand (blockchain) - decentralized network</li>
          <li>Cerebras (AI chat) - API calls only, no data stored</li>
          <li>Telegram Bot API - message delivery only</li>
        </ul>
        <h2 className="text-lg font-semibold text-foreground">Data Deletion</h2>
        <p>You can delete all your data at any time from Settings. This removes all subscriptions, vaults, profile data, and Telegram connection permanently. On-chain transactions cannot be deleted as they are part of the Algorand ledger.</p>
        <h2 className="text-lg font-semibold text-foreground">MCP & x402 API Access</h2>
        <p>When external AI agents access your data via MCP tokens, they can only read/write what you explicitly grant permission for. x402 payments are anonymous - we don't track who pays, only that payment was received.</p>
        <h2 className="text-lg font-semibold text-foreground">Contact</h2>
        <p>For privacy inquiries: <a href="mailto:peddadahemanth6@gmail.com" className="text-foreground hover:underline">peddadahemanth6@gmail.com</a></p>
      </div>
    </div>
  )
}
