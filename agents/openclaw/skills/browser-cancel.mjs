/**
 * browser-cancel.mjs
 *
 * Playwright-based browser automation for subscription cancellation.
 *
 * Flow:
 *   1. Fetch subscription + encrypted credentials from Supabase
 *   2. Decrypt the password using SUBSCRIPTION_CREDS_KEY
 *   3. Find the cancel URL from the embedded catalog
 *   4. Launch headless Chromium, navigate, login, find cancel button
 *   5. Send screenshot to user via Telegram
 *   6. Update subscription status if successful
 */

import { createDecipheriv } from "node:crypto"

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CREDS_KEY = process.env.SUBSCRIPTION_CREDS_KEY

const CANCEL_URLS = {
  "netflix": "https://www.netflix.com/cancelplan",
  "spotify": "https://www.spotify.com/account/subscription/",
  "hulu": "https://secure.hulu.com/account/cancel",
  "disney": "https://www.disneyplus.com/account/subscription",
  "amazon prime": "https://www.amazon.com/gp/primecentral",
  "prime": "https://www.amazon.com/gp/primecentral",
  "hbo": "https://auth.max.com/subscription",
  "max": "https://auth.max.com/subscription",
  "paramount": "https://www.paramountplus.com/account/signin/?redirect_uri=/account/",
  "peacock": "https://www.peacocktv.com/account/plans",
  "youtube premium": "https://www.youtube.com/paid_memberships",
  "youtube": "https://www.youtube.com/paid_memberships",
  "google one": "https://one.google.com/storage",
  "notion": "https://www.notion.so/my-integrations",
  "figma": "https://www.figma.com/files/team/personal/billing",
  "slack": "https://my.slack.com/admin/billing",
  "dropbox": "https://www.dropbox.com/account/plan",
  "microsoft 365": "https://account.microsoft.com/services",
  "adobe": "https://account.adobe.com/plans",
  "canva": "https://www.canva.com/settings/billing-and-teams",
  "github": "https://github.com/settings/billing/plans",
  "vercel": "https://vercel.com/account/plans",
  "chatgpt": "https://chat.openai.com/#settings/Subscription",
  "openai": "https://chat.openai.com/#settings/Subscription",
  "claude": "https://claude.ai/settings/billing",
  "cursor": "https://www.cursor.com/settings",
  "lovable": "https://lovable.dev/settings/billing",
  "replit": "https://replit.com/account",
  "perplexity": "https://www.perplexity.ai/settings/subscription",
  "linkedin": "https://www.linkedin.com/premium/manage/",
  "duolingo": "https://www.duolingo.com/settings/super",
  "audible": "https://www.audible.com/account/cancel-membership",
  "medium": "https://medium.com/me/membership",
  "grammarly": "https://account.grammarly.com/subscription",
  "notion ai": "https://www.notion.so/my-integrations",
  "midjourney": "https://www.midjourney.com/account",
  "elevenlabs": "https://elevenlabs.io/subscription",
  "copilot": "https://github.com/settings/copilot",
  "icloud": "https://www.icloud.com/settings/",
  "apple music": "https://music.apple.com/account/settings",
  "crunchyroll": "https://www.crunchyroll.com/account/subscription",
  "nordvpn": "https://my.nordaccount.com/dashboard/nordvpn/",
  "expressvpn": "https://www.expressvpn.com/subscriptions",
  "1password": "https://my.1password.com/settings/billing",
  "todoist": "https://todoist.com/app/settings/subscription",
  "evernote": "https://www.evernote.com/Settings.action",
  "strava": "https://www.strava.com/settings/subscription",
}

function findCancelUrl(name) {
  const q = name.toLowerCase().trim()
  for (const [key, url] of Object.entries(CANCEL_URLS)) {
    if (q.includes(key) || key.includes(q)) return url
  }
  return null
}

function sbFetch(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  })
}

function decryptPassword(encryptedBase64, keyHex) {
  const key = Buffer.from(keyHex, "hex")
  const packed = Buffer.from(encryptedBase64, "base64")
  const iv = packed.subarray(0, 12)
  const authTag = packed.subarray(12, 28)
  const ciphertext = packed.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8")
}

