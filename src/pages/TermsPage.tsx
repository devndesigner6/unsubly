export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
      <h1 className="font-display text-4xl text-foreground mb-6">Terms of Service</h1>
      <div className="prose prose-sm text-muted-foreground space-y-4">
        <p>Last updated: May 2026</p>
        <h2 className="text-lg font-semibold text-foreground">Service Description</h2>
        <p>Unsubscribely is an open-source subscription management platform built on the Algorand blockchain. It provides escrow vaults, autonomous payment agents, and AI-powered subscription tracking.</p>
        <h2 className="text-lg font-semibold text-foreground">Your Responsibilities</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for securing your Algorand wallet private keys</li>
          <li>You understand that blockchain transactions are irreversible</li>
          <li>You acknowledge that the autonomous agent operates based on rules you configure</li>
          <li>You are responsible for the accuracy of subscription data you enter</li>
        </ul>
        <h2 className="text-lg font-semibold text-foreground">Smart Contract Risks</h2>
        <p>Escrow vaults are smart contracts on Algorand TestNet. While we've designed them with kill switches and safety mechanisms, smart contracts carry inherent risks. The code is open-source and available for review at our GitHub repository. No formal security audit has been completed.</p>
        <h2 className="text-lg font-semibold text-foreground">Autonomous Agent</h2>
        <p>The autonomous agent releases vault payments on billing day based on your subscription schedule. You can override any agent action via the kill switch (returns ALGO immediately) or by pausing the subscription in the app or Telegram bot.</p>
        <h2 className="text-lg font-semibold text-foreground">x402 API Payments</h2>
        <p>The x402 endpoint charges 0.001 ALGO per request. Payments are non-refundable once confirmed on-chain. The endpoint returns live Algorand network data in exchange for payment.</p>
        <h2 className="text-lg font-semibold text-foreground">MCP Access</h2>
        <p>MCP tokens grant AI agents access to your subscription data. You control which permissions (Read, Write, Admin) each token has. Tokens can be revoked at any time from the Connect Agent page.</p>
        <h2 className="text-lg font-semibold text-foreground">Open Source</h2>
        <p>Unsubscribely is open-source under the MIT license. You may fork, modify, and deploy your own instance. We provide no warranty for self-hosted deployments.</p>
        <h2 className="text-lg font-semibold text-foreground">Limitation of Liability</h2>
        <p>This is a hackathon project deployed on Algorand TestNet. We are not liable for any loss of funds, missed payments, or service interruptions. Use at your own risk. TestNet ALGO has no monetary value.</p>
        <h2 className="text-lg font-semibold text-foreground">Contact</h2>
        <p>Questions: <a href="mailto:peddadahemanth6@gmail.com" className="text-foreground hover:underline">peddadahemanth6@gmail.com</a></p>
      </div>
    </div>
  )
}
