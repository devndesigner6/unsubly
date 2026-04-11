const PDFDocument = require('pdfkit')
const fs = require('fs')

const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false })
const out = fs.createWriteStream('demo-script-video.pdf')
doc.pipe(out)

const PW = 595.28
const PH = 841.89
const ML = 40
const MR = 40
const CW = PW - ML - MR

// ── Colors ──────────────────────────────────────────────────────
const C = {
  headerBg:   '#1e1b4b',
  headerText: '#ffffff',
  accent:     '#4f46e5',
  accentSoft: '#eef2ff',
  purple:     '#7c3aed',
  purpleSoft: '#f5f3ff',
  amber:      '#92400e',
  amberBg:    '#fffbeb',
  amberBorder:'#d97706',
  text:       '#111827',
  muted:      '#6b7280',
  light:      '#f9fafb',
  border:     '#e5e7eb',
  white:      '#ffffff',
  green:      '#065f46',
  greenBg:    '#ecfdf5',
  greenBorder:'#10b981',
}

// ── Helpers ──────────────────────────────────────────────────────
function pageHeader(doc, label, pageNum, total) {
  doc.rect(0, 0, PW, 36).fill(C.headerBg)
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(9)
    .text('UNSUBSCRIBELY', ML, 13, { continued: true })
  doc.fillColor('#818cf8').font('Helvetica').fontSize(8)
    .text('  ·  Programmable subscription payments on Algorand', { continued: true })
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8)
    .text(`  PAGE ${pageNum} / ${total}`, { align: 'right' })
}

function sectionTitle(doc, title, timeRange, y) {
  doc.rect(ML, y, CW, 38).fill(C.accentSoft)
  doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(14)
    .text(title, ML + 10, y + 8, { width: CW - 100 })
  doc.fillColor(C.muted).font('Helvetica').fontSize(7.5)
    .text(timeRange, ML + 10, y + 26)
  return y + 50
}

function timeStamp(doc, time, y) {
  const w = 72, h = 16
  doc.rect(ML, y, w, h).fill(C.purple)
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8)
    .text(time, ML + 4, y + 4, { width: w - 8, align: 'center' })
  return y + h + 5
}

function scriptBox(doc, text, y) {
  const pad = 9
  const availH = PH - y - 50
  const lines = doc.heightOfString(text, { width: CW - pad * 2, fontSize: 9, lineGap: 3 })
  const boxH = Math.min(lines + pad * 2, availH)
  doc.rect(ML, y, CW, boxH).fill(C.purpleSoft)
  doc.rect(ML, y, 3, boxH).fill(C.purple)
  doc.fillColor(C.text).font('Helvetica').fontSize(9)
    .text(text, ML + pad + 3, y + pad, { width: CW - pad * 2 - 6, lineGap: 3 })
  return y + boxH + 6
}

function actionBox(doc, text, y) {
  const pad = 8
  const lines = doc.heightOfString(text, { width: CW - pad * 2 - 10, fontSize: 8, lineGap: 2 })
  const boxH = lines + pad * 2
  doc.rect(ML, y, CW, boxH).fill(C.amberBg)
  doc.rect(ML, y, CW, boxH).stroke(C.amberBorder)
  doc.fillColor(C.amber).font('Helvetica-Bold').fontSize(7.5)
    .text('SCREEN ACTION  ', ML + pad, y + pad, { continued: true, lineGap: 2 })
  doc.fillColor(C.amber).font('Helvetica').fontSize(7.5)
    .text(text, { width: CW - pad * 2, lineGap: 2 })
  return y + boxH + 6
}

function noteBox(doc, text, y) {
  const pad = 7
  const lines = doc.heightOfString(text, { width: CW - pad * 2 - 8, fontSize: 7.5, lineGap: 2 })
  const boxH = lines + pad * 2
  doc.rect(ML, y, CW, boxH).fill(C.greenBg)
  doc.rect(ML, y, 2, boxH).fill(C.greenBorder)
  doc.fillColor(C.green).font('Helvetica-Bold').fontSize(7.5)
    .text('NOTE  ', ML + pad + 2, y + pad, { continued: true })
  doc.font('Helvetica').text(text, { width: CW - pad * 2 - 4 })
  return y + boxH + 6
}