async function sendTelegramPhoto(chatId, photoBuffer, caption) {
  if (!BOT_TOKEN || !chatId) return
  const formData = new FormData()
  formData.append("chat_id", chatId)
  formData.append("caption", caption)
  formData.append("photo", new Blob([photoBuffer], { type: "image/png" }), "screenshot.png")
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: "POST", body: formData }).catch(() => {})
}

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !chatId) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => {})
}

// ─── Helper functions ────────────────────────────────────────────────────────

function randomDelay(min = 800, max = 2500) {
  return Math.floor(Math.random() * (max - min) + min)
}

async function findVisible(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el && await el.isVisible().catch(() => false)) return el
    } catch {}
  }
  return null
}

async function clickButton(page, selectors) {
  const btn = await findVisible(page, selectors)
  if (btn) { await btn.click(); return true }
  return false
}

// ─── Main Playwright function ────────────────────────────────────────────────

async function runPlaywrightCancel({ cancelUrl, username, password, serviceName, chatId }) {
  let browser = null
  try {
    const { chromium } = await import("playwright")
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    })
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: { width: 1366 + Math.floor(Math.random() * 100), height: 768 + Math.floor(Math.random() * 50) },
      locale: "en-US",
      timezoneId: "America/New_York",
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      permissions: ["geolocation"],
    })
    // Stealth: comprehensive fingerprint evasion (2026 patterns)
    await context.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, "webdriver", { get: () => undefined })
      // Fake plugins
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] })
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] })
      // Chrome runtime
      window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) }
      // Permissions
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
      // WebGL vendor/renderer spoofing
      const getParameter = WebGLRenderingContext.prototype.getParameter
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return "Intel Inc."
        if (param === 37446) return "Intel Iris OpenGL Engine"
        return getParameter.call(this, param)
      }
      // Canvas fingerprint noise
      const toDataURL = HTMLCanvasElement.prototype.toDataURL
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === "image/png") {
          const ctx = this.getContext("2d")
          if (ctx) {
            const style = ctx.fillStyle
            ctx.fillStyle = "rgba(0,0,0,0.01)"
            ctx.fillRect(0, 0, 1, 1)
            ctx.fillStyle = style
          }
        }
        return toDataURL.apply(this, arguments)
      }
      // Hide automation indicators
      delete navigator.__proto__.webdriver
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => 0 })
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 })
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 })
    })
    const page = await context.newPage()

    // Step 1: Go to cancel URL (will likely redirect to login)
    console.log(`[browser-cancel] Navigating to ${cancelUrl}`)
    await page.goto(cancelUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(() =>
      page.goto(cancelUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
    )
    await page.waitForTimeout(3000)

    // Step 2: Login
    const loginSuccess = await doLogin(page, username, password)
    console.log(`[browser-cancel] Login ${loginSuccess ? "succeeded" : "failed/skipped"}`)

    // Step 3: After login, go to cancel URL again
    if (loginSuccess) {
      await page.goto(cancelUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(() =>
        page.goto(cancelUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
      )
      await page.waitForTimeout(3000)
    }

    // Step 4: Dismiss popups
    await clickButton(page, [
      'button:has-text("Accept")', 'button:has-text("Accept All")',
      'button:has-text("Got it")', 'button[aria-label="Close"]',
    ])

    // Step 5: Find and click cancel
    const cancelled = await clickCancel(page)

    // Step 6: Handle confirmations
    if (cancelled) await handleConfirm(page)

    // Step 7: Screenshot
    const screenshot = await page.screenshot({ type: "png" })
    console.log(`[browser-cancel] Screenshot: ${screenshot.length} bytes`)
    await browser.close()

    // Send screenshot
    const caption = cancelled
      ? `✅ ${serviceName} cancelled automatically!`
      : `❌ Couldn't find cancel button. Here's what the browser saw:`
    await sendTelegramPhoto(chatId, screenshot, caption)

    return { success: cancelled, output: cancelled ? "Cancelled" : "Cancel button not found", screenshot }
  } catch (err) {
    if (browser) await browser.close().catch(() => {})
    console.error(`[browser-cancel] Error: ${err.message}`)
    return { success: false, output: err.message }
  }
}

async function doLogin(page, username, password) {
  // Find email/username field
  const emailField = await findVisible(page, [
    'input[id="login-username"]', 'input[id="email"]',
    'input[name="username"]', 'input[name="email"]',
    'input[type="email"]', 'input[autocomplete="username"]',
    'input[placeholder*="email" i]', 'input[placeholder*="Email" i]',
  ])
  if (!emailField) return false

  // Fill email
  console.log(`[browser-cancel] Filling email: ${username}`)
  await emailField.click()
  await page.waitForTimeout(200)
  await emailField.fill(username)
  await page.waitForTimeout(500)

  // Check if password is already visible
  let pwField = await findVisible(page, ['input[type="password"]', 'input[id="login-password"]'])
  if (pwField) {
    // Single-step login
    console.log(`[browser-cancel] Single-step login`)
    await pwField.fill(password)
    await page.waitForTimeout(300)
    await clickButton(page, ['button[id="login-button"]', 'button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("Sign in")'])
    await page.waitForTimeout(5000)
    return !page.url().includes("/login")
  }

  // Multi-step: click Continue
  console.log(`[browser-cancel] Multi-step login — clicking submit`)
  await clickButton(page, [
    'button[id="login-button"]', 'button[type="submit"]',
    'button:has-text("Continue")', 'button:has-text("Next")', 'button:has-text("Log in")',
  ])

  // Wait for password field (poll every second for 12 seconds)
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000)
    pwField = await findVisible(page, ['input[type="password"]', 'input[id="login-password"]'])
    if (pwField) break
  }

  if (!pwField) {
    // Maybe page redirected — check for email field again
    const newEmail = await findVisible(page, ['input[id="login-username"]', 'input[name="username"]', 'input[type="email"]'])
    if (newEmail) {
      console.log(`[browser-cancel] Redirected — re-entering email`)
      await newEmail.click()
      await newEmail.fill(username)
      await page.waitForTimeout(500)
      await clickButton(page, ['button[type="submit"]', 'button:has-text("Continue")', 'button:has-text("Next")'])
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(1000)
        pwField = await findVisible(page, ['input[type="password"]', 'input[id="login-password"]'])
        if (pwField) break
      }
    }
  }

  if (!pwField) {
    console.log(`[browser-cancel] Password field never appeared`)
    return false
  }

  // Fill password and submit
  console.log(`[browser-cancel] Filling password`)
  await pwField.fill(password)
  await page.waitForTimeout(300)
  await clickButton(page, ['button[id="login-button"]', 'button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("Sign in")'])
  await page.waitForTimeout(5000)

  const loggedIn = !page.url().includes("/login") && !page.url().includes("/signin")
  console.log(`[browser-cancel] Post-login URL: ${page.url()} — loggedIn=${loggedIn}`)
  return loggedIn
}

