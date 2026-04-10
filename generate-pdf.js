const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true });
const out = fs.createWriteStream('public/demo-script.pdf');
doc.pipe(out);

const PURPLE = '#6d28d9';
const LIGHT_PURPLE = '#ede9fe';
const AMBER = '#b45309';
const AMBER_BG = '#fffbeb';
const DARK = '#1a1a1a';
const GRAY = '#6b7280';
const W = 595 - 90; // usable width

function header(doc, pageLabel) {
  doc.rect(45, 38, W, 28).fill('#f5f3ff');
  doc.fontSize(9).fillColor(PURPLE).font('Helvetica-Bold')
    .text('UNSUBSCRIBELY', 52, 47, { continued: true })
    .font('Helvetica').fillColor(GRAY)
    .text(`   ·   ${pageLabel}`, { align: 'left' });
  doc.moveTo(45, 66).lineTo(45 + W, 66).lineWidth(2).strokeColor(PURPLE).stroke();
  doc.y = 80;
}

function pageTitle(doc, title, subtitle) {
  doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold').text(title, 45, doc.y);
  doc.fontSize(9).fillColor(GRAY).font('Helvetica-Oblique').text(subtitle, 45, doc.y + 3);
  doc.y += 14;
  doc.moveTo(45, doc.y).lineTo(45 + W, doc.y).lineWidth(0.5).strokeColor(LIGHT_PURPLE).stroke();
  doc.y += 10;
}

function segment(doc, time, actionLabel, voiceLines, screenAction, highlight) {
  const startY = doc.y;
  const leftX = 45;
  const timeW = 68;
  const contentX = leftX + timeW + 8;
  const contentW = W - timeW - 8;

  if (highlight) {
    doc.rect(leftX, startY - 4, W, 1).fill(PURPLE);
  }

  // Time badge
  doc.rect(leftX, startY, timeW, 16).fill(PURPLE).roundedRect(leftX, startY, timeW, 16, 3).fill(PURPLE);
  doc.fontSize(8.5).fillColor('white').font('Helvetica-Bold')
    .text(time, leftX + 2, startY + 4, { width: timeW - 4, align: 'center' });

  if (actionLabel) {
    doc.rect(leftX, startY + 20, timeW, 13).fill('#f59e0b').roundedRect(leftX, startY + 20, timeW, 13, 2).fill('#f59e0b');
    doc.fontSize(7).fillColor('#1a1a1a').font('Helvetica-Bold')
      .text(actionLabel, leftX + 2, startY + 23, { width: timeW - 4, align: 'center' });
  }

  // Voiceover text
  const voiceY = startY;
  let lineY = voiceY;
  doc.fontSize(11).fillColor(DARK).font('Helvetica');
  for (const line of voiceLines) {
    doc.text(line, contentX, lineY, { width: contentW });
    lineY = doc.y + 2;
  }

  // Screen action
  if (screenAction) {
    doc.rect(contentX, lineY, contentW, 15).fill(AMBER_BG);
    doc.rect(contentX, lineY, 3, 15).fill('#f59e0b');
    doc.fontSize(8.5).fillColor(AMBER).font('Helvetica-Bold')
      .text('SCREEN: ', contentX + 6, lineY + 4, { continued: true, width: contentW - 10 })
      .font('Helvetica').text(screenAction, { width: contentW - 10 });
    lineY = doc.y + 2;
  }

  doc.y = Math.max(doc.y, startY + 36) + 10;

  // Separator
  doc.moveTo(contentX, doc.y - 5).lineTo(contentX + contentW, doc.y - 5)
    .lineWidth(0.3).strokeColor('#e5e7eb').stroke();
}

function keybox(doc, title, items) {
  const boxY = doc.y;
  const boxH = 14 + items.length * 14 + 8;
  doc.rect(45, boxY, W, boxH).fill('#f5f3ff');
  doc.rect(45, boxY, 3, boxH).fill(PURPLE);
  doc.fontSize(8).fillColor(PURPLE).font('Helvetica-Bold')
    .text(title.toUpperCase(), 54, boxY + 8);
  let y = boxY + 20;
  for (const item of items) {
    doc.fontSize(9).fillColor('#3b0764').font('Helvetica')
      .text(`• ${item}`, 58, y, { width: W - 20 });
    y += 14;
  }
  doc.y = boxY + boxH + 10;
}