function divider(doc, y) {
  doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(C.border).lineWidth(0.5).stroke()
  return y + 8
}

function gap(y, n = 8) { return y + n }

// ── PAGE 1: COVER ────────────────────────────────────────────────
doc.addPage()
pageHeader(doc, '', 1, 5)

// Big cover block
doc.rect(0, 36, PW, 160).fill('#1e1b4b')
doc.fillColor('#818cf8').font('Helvetica').fontSize(8)
  .text('DEMO VIDEO SCRIPT  ·  PRIVATE  ·  DO NOT DISTRIBUTE', 0, 56, { align: 'center', width: PW })
doc.fillColor(C.white).font('Helvetica-Bold').fontSize(38)
  .text('Unsubscribely', 0, 78, { align: 'center', width: PW })
doc.fillColor('#c7d2fe').font('Helvetica').fontSize(11)
  .text('Programmable subscription payments on Algorand', 0, 126, { align: 'center', width: PW })

// Stats
const statsY = 155
const statW = 90
const stats = [['5:00','DURATION'],['10','SEGMENTS'],['5','VAULT TYPES']]
stats.forEach((s, i) => {
  const x = PW/2 - 135 + i * 90
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(20).text(s[0], x, statsY, { width: statW, align: 'center' })
  doc.fillColor('#818cf8').font('Helvetica').fontSize(6.5)
    .text(s[1], x, statsY + 24, { width: statW, align: 'center' })
})

let y = 210

// ── SEGMENT 1
y = sectionTitle(doc, 'SEGMENT 01 · THE HOOK', '0:00 – 0:30', y)
y = timeStamp(doc, '0:00 – 0:08', y)
y = actionBox(doc, 'Black screen. Voice only. No app visible for first 8 seconds.', y)
y = scriptBox(doc, 'Every month, money leaves your account without a single conscious decision from you. Subscriptions you forgot. Services still charging you. And every one of those payments — not recorded anywhere you actually own. No contract on-chain. No receipt that lasts. No conditions. No agent watching for you.', y)
y = timeStamp(doc, '0:08 – 0:30', y)
y = actionBox(doc, 'Fade in the landing page. Slow scroll from hero down to Features. Pause 2s on Escrow Vault card, then Agent card.', y)
y = scriptBox(doc, 'This is Unsubscribely — a DeFi platform that puts subscription payments on Algorand. Not just tracked — governed. Locked in smart contracts with programmable release conditions. Released by an autonomous agent. Not by you manually.', y)

y = divider(doc, y)

// ── SEGMENT 2
y = sectionTitle(doc, 'SEGMENT 02 · LANDING PAGE WALK', '0:30 – 1:00', y)
y = timeStamp(doc, '0:30 – 0:43', y)
y = scriptBox(doc, 'Four layers. A subscription tracker — your entire portfolio in one place. On-chain escrow vaults — five types, each with different programmable release conditions. An autonomous payment agent — a wallet that executes payments on-chain every day. And an AI spending optimizer — risk scoring, cost-saving recommendations, portfolio analysis.', y)
y = timeStamp(doc, '0:43 – 1:00', y)
y = actionBox(doc, 'Click "Get Started". Auth screen. Log in. Wallet auto-connects to Testnet.', y)
y = scriptBox(doc, "Let me show you the real thing.", y)
y = noteBox(doc, 'Pre-logged in. Wallet on Algorand Testnet. 4+ subscriptions added. One locked vault, one released vault ready.', y)


// ── PAGE 2: SEGMENTS 3–4 ─────────────────────────────────────────
doc.addPage()
pageHeader(doc, '', 2, 5)
y = 50