async function clickCancel(page) {
  const selectors = [
    'button:has-text("Cancel Premium")', 'a:has-text("Cancel Premium")',
    'button:has-text("Cancel Subscription")', 'a:has-text("Cancel Subscription")',
    'button:has-text("Cancel Plan")', 'a:has-text("Cancel Plan")',
    'button:has-text("Cancel")',
    'a:has-text("Cancel my subscription")', 'button:has-text("End Membership")',
    'a:has-text("End Membership")', 'button:has-text("Deactivate")',
    'a:has-text("Downgrade")', 'button:has-text("Downgrade")',
    'a:has-text("Change plan")', 'button:has-text("Unsubscribe")',
    'a[href*="cancel"]', 'a[href*="downgrade"]',
  ]
  for (const sel of selectors) {
    try {
      const btn = await page.$(sel)
      if (btn && await btn.isVisible().catch(() => false)) {
        console.log(`[browser-cancel] Clicking: ${sel}`)
        await btn.click()
        await page.waitForTimeout(3000)
        return true
      }
    } catch {}
  }
  return false
}

async function handleConfirm(page) {
  for (let i = 0; i < 3; i++) {
    const clicked = await clickButton(page, [
      'button:has-text("Yes, cancel")', 'button:has-text("Confirm")',
      'button:has-text("Continue to cancel")', 'button:has-text("Cancel anyway")',
      'button:has-text("Cancel Premium")', 'button:has-text("I want to cancel")',
      'button:has-text("Yes")', 'button:has-text("Continue")',
      'button:has-text("Finish")', 'button:has-text("No thanks")',
      'a:has-text("Continue to cancel")', 'a:has-text("Cancel anyway")',
    ])
    if (!clicked) break
    await page.waitForTimeout(2000)
  }
}

