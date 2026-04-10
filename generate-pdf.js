const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
const out = fs.createWriteStream('public/demo-script.pdf');
doc.pipe(out);

const PW = 595.28;
const PH = 841.89;
const ML = 48;
const MR = 48;
const CW = PW - ML - MR;

const C = {
  purple: '#5b21b6',
  purpleLight: '#7c3aed',
  purplePale: '#ede9fe',
  purpleDark: '#3b0764',
  amber: '#92400e',
  amberBg: '#fffbeb',
  amberBorder: '#fbbf24',
  green: '#065f46',
  greenBg: '#ecfdf5',
  dark: '#111827',
  gray: '#6b7280',
  grayLight: '#f9fafb',
  white: '#ffffff',
  border: '#e5e7eb',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function newPage(pageNum, total) {
  doc.addPage({ size: 'A4', margin: 0 });

  // top bar
  doc.rect(0, 0, PW, 52).fill('#1e1b4b');
  doc.fontSize(11).fillColor('#a78bfa').font('Helvetica-Bold')
    .text('UNSUBSCRIBELY', ML, 14);
  doc.fontSize(8).fillColor('#c4b5fd').font('Helvetica')
    .text('AlgoBharat Hack Series 3.0  ·  Round 2  ·  Agentic Commerce #3 — A2A Autonomous Payments', ML, 27);

  // page indicator pill
  const pill = `PAGE ${pageNum} / ${total}`;
  const pillW = 70;
  doc.rect(PW - ML - pillW, 16, pillW, 20).fill('#7c3aed');
  doc.fontSize(8.5).fillColor('#fff').font('Helvetica-Bold')
    .text(pill, PW - ML - pillW, 22, { width: pillW, align: 'center' });

  // accent line
  doc.rect(0, 52, PW, 3).fill('#7c3aed');

  return 70; // starting Y
}

function sectionBanner(y, title, timeRange, bgColor, textColor) {
  bgColor = bgColor || C.purplePale;
  textColor = textColor || C.purple;
  doc.rect(ML, y, CW, 28).fill(bgColor);
  doc.rect(ML, y, 4, 28).fill(textColor === C.purple ? C.purpleLight : textColor);
  doc.fontSize(11).fillColor(textColor).font('Helvetica-Bold')
    .text(title, ML + 12, y + 7, { width: CW - 80 });
  doc.fontSize(8.5).fillColor(C.gray).font('Helvetica')
    .text(timeRange, PW - ML - 90, y + 9, { width: 85, align: 'right' });
  return y + 36;
}

function voiceBlock(y, lines) {
  const quoteX = ML + 10;
  const quoteW = CW - 20;
  doc.rect(ML, y, 3, 1).fill(C.purpleLight); // placeholder
  doc.fontSize(10.5).fillColor(C.dark).font('Helvetica');
  const joined = lines.join(' ');
  const textH = doc.heightOfString(joined, { width: quoteW });
  // background
  doc.rect(ML, y, CW, textH + 14).fill('#fafafa');
  doc.rect(ML, y, 2, textH + 14).fill(C.purpleLight);
  doc.fontSize(10.5).fillColor(C.dark).font('Helvetica')
    .text(joined, quoteX, y + 7, { width: quoteW });
  return y + textH + 20;
}

function screenBox(y, text) {
  const boxX = ML;
  const boxW = CW;
  doc.fontSize(9).fillColor(C.amber).font('Helvetica-Bold');
  const textH = doc.heightOfString(text, { width: boxW - 24 });
  doc.rect(boxX, y, boxW, textH + 12).fill(C.amberBg);
  doc.rect(boxX, y, boxW, textH + 12).strokeColor(C.amberBorder).lineWidth(0.8).stroke();
  doc.fontSize(8.5).fillColor(C.amber).font('Helvetica-Bold')
    .text('SCREEN ACTION:  ', boxX + 8, y + 7, { continued: true, width: boxW - 16 })
    .font('Helvetica').fillColor(C.amber)
    .text(text, { width: boxW - 16 });
  return y + textH + 18;
}

function timeBadge(x, y, time) {
  const tw = doc.fontSize(8).font('Helvetica-Bold').widthOfString(time) + 14;
  doc.rect(x, y, tw, 16).fill(C.purple);
  doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold')
    .text(time, x, y + 4, { width: tw, align: 'center' });
  return tw;
}

function gap(y, size) { return y + (size || 12); }

function divider(y) {
  doc.moveTo(ML, y).lineTo(ML + CW, y).lineWidth(0.5).strokeColor(C.border).stroke();
  return y + 10;
}

function tipBox(y, tips) {
  const boxH = 16 + tips.length * 15 + 8;
  doc.rect(ML, y, CW, boxH).fill('#f5f3ff');
  doc.rect(ML, y, CW, boxH).strokeColor(C.purpleLight).lineWidth(0.8).stroke();
  doc.rect(ML, y, 3, boxH).fill(C.purple);
  doc.fontSize(8).fillColor(C.purple).font('Helvetica-Bold')
    .text('BEFORE YOU RECORD — CHECKLIST', ML + 10, y + 8);
  let ty = y + 22;
  for (const tip of tips) {
    doc.fontSize(9).fillColor(C.purpleDark).font('Helvetica')
      .text(`•  ${tip}`, ML + 10, ty, { width: CW - 20 });
    ty += 15;
  }
  return y + boxH + 10;
}

function footer(y, left, right) {
  doc.moveTo(ML, PH - 32).lineTo(ML + CW, PH - 32).lineWidth(0.5).strokeColor(C.border).stroke();
  doc.fontSize(8).fillColor(C.gray).font('Helvetica')
    .text(left, ML, PH - 24, { width: CW / 2 })
    .text(right, ML + CW / 2, PH - 24, { width: CW / 2, align: 'right' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 1 — HOOK · PROBLEM · SOLUTION · TRACK ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════
let y = newPage(1, 4);

// main title
doc.fontSize(20).fillColor(C.purple).font('Helvetica-Bold')
  .text('HOOK · PROBLEM STATEMENT · SOLUTION', ML, y);
y += 28;
doc.fontSize(9).fillColor(C.gray).font('Helvetica-Oblique')
  .text('Voiceover Segment  0:00 – 1:10  ·  Speak clearly, keep eye on timer', ML, y);
y = gap(y + 10, 6);
y = divider(y);

// --- 0:00 – 0:12
timeBadge(ML, y, '0:00 – 0:12');
y += 22;
y = voiceBlock(y, [
  '"Hello. I am presenting Unsubscribely — a fully on-chain, autonomous subscription payment platform',
  'built on the Algorand blockchain. This project is submitted under the Agentic Commerce track, Track',
  'Number Three — Agent-to-Agent Autonomous Payments — where the goal is to build systems where',
  'AI or software agents make financial decisions and execute blockchain transactions independently,',
  'without requiring any human to press a button."',
]);
y = screenBox(y, 'Show the Unsubscribely landing page — logo and tagline clearly visible on screen. Do not click anything yet. Let the page breathe for 5 seconds.');
y = gap(y, 8);

// --- 0:12 – 0:40
timeBadge(ML, y, '0:12 – 0:40');
y += 22;
y = voiceBlock(y, [
  '"Let me start with the problem. Today, every person pays for multiple recurring services —',
  'cloud tools, SaaS platforms, streaming, API subscriptions. But every single one of those payments',
  'is handled by a centralized payment processor. There is no transparency. There is no escrow.',
  'If you pay for a service and it fails to deliver, the money is already gone — no recourse,',
  'no on-chain evidence, and no autonomous enforcement mechanism.',
  'What if your payment agent could hold the funds, verify delivery, and release money automatically',
  'on schedule — all on-chain — without you lifting a finger? That is exactly what we built."',
]);
y = screenBox(y, 'Slowly scroll the landing page to reveal the "Problems We Solve" or key features section. Keep scrolling slowly and smoothly.');

footer(y, 'Unsubscribely  ·  A2A Autonomous Payments on Algorand', 'Page 1 of 4  —  Hook & Problem Statement');

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 2 — SOLUTION OVERVIEW · DASHBOARD · LIVE WALLET
// ═══════════════════════════════════════════════════════════════════════════════
y = newPage(2, 4);

doc.fontSize(20).fillColor(C.purple).font('Helvetica-Bold')
  .text('SOLUTION OVERVIEW · DASHBOARD · WALLET', ML, y);
y += 28;
doc.fontSize(9).fillColor(C.gray).font('Helvetica-Oblique')
  .text('Voiceover Segment  0:40 – 2:20  ·  Navigate to dashboard before this segment begins', ML, y);
y = gap(y + 10, 6);
y = divider(y);

// --- 0:40 – 1:05
timeBadge(ML, y, '0:40 – 1:05');
y += 22;
y = voiceBlock(y, [
  '"Unsubscribely solves this with three interconnected layers. First — an on-chain Escrow Vault',
  'system: five types of Algorand smart contracts that lock payment funds until a billing date is',
  'confirmed. Second — ARC-3 NFT Receipts: tamper-proof, permanent on-chain proof of every',
  'single payment. And third — our A2A Autonomous Agent: a software agent that holds a separate',
  'Algorand wallet, monitors every vault daily, and when a billing date arrives, signs and broadcasts',
  'the release transaction entirely on its own. No user approval. No manual trigger.',
  'Pure autonomous on-chain commerce — which is exactly what the Agentic Commerce track demands."',
]);
y = screenBox(y, 'Navigate to the main dashboard. Show the full dashboard overview — metric cards at the top, wallet panel on the right, and the Agentic Activity log visible below.');
y = gap(y, 6);

// --- 1:05 – 1:30
timeBadge(ML, y, '1:05 – 1:30');
y += 22;
y = voiceBlock(y, [
  '"This is the live dashboard. At the top you see real-time metrics — total monthly spend tracked,',
  'total number of active service subscriptions, and the next upcoming payment date. On the right',
  'panel, the Algorand wallet is connected via Pera Wallet. You can see the live testnet wallet address',
  'and the current ALGO balance pulled directly from the Algorand node — not mocked, not simulated.',
  'Every action this platform takes goes through real transactions on the Algorand testnet."',
]);
y = screenBox(y, 'Point to each metric card individually. Then slowly point to the wallet panel — highlight the wallet address and ALGO balance. Hover over it briefly.');
y = gap(y, 6);

// --- 1:30 – 2:00
timeBadge(ML, y, '1:30 – 2:00');
y += 22;
y = voiceBlock(y, [
  '"Below the metrics is the Agentic Activity Log. This is the heartbeat of our autonomous agent.',
  'Every time the agent detects a billing date has been reached, it fires a smart contract call,',
  'releases funds from the escrow vault to the recipient, and logs the entire action here with a',
  'timestamp, the vault ID, the amount released, and a clickable link to the live transaction on',
  'the Lora blockchain explorer. This is your proof that the A2A agent is real and functional."',
]);
y = screenBox(y, 'Point to the Agentic Activity log section. Click one log entry to show its details. Click the Lora Explorer transaction link and briefly show the live on-chain transaction.');
y = gap(y, 6);

// --- 2:00 – 2:20
timeBadge(ML, y, '2:00 – 2:20');
y += 22;
y = voiceBlock(y, [
  '"Let me also quickly show the Analytics and Calendar views. The analytics page breaks down',
  'spending by category with bar charts — showing exactly how much is being spent per service type',
  'each month. The calendar view maps every upcoming payment date visually so nothing is ever missed.',
  'These views give users complete financial clarity over their on-chain payment obligations."',
]);
y = screenBox(y, 'Navigate to Analytics — show bar chart for 4 seconds. Then navigate to Calendar — show the payment calendar for 4 seconds. Return to dashboard.');

footer(y, 'Unsubscribely  ·  A2A Autonomous Payments on Algorand', 'Page 2 of 4  —  Solution Overview & Dashboard');

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 3 — ESCROW VAULTS · SMART CONTRACTS · A2A AGENT DEMO
// ═══════════════════════════════════════════════════════════════════════════════
y = newPage(3, 4);

doc.fontSize(20).fillColor(C.purple).font('Helvetica-Bold')
  .text('ESCROW VAULTS · SMART CONTRACTS · A2A AGENT', ML, y);
y += 28;
doc.fontSize(9).fillColor(C.gray).font('Helvetica-Oblique')
  .text('Voiceover Segment  2:20 – 4:05  ·  The core A2A innovation — spend the most time here', ML, y);
y = gap(y + 10, 6);
y = divider(y);

// --- 2:20 – 2:45
timeBadge(ML, y, '2:20 – 2:45');
y += 22;
y = voiceBlock(y, [
  '"Now let us look at the core of the platform — Escrow Vaults. These are real Algorand smart',
  'contracts compiled in TEAL version 11, conforming to the ARC-4 ABI standard, and deployed',
  'directly from this interface to the Algorand testnet. Unsubscribely offers five distinct vault types.',
  'Standard vaults for direct single-recipient release. Time-Locked vaults where funds are frozen',
  'until a specific future timestamp. Multi-Signature vaults requiring approval from both the payer',
  'and the service provider. Dispute vaults with an independent arbitrator address. And ASA vaults',
  'for holding Algorand Standard Assets — not just ALGO — in escrow."',
]);
y = screenBox(y, 'Navigate to /escrow-vaults. Show the vault list — at least 3 vaults visible with different types and statuses (Active, Funded, Released). Point to each type label.');
y = gap(y, 6);

// --- 2:45 – 3:15
timeBadge(ML, y, '2:45 – 3:15');
y += 22;
y = voiceBlock(y, [
  '"Let me create a new vault live. I will click Create Vault. I will select the Standard type.',
  'Notice immediately — a green banner appears that says Agent Auto-Release Enabled.',
  'This is the A2A mechanism. When this vault is created, our autonomous agent wallet address',
  'is baked directly into the smart contract as an authorized signer. The TEAL contract has a',
  'specific release method — callable only by the agent address or the vault owner.',
  'So on the billing date, the agent — operating from its own independent Algorand wallet —',
  'will call this release method, sign the transaction with its own private key, and the funds',
  'move from the vault to the recipient. Zero human involvement. This is Agent-to-Agent commerce."',
]);
y = screenBox(y, 'Click Create Vault → select Standard → PAUSE and clearly point to the green "Agent Auto-Release Enabled" banner → fill in recipient address and ALGO amount → click Deploy → sign with Pera Wallet.');
y = gap(y, 6);

// --- 3:15 – 3:40
timeBadge(ML, y, '3:15 – 3:40');
y += 22;
y = voiceBlock(y, [
  '"The wallet is prompting for my signature to deploy the contract. Once I confirm, Algorand',
  'creates the smart contract application, assigns it an Application ID, and the vault is live.',
  'Let me click into this vault. Here you can see the on-chain Application ID — this is the',
  'contract\'s identity on Algorand. Below that, the Agent Address — a completely separate wallet',
  'from mine — this is the autonomous agent. And the vault balance, which starts at zero until funded.',
  'Let me now fund this vault. I will click Fund, enter one ALGO, and sign the transaction.',
  'The ALGO is now locked inside the smart contract. The vault status is now Funded.",',
]);
y = screenBox(y, 'Click into the newly created vault → point to Application ID, Agent Address (different from your wallet), and current balance → click Fund → enter 1 ALGO → sign wallet → show status updating to Funded.');
y = gap(y, 6);

// --- 3:40 – 4:05
timeBadge(ML, y, '3:40 – 4:05');
y += 22;
y = voiceBlock(y, [
  '"Now — when the billing date stored in our database matches today\'s date, our Supabase edge',
  'function fires. It queries all vaults due today, constructs an Algorand transaction calling the',
  'release ABI method on each vault contract, signs it using the agent\'s private key, and broadcasts',
  'it to the network. The funds leave the smart contract, arrive at the recipient, and the agent',
  'logs the action. The user never needed to do anything. The agent handled the full payment cycle.',
  'That is the A2A autonomous payment loop — and it runs every single day, automatically."',
]);
y = screenBox(y, 'Return to dashboard → point to the Agentic Activity log → show an existing auto-release entry → click the Lora Explorer link → show the real on-chain transaction details including sender (agent wallet), receiver, and amount.');

footer(y, 'Unsubscribely  ·  A2A Autonomous Payments on Algorand', 'Page 3 of 4  —  Escrow Vaults & A2A Agent Demo');

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 4 — NFT RECEIPTS · ON-CHAIN RESUME · CLOSING
// ═══════════════════════════════════════════════════════════════════════════════
y = newPage(4, 4);

doc.fontSize(20).fillColor(C.purple).font('Helvetica-Bold')
  .text('NFT RECEIPTS · ON-CHAIN RESUME · CLOSE', ML, y);
y += 28;
doc.fontSize(9).fillColor(C.gray).font('Helvetica-Oblique')
  .text('Voiceover Segment  4:05 – 5:00  ·  Strong finish — emphasize on-chain finality and the track vision', ML, y);
y = gap(y + 10, 6);
y = divider(y);

// --- 4:05 – 4:25
timeBadge(ML, y, '4:05 – 4:25');
y += 22;
y = voiceBlock(y, [
  '"Every vault release generates a permanent ARC-3 NFT Receipt. Let me demonstrate. I will click',
  'Mint ARC-3 NFT Receipt on this released vault. The platform constructs an asset creation',
  'transaction using the ARC-3 metadata standard — embedding the payment amount, recipient address,',
  'vault application ID, and timestamp into the NFT metadata. I sign the transaction, and within',
  'seconds an Algorand Standard Asset is minted on-chain. The unit name is RCPT. This NFT is now',
  'permanent, immutable, and publicly verifiable proof that this payment happened — exactly like',
  'a blockchain receipt that can never be falsified or deleted."',
]);
y = screenBox(y, 'Navigate to a vault with Released status → click Mint ARC-3 NFT Receipt → sign wallet → show the success notification with asset ID → open Lora Explorer showing the newly minted ASA with RCPT unit name and metadata.');
y = gap(y, 6);

// --- 4:25 – 4:45
timeBadge(ML, y, '4:25 – 4:45');
y += 22;
y = voiceBlock(y, [
  '"The final feature is the On-Chain Resume. As payments accumulate through Unsubscribely,',
  'every released vault contributes to a verifiable financial identity for this wallet.',
  'The On-Chain Resume shows total ALGO transacted, total number of confirmed on-chain payments,',
  'and a full history. The user can make this resume public — generating a unique sharable URL.',
  'Anyone with that link — an employer, a partner, a DAO — can verify this wallet\'s payment',
  'reliability without asking a bank or a credit bureau. This is decentralized financial reputation,',
  'built entirely from autonomous on-chain activity."',
]);
y = screenBox(y, 'Navigate to /onchain-resume → show total volume and transaction count figures → toggle the Public switch ON → copy the generated shareable URL and show it in the browser address bar briefly.');
y = gap(y, 6);

// --- 4:45 – 5:00
timeBadge(ML, y, '4:45 – 5:00');
y += 22;
y = voiceBlock(y, [
  '"Unsubscribely is a fully working MVP on Algorand testnet. It demonstrates the complete',
  'Agent-to-Agent autonomous payment loop — a software agent holds funds in a TEAL v11 smart',
  'contract, monitors billing schedules, and autonomously executes on-chain payments. It generates',
  'ARC-3 NFT receipts as immutable proof of payment. And it builds a decentralized financial',
  'reputation from on-chain activity alone. This is what Agentic Commerce looks like on Algorand.',
  'Thank you."',
]);
y = screenBox(y, 'Return to the landing page — hold for 3 seconds showing the logo and tagline. End recording here.');
y = gap(y, 10);

// checklist box
y = tipBox(y, [
  'Wallet pre-connected with at least 5 testnet ALGO before starting  (bank.testnet.algorand.network)',
  'Have 4–5 vaults already created: at least one Funded, one Released, one with agent log entry',
  'Have one transaction already in the Agentic Activity log — click it and show Lora Explorer live',
  'Have one Released vault ready for NFT minting — avoids waiting for confirmation on screen',
  'Use Chrome in full-screen mode — hide bookmarks bar and other tabs before recording',
  'Speak at 80 percent of normal speed — slower delivery always sounds more confident on video',
  'Record at 1920 × 1080 minimum using OBS, Loom, or Screencastify',
]);

// password box
doc.rect(ML, y, CW, 40).fill('#1e1b4b');
doc.rect(ML, y, 3, 40).fill('#a78bfa');
doc.fontSize(8).fillColor('#a78bfa').font('Helvetica-Bold')
  .text('SUBMISSION PASSWORD', ML + 12, y + 8);
doc.fontSize(20).fillColor('#e9d5ff').font('Helvetica-Bold')
  .text('ALGOHackSeries3', ML + 12, y + 18, { letterSpacing: 2 });

footer(y + 50, 'Unsubscribely  ·  A2A Autonomous Payments on Algorand', 'Page 4 of 4  —  NFT Receipts & Closing');

doc.end();
out.on('finish', () => console.log('PDF ready: public/demo-script.pdf'));
out.on('error', e => console.error(e));