y = sectionTitle(doc, 'SEGMENT 03 · DASHBOARD OVERVIEW', '1:00 – 1:30', y)
y = timeStamp(doc, '1:00 – 1:18', y)
y = actionBox(doc, 'Pan over dashboard. Hover monthly spend metric. Scroll to subscription cards. Show billing dates and vault status.', y)
y = scriptBox(doc, 'The dashboard — full subscription footprint. Monthly spend, upcoming billing dates, active vaults, live agent activity. Four subscriptions already here — Netflix, Spotify, GitHub, Figma. Next billing dates, amounts, and vault status at a glance.', y)
y = timeStamp(doc, '1:18 – 1:30', y)
y = actionBox(doc, 'Navigate to Subscriptions → Add Subscription. Fill in: Adobe Creative Cloud · $54.99 · Monthly · billing date 4 days out. Save.', y)
y = scriptBox(doc, 'Adding a subscription takes seconds. Any service, any currency, any billing cycle. Now watch what we do with it.', y)

y = divider(doc, y)

y = sectionTitle(doc, 'SEGMENT 04 · CREATING AN ESCROW VAULT', '1:30 – 2:45', y)
y = timeStamp(doc, '1:30 – 1:52', y)
y = actionBox(doc, 'Escrow Vaults → Create Vault → Type: Standard · Adobe CC · 5 ALGO · recipient address. Click Create. Sign transaction in wallet popup.', y)
y = scriptBox(doc, "This is where it gets real. I'm going to lock funds inside a smart contract on Algorand. Not a database entry. Not a company's promise. An actual on-chain contract — immutable, trustless, auditable by anyone.", y)
y = timeStamp(doc, '2:00 – 2:20', y)
y = actionBox(doc, 'Vault appears with App ID. Click Fund Vault. Sign. Wait for LOCKED status badge to appear.', y)
y = scriptBox(doc, 'Funded and locked. Five ALGO is now inside the smart contract. Not in my wallet. Not in anyone\'s database. On-chain. Immutable. Waiting for release conditions to be met.', y)
y = timeStamp(doc, '2:22 – 2:42', y)
y = actionBox(doc, 'Click the Lora Explorer link. Show: contract address, App ID, inner payment amount. Hold 8 seconds. Return to app.', y)
y = scriptBox(doc, 'Look at Lora — the contract address, the amount, the ABI call. This is real. Anyone can verify it right now. [8 second pause — let the on-chain proof speak for itself.]', y)


// ── PAGE 3: SEGMENTS 5–6 ─────────────────────────────────────────
doc.addPage()
pageHeader(doc, '', 3, 5)
y = 50

y = sectionTitle(doc, 'SEGMENT 05 · FIVE VAULT TYPES', '2:45 – 3:15', y)
y = timeStamp(doc, '2:45 – 3:13', y)
y = actionBox(doc, 'Create Vault modal → cycle through each vault type in dropdown. Pause 4s on each. Show unique fields that appear for each type. Do not create any. Close modal.', y)
y = scriptBox(doc, 'Five vault types. Five programmable trust models. Standard — creator locks, agent or creator releases. Time-Locked — funds cannot move before a specific date, contract-enforced, not policy. Multi-Sig — two wallets must agree before release, ideal for business payments. Dispute-Resolution — third-party arbitrator can intervene. ASA-based — lock Algorand Standard Assets, not just native ALGO. All enforced by TEAL contracts on the Algorand Virtual Machine. No middleman. No override possible.', y)

y = divider(doc, y)