// ─── Export: browserCancel ───────────────────────────────────────────────────

export async function browserCancel(subscriptionId, chatId) {
  if (!SUPABASE_URL || !SERVICE_KEY) return { success: false, message: "Missing server config" }
  if (!CREDS_KEY) return { success: false, message: "SUBSCRIPTION_CREDS_KEY not set" }

  const subRes = await sbFetch(`/subscriptions?id=eq.${subscriptionId}&select=id,name,amount,currency,user_id,service_username,service_password_enc&limit=1`)
  if (!subRes.ok) return { success: false, message: "Failed to fetch subscription" }
  const subs = await subRes.json()
  const sub = subs?.[0]
  if (!sub) return { success: false, message: "Subscription not found" }
  if (!sub.service_username || !sub.service_password_enc) {
    return { success: false, message: `No credentials stored for ${sub.name}` }
  }

  let password
  try { password = decryptPassword(sub.service_password_enc, CREDS_KEY) }
  catch (err) { return { success: false, message: "Failed to decrypt credentials" } }

  const cancelUrl = findCancelUrl(sub.name)
  if (!cancelUrl) return { success: false, message: `No cancel URL for ${sub.name}` }

  const amountStr = sub.amount ? `${sub.currency || "USD"} ${Number(sub.amount).toFixed(2)}` : ""

  await sendTelegram(chatId, `🤖 Starting browser cancellation for ${sub.name}...\nOpening ${cancelUrl}`)

  console.log(`[browser-cancel] Starting Playwright for ${sub.name}`)
  const result = await runPlaywrightCancel({ cancelUrl, username: sub.service_username, password, serviceName: sub.name, chatId })

  if (result.success) {
    // Mark subscription cancelled
    await sbFetch(`/subscriptions?id=eq.${subscriptionId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_method: "browser_agent" }),
    })

    // Update renewal alert to "done"
    await sbFetch(`/agent_renewal_alerts?subscription_id=eq.${subscriptionId}&user_decision=eq.cancel`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_decision: "done", decided_at: new Date().toISOString() }),
    })

    // Kill vault in DB
    const vaultRes = await sbFetch(`/escrow_vaults?subscription_id=eq.${subscriptionId}&status=eq.locked&select=id,app_id,vault_type&limit=1`)
    const vaults = vaultRes.ok ? await vaultRes.json() : []
    if (vaults && vaults.length > 0) {
      await sbFetch(`/escrow_vaults?id=eq.${vaults[0].id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "killed", killed_at: new Date().toISOString() }),
      })
      // Try on-chain kill (fire and forget)
      try {
        const { killVaultOnChain } = await import("./release-vault.mjs")
        killVaultOnChain(vaults[0]).catch((err) => {
          console.warn(`[browser-cancel] On-chain vault kill failed: ${err.message}`)
        })
      } catch {}
    }

    const savingsMsg = amountStr ? ` You saved ${amountStr}/month!` : ""
    await sendTelegram(chatId, `✅ ${sub.name} cancelled via browser automation!${savingsMsg}\n\n🔓 Vault killed — ALGO returning to your wallet.`)
    console.log(`[browser-cancel] ✓ ${sub.name} cancelled + vault killed`)
    return { success: true, message: `${sub.name} cancelled via browser` }
  }

  console.log(`[browser-cancel] Failed: ${result.output}`)
  return { success: false, message: result.output || "Browser cancel failed" }
}