function techRow(doc, tags) {
  let x = 45;
  const y = doc.y;
  for (const tag of tags) {
    const tw = doc.fontSize(7.5).font('Helvetica-Bold').widthOfString(tag) + 14;
    doc.rect(x, y, tw, 14).fill('#1a1a2e');
    doc.fontSize(7.5).fillColor('#a78bfa').font('Helvetica-Bold').text(tag, x + 7, y + 3);
    x += tw + 5;
    if (x > 45 + W - 60) { x = 45; doc.y += 18; }
  }
  doc.y = y + 20;
}

function footer(doc, right) {
  doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
    .text('Unsubscribely · AlgoBharat Hack Series 3.0 · Round 2', 45, 800, { continued: true, width: W })
    .text(right, { align: 'right' });
}

// ═══════════════════════════════ PAGE 1 ═══════════════════════════════
header(doc, 'Demo Script — Page 1 of 4   |   AlgoBharat Hack Series 3.0 · Round 2');
pageTitle(doc, 'INTRODUCTION & PROBLEM STATEMENT', 'Segment: 0:00 – 1:00  ·  Track: Agentic Commerce #3 — A2A Autonomous Payments');

segment(doc, '0:00–0:10', 'OPEN', [
  '"Hi, I\'m presenting Unsubscribely — a DeFi-powered subscription management platform',
  'built on the Algorand blockchain, submitted for AlgoBharat Hack Series 3.0, Round 2,',
  'under the Agentic Commerce track."'
], 'Show the Unsubscribely landing page hero section — logo clearly visible', true);

segment(doc, '0:10–0:30', null, [
  '"Today, people pay for dozens of subscriptions — Netflix, Spotify, SaaS tools — and they',
  'have zero on-chain accountability. Payments happen silently, there\'s no proof of payment,',
  'no trustless protection, and no autonomous management. If a service doesn\'t deliver,',
  'your money is already gone."'
], 'Scroll slowly down the landing page to show the Problems We Solve / features section');

segment(doc, '0:30–0:50', null, [
  '"Unsubscribely solves this with three core innovations: On-chain Escrow Vaults that hold',
  'payment funds in Algorand smart contracts until service is confirmed. ARC-3 NFT Receipts',
  'that give you permanent, tamper-proof proof of every payment. And an A2A Autonomous Agent',
  'that automatically releases vault funds when billing dates arrive — no human trigger needed."'
], 'Scroll to the features / how-it-works section on the landing page');

segment(doc, '0:50–1:00', null, [
  '"Let me show you the live app."'
], 'Click Get Started or navigate to the dashboard — show the main dashboard overview');

keybox(doc, 'Key Points to Emphasize on Screen', [
  'Landing page must be visible — show the logo "Unsubscribely" clearly',
  'Scroll slowly so judges can read the feature bullets',
  'Have the wallet already connected before recording starts — shows ALGO balance',
  'Keep mouse movement smooth and deliberate',
]);

techRow(doc, ['Algorand Testnet', 'TEAL v11 Smart Contracts', 'ARC-3 NFT', 'A2A Autonomous Agent', 'Supabase', 'React + Vite']);
footer(doc, 'Page 1 / 4 — Introduction');

// ═══════════════════════════════ PAGE 2 ═══════════════════════════════
doc.addPage();
header(doc, 'Demo Script — Page 2 of 4   |   AlgoBharat Hack Series 3.0 · Round 2');
pageTitle(doc, 'DASHBOARD & SUBSCRIPTION TRACKING', 'Segment: 1:00 – 2:15  ·  Core product walkthrough');

segment(doc, '1:00–1:20', 'DASHBOARD', [
  '"This is the main dashboard. At the top we see real-time metrics — total monthly spend,',
  'number of active subscriptions, and upcoming payment dates. On the right is the connected',
  'Algorand wallet showing the wallet address and live ALGO balance from the testnet."'
], 'Point to metric cards (monthly spend, active subs, upcoming) — then point to wallet panel showing ALGO balance', true);

segment(doc, '1:20–1:35', null, [
  '"The dashboard also has an Agentic Activity panel — the live log of every action the',
  'autonomous agent has taken: vault releases, fund transfers, on-chain confirmations.',
  'Every action timestamps and links directly to the Lora block explorer."'
], 'Scroll to Agentic Activity log — point to a log entry and click the transaction link');