y = sectionTitle(doc, 'SEGMENT 06 · THE AUTONOMOUS AGENT', '3:15 – 4:00', y)
y = timeStamp(doc, '3:15 – 3:20', y)
y = actionBox(doc, 'Dashboard → scroll to Agent Activity panel. Let it load fully. Point cursor at the ON-CHAIN badge.', y)
y = scriptBox(doc, "This is what makes Unsubscribely different from every other subscription tracker on the market.", y)
y = timeStamp(doc, '3:20 – 3:42', y)
y = actionBox(doc, 'Highlight an agent action entry. Show timestamp and amount.', y)
y = scriptBox(doc, 'There is a dedicated Algorand wallet — the agent — running every day at midnight UTC. It wakes up. Scans every subscription with a billing date that has arrived. Finds the linked escrow vault. Calls release() on the smart contract — an ARC-4 method — and ALGO moves from the vault to the recipient address. No user click. No reminder. No manual step. Autonomous, on-chain, every single day.', y)
y = timeStamp(doc, '3:42 – 4:00', y)
y = actionBox(doc, 'Click the Lora link on an agent action entry. Show: agent wallet address as sender, release() ABI method call, inner payment to recipient. Hold 5 seconds. Return to dashboard.', y)
y = scriptBox(doc, 'The agent wallet signed this. Submitted it. ALGO moved to the recipient. Publicly verifiable on Lora right now — the method call, the amount, the addresses. Every autonomous action timestamped, logged, with direct on-chain proof.', y)
y = noteBox(doc, 'If no agent action exists yet — open the locked vault detail page, show its App ID on Lora, explain the agent will autonomously release it at next billing date.', y)


// ── PAGE 4: SEGMENTS 7–10 ────────────────────────────────────────
doc.addPage()
pageHeader(doc, '', 4, 5)
y = 50

y = sectionTitle(doc, 'SEGMENT 07 · ARC-3 NFT RECEIPT', '4:00 – 4:15', y)
y = timeStamp(doc, '4:00 – 4:15', y)
y = actionBox(doc, 'Vault Details of pre-released vault → Mint NFT Receipt → sign in wallet → show receipt card: name, amount, timestamp, ASA ID.', y)
y = scriptBox(doc, 'After a vault releases, mint an ARC-3 compliant NFT receipt — an immutable on-chain record of the payment. Name, amount, subscription, timestamp — all in the NFT metadata. Your payment history is not in a database someone controls. It is on Algorand. Permanently.', y)

y = divider(doc, y)

y = sectionTitle(doc, 'SEGMENT 08 · AI SPENDING OPTIMIZER', '4:15 – 4:35', y)
y = timeStamp(doc, '4:15 – 4:35', y)
y = actionBox(doc, 'AI Optimizer page → Run Analysis → wait for Gemini response → show risk scores, recommendations, spend health score.', y)
y = scriptBox(doc, 'Locking money on-chain creates a natural audit trail — and the AI optimizer reads it. Powered by Gemini, it analyzes your full subscription portfolio. Surfaces duplicate spending, high-risk services, underused plans. Gives you a spend health score and specific recommendations — what to cancel, what to downgrade — based on actual vault data and billing patterns. Not generic advice.', y)

y = divider(doc, y)

y = sectionTitle(doc, 'SEGMENT 09 · ON-CHAIN RESUME', '4:35 – 4:50', y)
y = timeStamp(doc, '4:35 – 4:50', y)
y = actionBox(doc, 'On-Chain Resume page → show resume: vault history, total ALGO paid, NFT receipt count → briefly show the public shareable URL in address bar.', y)
y = scriptBox(doc, 'Every wallet has a public on-chain resume — shareable, verifiable view of your entire Algorand payment history. Vault count, total ALGO moved, NFT receipts minted. Anyone with the link can verify every record on-chain. Permanent. Trustless. Yours.', y)

y = divider(doc, y)

y = sectionTitle(doc, 'SEGMENT 10 · CLOSE', '4:50 – 5:00', y)
y = timeStamp(doc, '4:50 – 5:00', y)
y = actionBox(doc, 'Cut to landing page hero. Hold 5 seconds. Fade to black with Unsubscribely wordmark centered.', y)
y = scriptBox(doc, 'Unsubscribely. Programmable money. Transparent payments. Autonomous delivery. This is what subscription payments look like when they belong to you.', y)


