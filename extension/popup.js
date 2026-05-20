const content = document.getElementById("content")

async function init() {
  // Check if user has a token
  const tokenRes = await sendMessage({ action: "getToken" })
  const token = tokenRes?.token

  if (!token) {
    showLogin()
    return
  }

  // Check for detected subscription
  const detectedRes = await sendMessage({ action: "getDetected" })
  const detected = detectedRes?.data

  if (detected) {
    showDetected(detected)
  } else {
    showEmpty()
  }
}

function showLogin() {
  content.innerHTML = `
    <div class="card login-section">
      <p>Paste your Unsubscribely session token to connect.</p>
      <p style="font-size:10px;color:#999;margin-bottom:8px;">Get it from: App → Settings → MCP → Generate Token</p>
      <input type="text" id="token-input" placeholder="Paste token here...">
      <button class="btn btn-primary" id="save-token-btn">Connect</button>
    </div>
  `
  document.getElementById("save-token-btn").addEventListener("click", async () => {
    const token = document.getElementById("token-input").value.trim()
    if (!token) return
    await sendMessage({ action: "setToken", token })
    init() // reload
  })
}

function showDetected(sub) {
  const priceStr = sub.amount
    ? `${sub.currency === "INR" ? "₹" : sub.currency === "EUR" ? "€" : "$"}${sub.amount}`
    : "Price not detected"

  content.innerHTML = `
    <div class="card">
      <div class="detected-name">${sub.name}</div>
      <div class="detected-meta">
        <span class="tag">${sub.category}</span>
        <span class="tag">${sub.billing_cycle}</span>
      </div>
      <div class="detected-price">${priceStr}<span style="font-size:11px;color:#888;font-weight:400;">/${sub.billing_cycle === "yearly" ? "yr" : "mo"}</span></div>
      <div class="detected-domain">${sub.domain}</div>
    </div>
    <button class="btn btn-primary" id="track-btn">Track in Unsubscribely</button>
    <button class="btn btn-secondary" id="dismiss-btn">Dismiss</button>
    <div class="status" id="status"></div>
  `

  document.getElementById("track-btn").addEventListener("click", async () => {
    const btn = document.getElementById("track-btn")
    const status = document.getElementById("status")
    btn.disabled = true
    btn.textContent = "Adding..."
    status.textContent = ""

    const res = await sendMessage({ action: "trackSubscription", data: sub })
    if (res.status === "success") {
      status.className = "status success"
      status.textContent = "✓ Added to Unsubscribely! Open the app to create a vault."
      btn.textContent = "Done"
    } else {
      status.className = "status error"
      status.textContent = res.error || "Failed to track"
      btn.disabled = false
      btn.textContent = "Track in Unsubscribely"
    }
  })

  document.getElementById("dismiss-btn").addEventListener("click", async () => {
    await sendMessage({ action: "clearDetected" })
    showEmpty()
  })
}

function showEmpty() {
  content.innerHTML = `
    <div class="empty">
      <p>No subscription detected on this page.</p>
      <p class="hint">Visit a subscription checkout page (Spotify, Netflix, etc.) and we'll detect it automatically.</p>
    </div>
    <button class="btn btn-secondary" id="disconnect-btn">Disconnect</button>
  `
  document.getElementById("disconnect-btn").addEventListener("click", async () => {
    await sendMessage({ action: "setToken", token: "" })
    chrome.storage.local.remove("unsubscribely_token")
    showLogin()
  })
}

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      resolve(response || {})
    })
  })
}

init()