segment(doc, '1:35–1:50', 'SUBSCRIPTIONS', [
  '"Now let\'s look at Subscription Tracking. Here\'s the full list — each card shows the',
  'service name, monthly cost, category, and next billing date. I can filter by category,',
  'search by name, and export the entire list as a CSV."'
], 'Navigate to /subscriptions — show subscription cards, use the search bar, show Export CSV button');

segment(doc, '1:50–2:05', null, [
  '"Let me add a new subscription. I\'ll click Add Subscription, fill in the service name,',
  'amount in ALGO, billing cycle, and category. This subscription is now tracked in the',
  'database and can be linked to an on-chain escrow vault."'
], 'Click Add Subscription → fill in form fields → submit → show new card appearing in list');

segment(doc, '2:05–2:15', null, [
  '"I can also view the Analytics page with spending breakdowns by category as a bar chart,',
  'and the Calendar view which maps every upcoming billing date — so you always know',
  'what\'s due and when."'
], 'Quick 5-second glimpse of Analytics chart → quick 5-second glimpse of Calendar view');

keybox(doc, 'Tips for This Section', [
  'Have at least 4–5 subscriptions pre-loaded (Netflix, Spotify, GitHub etc.) so list looks populated',
  'Add one subscription live during recording — makes the demo feel interactive',
  'Wallet must show connected status and ALGO balance throughout',
  'Don\'t linger on Analytics — a 5-second glimpse is enough, keep moving',
]);
footer(doc, 'Page 2 / 4 — Dashboard & Subscriptions');

// ═══════════════════════════════ PAGE 3 ═══════════════════════════════
doc.addPage();
header(doc, 'Demo Script — Page 3 of 4   |   AlgoBharat Hack Series 3.0 · Round 2');
pageTitle(doc, 'ESCROW VAULTS + A2A AUTONOMOUS AGENT', 'Segment: 2:15 – 4:00  ·  The core blockchain innovation');

segment(doc, '2:15–2:35', 'VAULTS', [
  '"Now for the core innovation — Escrow Vaults. These are real Algorand smart contracts',
  'deployed directly from this UI. Navigate to Escrow Vaults to see all created vaults.',
  'Each vault shows its on-chain address, ALGO balance, status, and vault type."'
], 'Navigate to /escrow-vaults — show the vault list with statuses (Active, Funded, Released)', true);

segment(doc, '2:35–3:00', null, [
  '"Let me create a new vault. I\'ll click Create Vault. Unsubscribely supports five vault',
  'types: Standard, Time-Locked, Multi-Signature, Dispute, and ASA token vaults.',
  'I\'ll select Standard — watch for the green banner: Agent Auto-Release Enabled.',
  'This means an autonomous agent has permission to release this vault automatically',
  'on the billing date."'
], 'Click Create Vault → Select Standard → CLEARLY point to green "Agent Auto-Release Enabled" banner → fill recipient + amount → click Deploy');

segment(doc, '3:00–3:20', null, [
  '"The smart contract is now deploying on Algorand testnet. The wallet prompts for',
  'signature — once confirmed, the contract gets a unique on-chain application ID.',
  'Clicking into this vault shows the contract address, the agent address that has release',
  'permissions, on-chain balance, and full transaction history."'
], 'Sign wallet transaction → wait for confirmation → click into vault detail page → point to App ID, Agent Address, and tx list');

segment(doc, '3:20–3:40', null, [
  '"Now I\'ll fund the vault. I click Fund, enter an ALGO amount, sign with my wallet —',
  'and the funds are now locked inside the smart contract on-chain. The vault status updates',
  'to Funded. No one can touch these funds without authorization — not even me — unless',
  'through the contract\'s release logic."'
], 'Click Fund → enter amount (1 ALGO) → sign wallet → show vault balance updating to Funded status');

segment(doc, '3:40–4:00', 'A2A AGENT', [
  '"This is the A2A magic. Our autonomous agent — running as a Supabase Edge Function —',
  'checks every vault daily. When a billing date arrives, the agent signs and sends the',
  'release transaction using its own wallet, paying from the vault to the recipient',
  'automatically. No user action needed. This is true Agent-to-Agent autonomous payment',
  'on the Algorand blockchain."'
], 'Go to dashboard → point to Agentic Activity log → show auto-release entry → click Lora Explorer link to show live on-chain tx', true);