// ── PAGE 5: SHOT-BY-SHOT TABLE ───────────────────────────────────
doc.addPage()
pageHeader(doc, '', 5, 5)
y = 48

doc.fillColor(C.text).font('Helvetica-Bold').fontSize(14)
  .text('Shot-by-Shot Production Table', ML, y)
doc.fillColor(C.muted).font('Helvetica').fontSize(8)
  .text('USE THIS DURING RECORDING — EVERY ACTION MAPPED TO THE SECOND', ML, y + 18)
y += 34

// Table header
const cols = { time: 36, screen: 108, action: 170, words: CW - 36 - 108 - 170 }
const colX = {
  time:   ML,
  screen: ML + cols.time + 2,
  action: ML + cols.time + 2 + cols.screen + 2,
  words:  ML + cols.time + 2 + cols.screen + 2 + cols.action + 2,
}
const rowH = 16
const headerH = 14

doc.rect(ML, y, CW, headerH).fill(C.headerBg)
doc.fillColor(C.white).font('Helvetica-Bold').fontSize(6.5)
  .text('TIME',   colX.time,   y + 3.5, { width: cols.time })
  .text('SCREEN', colX.screen, y + 3.5, { width: cols.screen })
  .text('ACTION', colX.action, y + 3.5, { width: cols.action })
  .text('VOICEOVER', colX.words, y + 3.5, { width: cols.words })
y += headerH

const rows = [
  // seg, time, screen, action, words
  ['01 — THE HOOK', '', '', '', ''],
  ['', '0:00', 'Black screen', 'Voice only. No visual.', '"Every month, money leaves your account without a single conscious decision from you..."'],
  ['', '0:08', 'Landing – Hero', 'Fade in. Slow scroll.', '"...subscriptions still charging you. Services you forgot. Every payment — not recorded anywhere you actually own."'],
  ['', '0:18', 'Landing – Features', 'Scroll to features.', '"No contract on-chain. No receipt that lasts. No agent watching for you."'],
  ['', '0:26', 'Landing – Features', 'Pause on Escrow card.', '"This is Unsubscribely — DeFi subscription payments on Algorand. Governed. On-chain."'],
  ['02 — LANDING', '', '', '', ''],
  ['', '0:30', 'Landing – Features', 'Hover Escrow, then Agent card.', '"Four layers: subscription tracker, on-chain escrow vaults, an autonomous agent, and an AI optimizer."'],
  ['', '0:43', 'Landing', 'Click Get Started.', '"Let me show you the real thing."'],
  ['', '0:47', 'Auth / Login', 'Log in. Wallet connects.', '[Pause — no voiceover]'],
  ['03 — DASHBOARD', '', '', '', ''],
  ['', '1:00', 'Dashboard', 'Pan over metrics.', '"Full subscription footprint — monthly spend, billing dates, active vaults, agent activity."'],
  ['', '1:10', 'Subscription list', 'Scroll to sub cards.', '"Netflix, Spotify, GitHub, Figma. Billing dates and vault status visible."'],
  ['', '1:18', 'Subscriptions page', 'Click Add Subscription.', '"I\'ll add one more — Adobe Creative Cloud."'],
  ['', '1:22', 'Add form', 'Fill Adobe CC · $54.99 · Monthly. Save.', '"Any service, any currency, any billing cycle."'],
  ['', '1:28', 'Subscription list', 'Adobe CC appears. Pause 2s.', '"Now watch what we do with it."'],
  ['04 — ESCROW VAULT', '', '', '', ''],
  ['', '1:32', 'Escrow Vaults', 'Click Create Vault.', '"Locking funds in a smart contract on Algorand. Not a database — an actual on-chain contract."'],
  ['', '1:42', 'Create Vault modal', 'Standard · Adobe CC · 5 ALGO. Fill.', '"Immutable, trustless, auditable by anyone."'],
  ['', '1:52', 'Wallet popup', 'Sign transaction.', '"Deploying to Algorand Testnet..."'],
  ['', '2:00', 'Vault – unfunded', 'Hover App ID.', '"Contract deployed. That App ID is its permanent on-chain address."'],
  ['', '2:08', 'Vault – Fund', 'Click Fund. Sign. Wait LOCKED.', '"Five ALGO moving into the smart contract."'],
  ['', '2:16', 'Vault – LOCKED', 'Status flips to LOCKED.', '"Locked. On-chain. Immutable. Waiting."'],
  ['', '2:22', 'Lora Explorer', 'Click Lora link. Txn loads.', '"Look at Lora — contract address, amount, ABI call. This is real."'],
  ['', '2:32', 'Lora – txn detail', 'Show sender, app ID, inner txn. Hold 8s.', '[Silence — let the proof speak]'],
  ['', '2:42', 'App – Vault view', 'Return to app.', ''],
  ['05 — VAULT TYPES', '', '', '', ''],
  ['', '2:45', 'Create Vault modal', 'Hover type dropdown.', '"Five vault types. Five programmable trust models."'],
  ['', '2:50', 'Modal – Standard', 'Select Standard.', '"Standard — creator locks, agent or creator releases."'],
  ['', '2:54', 'Modal – Time-Locked', 'Select. Unlock date shows.', '"Time-Locked — funds can\'t move before a date. Contract-enforced."'],
  ['', '2:58', 'Modal – Multi-Sig', 'Select. Co-signer shows.', '"Multi-Sig — two wallets must agree before release."'],
  ['', '3:02', 'Modal – Dispute', 'Select. Arbitrator shows.', '"Dispute-Resolution — third-party arbitrator can intervene."'],
  ['', '3:06', 'Modal – ASA', 'Select. Asset ID shows.', '"ASA-based — lock any Algorand Standard Asset, not just ALGO."'],
  ['', '3:11', 'Modal closing', 'Close modal.', '"All enforced by TEAL on the AVM. No middleman. No override."'],
  ['06 — AGENT', '', '', '', ''],
  ['', '3:15', 'Dashboard', 'Scroll to Agent panel.', '"This is what makes Unsubscribely different from every other subscription tracker."'],
  ['', '3:20', 'Agent Activity panel', 'Point at ON-CHAIN badge.', '"A dedicated Algorand wallet — the agent — runs every day at midnight UTC."'],
  ['', '3:28', 'Agent entry', 'Highlight entry. Show timestamp.', '"Scans due subscriptions. Calls release(). ALGO moves. No click. No reminder. Fully autonomous."'],
  ['', '3:42', 'Lora – agent txn', 'Show agent wallet, release() call, inner payment. Hold 5s.', '"The agent signed this. ALGO moved. Publicly verifiable on Lora right now."'],
  ['', '3:54', 'Dashboard', 'Return. Agent panel visible.', '"Every action — timestamped, logged, direct on-chain proof."'],
  ['07 — NFT RECEIPT', '', '', '', ''],
  ['', '4:00', 'Vault Details – released', 'Mint NFT Receipt. Sign.', '"After a vault releases — mint an ARC-3 NFT receipt. Immutable on-chain record."'],
  ['', '4:08', 'NFT receipt card', 'Show name, amount, timestamp.', '"Payment history not in a database. On Algorand. Permanently."'],
  ['08 — AI OPTIMIZER', '', '', '', ''],
  ['', '4:15', 'AI Optimizer', 'Click Run Analysis. Wait.', '"AI optimizer reads vault data and billing patterns."'],
  ['', '4:22', 'Optimizer results', 'Show risk scores + recs.', '"Specific recommendations — cancel, downgrade — based on actual on-chain history."'],
  ['09 — ON-CHAIN RESUME', '', '', '', ''],
  ['', '4:35', 'On-Chain Resume', 'Show vaults, total paid, NFTs.', '"Public on-chain resume — shareable, verifiable. Entire payment history on Algorand."'],
  ['', '4:44', 'Public URL', 'Show URL in address bar.', '"Permanent. Trustless. Yours."'],
  ['10 — CLOSE', '', '', '', ''],
  ['', '4:50', 'Landing – Hero', 'Cut to hero. Hold 5s.', '"Unsubscribely. Programmable money. Transparent payments. Autonomous delivery."'],
  ['', '4:56', 'Black – Logo', 'Fade to black. Logo.', '"This is what subscription payments look like when they belong to you."'],
  ['', '5:00', 'End', 'Hold black.', ''],
]