keybox(doc, 'Critical Points for Judges', [
  'Say "Agent Auto-Release Enabled" banner out loud — this is the A2A differentiator for the track',
  'Point to agent address in vault details — it is different from your wallet (it\'s the autonomous agent)',
  'Click the Lora Explorer link to prove it\'s a REAL on-chain transaction, not mocked',
  'If wallet signing fails live, have a pre-funded vault ready to fall back to',
]);
footer(doc, 'Page 3 / 4 — Escrow Vaults & A2A Agent');

// ═══════════════════════════════ PAGE 4 ═══════════════════════════════
doc.addPage();
header(doc, 'Demo Script — Page 4 of 4   |   AlgoBharat Hack Series 3.0 · Round 2');
pageTitle(doc, 'NFT RECEIPTS + ON-CHAIN RESUME + CLOSE', 'Segment: 4:00 – 5:00  ·  Final features and wrap-up');

segment(doc, '4:00–4:20', 'NFT MINT', [
  '"Every time a vault releases a payment, the user can mint an ARC-3 NFT Receipt —',
  'permanent on-chain proof of payment. I\'ll click Mint ARC-3 NFT Receipt on this released',
  'vault. The wallet signs, and within seconds an Algorand Standard Asset is minted with',
  'unit name RCPT, storing the payment amount, recipient address, and vault ID as verified',
  'metadata — forever on-chain."'
], 'On a released vault detail page → click Mint ARC-3 NFT Receipt → sign wallet → show success toast with NFT asset ID → briefly show on Lora Explorer', true);

segment(doc, '4:20–4:40', 'RESUME', [
  '"Now the On-Chain Resume. This aggregates every payment this wallet has ever made',
  'through Unsubscribely into a verifiable financial identity. Total transacted volume,',
  'transaction count — all provable on-chain. I can toggle it public and share a unique',
  'link. Anyone with this link sees my verified payment history. This is your Web3',
  'financial reputation — no bank, no intermediary."'
], 'Navigate to /onchain-resume → show total volume + tx count → toggle Public → copy and show shareable link URL');

segment(doc, '4:40–4:55', null, [
  '"To summarize: Unsubscribely is a complete DeFi subscription management platform on',
  'Algorand. Subscription tracking, five types of on-chain escrow smart contracts,',
  'NFT-based payment receipts, and a fully autonomous A2A agent that releases payments',
  'on schedule — no human intervention required. Built with TEAL v11 smart contracts,',
  'ARC-3 NFT standard, Supabase edge functions, and React."'
], 'Return to the landing page or dashboard — show the full UI clearly one final time');

segment(doc, '4:55–5:00', 'CLOSE', [
  '"Thank you. GitHub and deployment links are in the submission."'
], 'Hold on landing page or dashboard for 5 seconds — done');

keybox(doc, 'Pre-Recording Checklist — Do This Before You Hit Record', [
  'Wallet connected (Pera/Defly) with at least 5 ALGO testnet balance — get from bank.testnet.algorand.network',
  'Have 4–5 subscriptions pre-loaded (Netflix, Spotify, GitHub, Figma, Notion)',
  'Have at least one Released vault ready (for NFT minting demo without waiting)',
  'Have at least one Funded vault ready (to show agent log entry)',
  'Open Lora Explorer (lora.algokit.io/testnet) in a separate tab for quick switching',
  'Use Chrome full-screen, hide bookmarks bar for a clean recording',
  'Record at 1920×1080 minimum — use OBS or Loom',
  'Speak at 80% of normal speed — slightly slower is always better for demos',
]);

// Password box
const pwY = doc.y + 4;
doc.rect(45, pwY, W, 44).fill('#f5f3ff');
doc.rect(45, pwY, 3, 44).fill(PURPLE);
doc.fontSize(8).fillColor(PURPLE).font('Helvetica-Bold').text('SUBMISSION PASSWORD', 54, pwY + 8);
doc.fontSize(22).fillColor('#3b0764').font('Helvetica-Bold').text('ALGOHackSeries3', 54, pwY + 20, { letterSpacing: 3 });

techRow(doc, ['AlgoKit · TEAL v11', 'ARC-3 · ARC-4', 'Pera Wallet', 'Supabase Edge Functions', 'Lora Explorer', 'React + Vite + TypeScript']);
footer(doc, 'Page 4 / 4 — NFT Receipts, On-Chain Resume & Close');

doc.end();
out.on('finish', () => console.log('PDF generated: public/demo-script.pdf'));
out.on('error', e => console.error('Error:', e));