rows.forEach((r, i) => {
  const isSectionRow = r[0] !== ''
  const rowBg = isSectionRow ? C.accent : (i % 2 === 0 ? C.white : C.light)
  const textColor = isSectionRow ? C.white : C.text

  // Estimate actual height needed
  const maxLines = isSectionRow ? 12 :
    Math.max(
      doc.heightOfString(r[2], { width: cols.screen - 2, fontSize: 7 }),
      doc.heightOfString(r[3], { width: cols.action - 2, fontSize: 6.5 }),
      doc.heightOfString(r[4], { width: cols.words - 2, fontSize: 7 })
    )
  const rh = Math.max(isSectionRow ? 13 : 14, maxLines + 5)

  if (y + rh > PH - 40) {
    // No more pages in this design — content fits on 5 pages
    return
  }

  doc.rect(ML, y, CW, rh).fill(rowBg)

  if (isSectionRow) {
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(6.5)
      .text(r[0], colX.time, y + (rh - 7) / 2, { width: CW })
  } else {
    doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(7)
      .text(r[1], colX.time, y + 3, { width: cols.time })
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(7)
      .text(r[2], colX.screen, y + 3, { width: cols.screen - 2 })
    doc.fillColor('#374151').font('Helvetica').fontSize(6.5)
      .text(r[3], colX.action, y + 3, { width: cols.action - 2 })
    doc.fillColor(C.text).font('Helvetica-Oblique').fontSize(7)
      .text(r[4], colX.words, y + 3, { width: cols.words - 2 })
  }

  // Row border
  doc.moveTo(ML, y + rh).lineTo(ML + CW, y + rh)
    .strokeColor('#e5e7eb').lineWidth(0.3).stroke()

  y += rh
})

// Checklist
y += 10
if (y < PH - 100) {
  doc.rect(ML, y, CW, 11).fill(C.headerBg)
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(7)
    .text('PRE-RECORDING CHECKLIST', ML + 6, y + 2)
  y += 13

  const checks = [
    ['Wallet on Algorand Testnet (Pera / Defly / Lute)', 'Min 15 ALGO in wallet — fund at bank.testnet.algorand.network'],
    ['4+ subscriptions added with realistic names & amounts', 'One locked vault ready  ·  One released vault ready'],
    ['Agent Activity panel has at least one logged action', 'Screen record at 1920×1080 · 60fps · Browser zoom 90%'],
    ['Notifications off — Do Not Disturb enabled', 'Wallet popup tested — know where it appears on screen'],
  ]

  doc.rect(ML, y, CW, checks.length * 13 + 6).fill('#f9fafb')
  doc.rect(ML, y, CW, checks.length * 13 + 6).stroke('#e5e7eb')
  checks.forEach((pair, i) => {
    doc.fillColor(C.text).font('Helvetica').fontSize(7)
      .text(`☐  ${pair[0]}`, ML + 8, y + 5 + i * 13, { width: CW / 2 - 10 })
    doc.text(`☐  ${pair[1]}`, ML + CW / 2 + 4, y + 5 + i * 13, { width: CW / 2 - 12 })
  })
}

doc.end()
out.on('finish', () => {
  console.log('✓ demo-script-video.pdf generated successfully')
  console.log('  Open: public URL → /demo-script-video.pdf')
})
