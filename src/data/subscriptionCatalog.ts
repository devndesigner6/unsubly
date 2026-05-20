/**
 * Comprehensive subscription catalog — 400+ services
 *
 * Sections:
 *   1. Global Top 100 (streaming, music, productivity, AI, cloud, fitness)
 *   2. Indian Top 100 (OTT, edtech, fintech, news, health)
 *   3. Next 100 Popular (gaming, VPN, password managers, design, dev tools)
 *   4. Other 100+ (niche, regional, B2B SaaS)
 *
 * Each entry has:
 *   - name: canonical display name
 *   - domain: used for favicon (https://www.google.com/s2/favicons?domain=X&sz=32)
 *   - aliases: lowercase strings for fuzzy matching when user types
 *   - category: for grouping in the UI
 *   - cancelUrl: direct cancel page URL
 *   - steps: 2-4 step cancellation instructions
 *   - note: optional gotcha
 *   - autoCancel: true if OpenClaw browser can cancel automatically
 */

export interface SubscriptionEntry {
  name: string
  domain: string
  aliases: string[]
  category: string
  cancelUrl: string
  steps: string[]
  note?: string
  autoCancel?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — GLOBAL TOP 100
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_TOP_100: SubscriptionEntry[] = [
  // Streaming Video
  { name: "Netflix", domain: "netflix.com", aliases: ["netflix"], category: "Streaming", cancelUrl: "https://www.netflix.com/cancelplan", steps: ["Sign in", "Click 'Finish Cancellation'", "Confirm"], note: "Access continues until billing period ends.", autoCancel: true },
  { name: "Disney+", domain: "disneyplus.com", aliases: ["disney+", "disney plus", "disneyplus"], category: "Streaming", cancelUrl: "https://www.disneyplus.com/account/subscription", steps: ["Sign in", "Click 'Cancel Subscription'", "Confirm"], autoCancel: true },
  { name: "Hulu", domain: "hulu.com", aliases: ["hulu"], category: "Streaming", cancelUrl: "https://secure.hulu.com/account/cancel", steps: ["Sign in", "Click 'Cancel' next to your plan", "Choose 'Continue to Cancel'"], autoCancel: true },
  { name: "HBO Max", domain: "max.com", aliases: ["hbo max", "hbo", "max"], category: "Streaming", cancelUrl: "https://auth.max.com/subscription", steps: ["Sign in to Max", "Open Subscription settings", "Click 'Cancel Subscription'"], autoCancel: true },
  { name: "Amazon Prime", domain: "amazon.com", aliases: ["amazon prime", "prime video", "prime"], category: "Streaming", cancelUrl: "https://www.amazon.com/gp/primecentral", steps: ["Sign in", "Go to 'Manage Membership'", "Click 'End Membership'", "Click through 3 confirmation screens"], note: "Amazon shows multiple retention offers.", autoCancel: true },
  { name: "Apple TV+", domain: "apple.com", aliases: ["apple tv+", "apple tv", "appletv"], category: "Streaming", cancelUrl: "https://tv.apple.com/account", steps: ["Sign in with Apple ID", "Open Settings → Subscriptions", "Cancel Apple TV+"] },
  { name: "Paramount+", domain: "paramountplus.com", aliases: ["paramount+", "paramount plus"], category: "Streaming", cancelUrl: "https://www.paramountplus.com/account/", steps: ["Sign in", "Open Account → Cancel Subscription", "Confirm"], autoCancel: true },
  { name: "Peacock", domain: "peacocktv.com", aliases: ["peacock"], category: "Streaming", cancelUrl: "https://www.peacocktv.com/account/plans", steps: ["Sign in", "Open Plans & Payment", "Choose 'Cancel Plan'"], autoCancel: true },
  { name: "YouTube Premium", domain: "youtube.com", aliases: ["youtube premium", "yt premium"], category: "Streaming", cancelUrl: "https://www.youtube.com/paid_memberships", steps: ["Sign in with Google", "Click 'Manage membership'", "Click 'Deactivate'", "Confirm reason"], autoCancel: true },
  { name: "Crunchyroll", domain: "crunchyroll.com", aliases: ["crunchyroll"], category: "Streaming", cancelUrl: "https://www.crunchyroll.com/account/membership", steps: ["Sign in", "Go to Membership", "Click 'Cancel Membership'"], autoCancel: true },
  { name: "Funimation", domain: "funimation.com", aliases: ["funimation"], category: "Streaming", cancelUrl: "https://www.funimation.com/account/subscription/", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Discovery+", domain: "discoveryplus.com", aliases: ["discovery+", "discovery plus"], category: "Streaming", cancelUrl: "https://www.discoveryplus.com/account", steps: ["Sign in", "Open Account → Subscription", "Cancel"] },
  { name: "Shudder", domain: "shudder.com", aliases: ["shudder"], category: "Streaming", cancelUrl: "https://www.shudder.com/account", steps: ["Sign in", "Open Account", "Cancel Membership"] },
  { name: "Mubi", domain: "mubi.com", aliases: ["mubi"], category: "Streaming", cancelUrl: "https://mubi.com/account", steps: ["Sign in", "Open Account → Subscription", "Cancel"] },
  { name: "Plex Pass", domain: "plex.tv", aliases: ["plex", "plex pass"], category: "Streaming", cancelUrl: "https://www.plex.tv/plex-pass/", steps: ["Sign in", "Open Plex Pass", "Cancel subscription"] },

  // Music
  { name: "Spotify", domain: "spotify.com", aliases: ["spotify"], category: "Music", cancelUrl: "https://www.spotify.com/account/subscription/", steps: ["Sign in", "Scroll to 'Available plans'", "Pick 'Spotify Free'", "Click 'Cancel Premium'"], note: "Premium continues until billing date.", autoCancel: true },
  { name: "Apple Music", domain: "apple.com", aliases: ["apple music"], category: "Music", cancelUrl: "https://music.apple.com/account/settings", steps: ["Sign in with Apple ID", "Open Settings → Subscriptions", "Cancel Apple Music"] },
  { name: "Tidal", domain: "tidal.com", aliases: ["tidal"], category: "Music", cancelUrl: "https://my.tidal.com/account/subscription", steps: ["Sign in", "Open Subscription", "Click 'Cancel Subscription'"], autoCancel: true },
  { name: "Amazon Music", domain: "amazon.com", aliases: ["amazon music unlimited", "amazon music"], category: "Music", cancelUrl: "https://www.amazon.com/music/unlimited/manage", steps: ["Sign in", "Click 'Cancel Subscription'", "Confirm"] },
  { name: "Deezer", domain: "deezer.com", aliases: ["deezer"], category: "Music", cancelUrl: "https://www.deezer.com/account/offers", steps: ["Sign in", "Open Offers", "Cancel subscription"], autoCancel: true },
  { name: "SoundCloud Go", domain: "soundcloud.com", aliases: ["soundcloud", "soundcloud go"], category: "Music", cancelUrl: "https://soundcloud.com/settings/subscription", steps: ["Sign in", "Open Settings → Subscription", "Cancel"] },
  { name: "YouTube Music", domain: "youtube.com", aliases: ["youtube music", "yt music"], category: "Music", cancelUrl: "https://music.youtube.com/paid_memberships", steps: ["Sign in", "Manage membership", "Deactivate"] },
  { name: "Pandora", domain: "pandora.com", aliases: ["pandora"], category: "Music", cancelUrl: "https://www.pandora.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "iHeartRadio", domain: "iheart.com", aliases: ["iheartradio", "iheart"], category: "Music", cancelUrl: "https://www.iheart.com/account/", steps: ["Sign in", "Open Account", "Cancel subscription"] },

  // AI Tools
  { name: "ChatGPT Plus", domain: "openai.com", aliases: ["chatgpt", "chatgpt plus", "openai"], category: "AI", cancelUrl: "https://chat.openai.com/#settings/Subscription", steps: ["Sign in", "Open Settings → Subscription", "Click 'Cancel Plan'"], autoCancel: true },
  { name: "Claude Pro", domain: "claude.ai", aliases: ["claude", "claude pro", "anthropic"], category: "AI", cancelUrl: "https://claude.ai/settings/billing", steps: ["Sign in", "Open Settings → Billing", "Cancel subscription"], autoCancel: true },
  { name: "Gemini Advanced", domain: "gemini.google.com", aliases: ["gemini", "gemini advanced", "google gemini"], category: "AI", cancelUrl: "https://one.google.com/storage", steps: ["Sign in with Google", "Open Google One", "Cancel Gemini Advanced"] },
  { name: "Perplexity Pro", domain: "perplexity.ai", aliases: ["perplexity", "perplexity pro"], category: "AI", cancelUrl: "https://www.perplexity.ai/settings/account", steps: ["Sign in", "Open Settings → Account", "Cancel Pro"] },
  { name: "Midjourney", domain: "midjourney.com", aliases: ["midjourney"], category: "AI", cancelUrl: "https://www.midjourney.com/account/", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "Runway", domain: "runwayml.com", aliases: ["runway", "runway ml"], category: "AI", cancelUrl: "https://app.runwayml.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "ElevenLabs", domain: "elevenlabs.io", aliases: ["elevenlabs"], category: "AI", cancelUrl: "https://elevenlabs.io/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Jasper", domain: "jasper.ai", aliases: ["jasper", "jasper ai"], category: "AI", cancelUrl: "https://app.jasper.ai/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Copy.ai", domain: "copy.ai", aliases: ["copy.ai", "copyai"], category: "AI", cancelUrl: "https://app.copy.ai/settings/billing", steps: ["Sign in", "Open Billing", "Cancel"] },
  { name: "Writesonic", domain: "writesonic.com", aliases: ["writesonic"], category: "AI", cancelUrl: "https://app.writesonic.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },

  // Productivity & SaaS
  { name: "Notion", domain: "notion.so", aliases: ["notion"], category: "Productivity", cancelUrl: "https://www.notion.so/my-integrations", steps: ["Sign in", "Open Settings & Members → Plans", "Click 'Downgrade' → 'Free'"], autoCancel: true },
  { name: "Figma", domain: "figma.com", aliases: ["figma"], category: "Design", cancelUrl: "https://www.figma.com/files/team/personal/billing", steps: ["Sign in", "Open Settings → Plans", "Click 'Cancel plan'"], autoCancel: true },
  { name: "Slack", domain: "slack.com", aliases: ["slack"], category: "Productivity", cancelUrl: "https://my.slack.com/admin/billing", steps: ["Sign in as admin", "Open Billing → Change plan", "Choose 'Cancel paid plan'"], autoCancel: true },
  { name: "Dropbox", domain: "dropbox.com", aliases: ["dropbox"], category: "Cloud Storage", cancelUrl: "https://www.dropbox.com/account/plan", steps: ["Sign in", "Open Plan → Cancel plan", "Choose a reason and confirm"], autoCancel: true },
  { name: "Google One", domain: "one.google.com", aliases: ["google one", "google storage"], category: "Cloud Storage", cancelUrl: "https://one.google.com/storage", steps: ["Sign in with Google", "Open Settings → Cancel Membership", "Confirm"], autoCancel: true },
  { name: "iCloud+", domain: "icloud.com", aliases: ["icloud", "icloud+"], category: "Cloud Storage", cancelUrl: "https://www.icloud.com/settings", steps: ["On Apple device: Settings → [name] → iCloud", "Tap 'Manage Storage' → 'Change Storage Plan'", "Tap 'Downgrade Options' → Free"] },
  { name: "Microsoft 365", domain: "microsoft.com", aliases: ["microsoft 365", "office 365", "m365", "microsoft office"], category: "Productivity", cancelUrl: "https://account.microsoft.com/services", steps: ["Sign in", "Find Microsoft 365 → Manage → Cancel Subscription", "Confirm"], autoCancel: true },
  { name: "Adobe Creative Cloud", domain: "adobe.com", aliases: ["adobe", "creative cloud", "adobe cc", "photoshop", "illustrator", "premiere"], category: "Design", cancelUrl: "https://account.adobe.com/plans", steps: ["Sign in", "Click 'Manage plan' → 'Cancel plan'", "Confirm"], note: "Annual plans cancelled mid-term incur a 50% fee.", autoCancel: true },
  { name: "Canva Pro", domain: "canva.com", aliases: ["canva", "canva pro"], category: "Design", cancelUrl: "https://www.canva.com/settings/billing-and-teams", steps: ["Sign in", "Open Billing & Plans", "Click 'Cancel subscription'"], autoCancel: true },
  { name: "GitHub", domain: "github.com", aliases: ["github", "github pro", "github copilot", "copilot"], category: "Developer", cancelUrl: "https://github.com/settings/billing/plans", steps: ["Sign in", "Open Settings → Billing & plans", "Click 'Downgrade' or 'Cancel'"], autoCancel: true },
  { name: "Vercel", domain: "vercel.com", aliases: ["vercel"], category: "Developer", cancelUrl: "https://vercel.com/account/plans", steps: ["Sign in", "Open Account Settings → Plans", "Click 'Downgrade to Hobby'"], autoCancel: true },
  { name: "Cursor", domain: "cursor.sh", aliases: ["cursor"], category: "Developer", cancelUrl: "https://www.cursor.com/settings", steps: ["Sign in", "Open Settings → Manage Subscription", "Click 'Cancel Plan'"], autoCancel: true },
  { name: "Replit", domain: "replit.com", aliases: ["replit"], category: "Developer", cancelUrl: "https://replit.com/account", steps: ["Sign in", "Open Account → Membership", "Click 'Cancel'"], autoCancel: true },
  { name: "Lovable", domain: "lovable.dev", aliases: ["lovable"], category: "Developer", cancelUrl: "https://lovable.dev/settings/billing", steps: ["Sign in", "Open Settings → Billing", "Cancel subscription"] },
  { name: "Linear", domain: "linear.app", aliases: ["linear"], category: "Productivity", cancelUrl: "https://linear.app/settings/billing", steps: ["Sign in", "Open Settings → Billing", "Cancel plan"] },
  { name: "Loom", domain: "loom.com", aliases: ["loom"], category: "Productivity", cancelUrl: "https://www.loom.com/settings/billing", steps: ["Sign in", "Open Settings → Billing", "Cancel subscription"] },
  { name: "Miro", domain: "miro.com", aliases: ["miro"], category: "Productivity", cancelUrl: "https://miro.com/app/settings/billing/", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Airtable", domain: "airtable.com", aliases: ["airtable"], category: "Productivity", cancelUrl: "https://airtable.com/account", steps: ["Sign in", "Open Account → Billing", "Downgrade to Free"] },
  { name: "Asana", domain: "asana.com", aliases: ["asana"], category: "Productivity", cancelUrl: "https://app.asana.com/admin/billing", steps: ["Sign in as admin", "Open Billing", "Downgrade to Basic"] },
  { name: "Monday.com", domain: "monday.com", aliases: ["monday", "monday.com"], category: "Productivity", cancelUrl: "https://auth.monday.com/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Trello", domain: "trello.com", aliases: ["trello"], category: "Productivity", cancelUrl: "https://trello.com/billing", steps: ["Sign in", "Open Billing", "Cancel Premium"] },
  { name: "Todoist", domain: "todoist.com", aliases: ["todoist"], category: "Productivity", cancelUrl: "https://todoist.com/app/settings/subscription", steps: ["Sign in", "Open Settings → Subscription", "Cancel Pro"] },
  { name: "Evernote", domain: "evernote.com", aliases: ["evernote"], category: "Productivity", cancelUrl: "https://www.evernote.com/Billing.action", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Grammarly", domain: "grammarly.com", aliases: ["grammarly"], category: "Productivity", cancelUrl: "https://account.grammarly.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel Premium"] },

  // Cloud & Hosting
  { name: "AWS", domain: "aws.amazon.com", aliases: ["aws", "amazon web services"], category: "Cloud", cancelUrl: "https://console.aws.amazon.com/billing/home#/account", steps: ["Sign in to AWS Console", "Open Billing → Account → Close Account", "Read warning and confirm"], note: "Closing AWS account is permanent." },
  { name: "Google Cloud", domain: "cloud.google.com", aliases: ["google cloud", "gcp"], category: "Cloud", cancelUrl: "https://console.cloud.google.com/billing", steps: ["Sign in", "Open Billing", "Close billing account"] },
  { name: "DigitalOcean", domain: "digitalocean.com", aliases: ["digitalocean"], category: "Cloud", cancelUrl: "https://cloud.digitalocean.com/account/billing", steps: ["Sign in", "Open Billing", "Destroy all resources then close account"] },
  { name: "Heroku", domain: "heroku.com", aliases: ["heroku"], category: "Cloud", cancelUrl: "https://dashboard.heroku.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Cloudflare", domain: "cloudflare.com", aliases: ["cloudflare"], category: "Cloud", cancelUrl: "https://dash.cloudflare.com/profile/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Netlify", domain: "netlify.com", aliases: ["netlify"], category: "Developer", cancelUrl: "https://app.netlify.com/teams/billing", steps: ["Sign in", "Open Billing", "Downgrade to Starter"] },
  { name: "Railway", domain: "railway.app", aliases: ["railway"], category: "Developer", cancelUrl: "https://railway.app/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Render", domain: "render.com", aliases: ["render"], category: "Developer", cancelUrl: "https://dashboard.render.com/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },

  // Security & VPN
  { name: "NordVPN", domain: "nordvpn.com", aliases: ["nordvpn", "nord vpn"], category: "VPN", cancelUrl: "https://my.nordaccount.com/dashboard/nordvpn/subscriptions/", steps: ["Sign in", "Open Subscriptions", "Cancel auto-renewal"] },
  { name: "ExpressVPN", domain: "expressvpn.com", aliases: ["expressvpn", "express vpn"], category: "VPN", cancelUrl: "https://www.expressvpn.com/subscriptions", steps: ["Sign in", "Open Subscriptions", "Cancel"] },
  { name: "Surfshark", domain: "surfshark.com", aliases: ["surfshark"], category: "VPN", cancelUrl: "https://my.surfshark.com/vpn/manual-setup/main/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "ProtonVPN", domain: "protonvpn.com", aliases: ["protonvpn", "proton vpn"], category: "VPN", cancelUrl: "https://account.proton.me/dashboard", steps: ["Sign in", "Open Dashboard", "Cancel subscription"] },
  { name: "1Password", domain: "1password.com", aliases: ["1password", "one password"], category: "Security", cancelUrl: "https://my.1password.com/profile/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "LastPass", domain: "lastpass.com", aliases: ["lastpass"], category: "Security", cancelUrl: "https://lastpass.com/account.php", steps: ["Sign in", "Open Account Settings", "Cancel Premium"] },
  { name: "Bitwarden", domain: "bitwarden.com", aliases: ["bitwarden"], category: "Security", cancelUrl: "https://vault.bitwarden.com/#/settings/subscription", steps: ["Sign in", "Open Subscription", "Cancel Premium"] },
  { name: "Dashlane", domain: "dashlane.com", aliases: ["dashlane"], category: "Security", cancelUrl: "https://app.dashlane.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },

  // Fitness & Wellness
  { name: "Peloton", domain: "onepeloton.com", aliases: ["peloton"], category: "Fitness", cancelUrl: "https://account.onepeloton.com/preferences/membership", steps: ["Sign in", "Open Membership → Cancel Membership", "Confirm"] },
  { name: "Calm", domain: "calm.com", aliases: ["calm"], category: "Wellness", cancelUrl: "https://app.calm.com/me", steps: ["Sign in", "Open Profile → Manage Subscription", "Cancel"] },
  { name: "Headspace", domain: "headspace.com", aliases: ["headspace"], category: "Wellness", cancelUrl: "https://my.headspace.com/subscription", steps: ["Sign in", "Open Subscription settings", "Cancel"] },
  { name: "Noom", domain: "noom.com", aliases: ["noom"], category: "Fitness", cancelUrl: "https://web.noom.com/settings/subscription", steps: ["Sign in", "Open Settings → Subscription", "Cancel"] },
  { name: "MyFitnessPal", domain: "myfitnesspal.com", aliases: ["myfitnesspal", "mfp"], category: "Fitness", cancelUrl: "https://www.myfitnesspal.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel Premium"] },
  { name: "Strava", domain: "strava.com", aliases: ["strava"], category: "Fitness", cancelUrl: "https://www.strava.com/settings/subscription", steps: ["Sign in", "Open Subscription", "Cancel Summit"] },

  // News & Reading
  { name: "New York Times", domain: "nytimes.com", aliases: ["new york times", "nyt", "ny times", "nytimes"], category: "News", cancelUrl: "https://www.nytimes.com/subscription/manage", steps: ["Sign in", "Open 'Manage Subscriptions'", "Click 'Cancel'", "Follow prompts"], note: "NYT often requires a chat agent." },
  { name: "Wall Street Journal", domain: "wsj.com", aliases: ["wsj", "wall street journal"], category: "News", cancelUrl: "https://customercenter.wsj.com/view/membership", steps: ["Sign in", "Open Membership → Cancel Subscription", "Confirm"] },
  { name: "Washington Post", domain: "washingtonpost.com", aliases: ["washington post", "wapo"], category: "News", cancelUrl: "https://subscribe.washingtonpost.com/account/subscription/manage/", steps: ["Sign in", "Open Subscription → Cancel", "Confirm"] },
  { name: "Medium", domain: "medium.com", aliases: ["medium"], category: "Reading", cancelUrl: "https://medium.com/me/membership", steps: ["Sign in", "Open Membership settings", "Click 'Cancel Membership'"] },
  { name: "Substack", domain: "substack.com", aliases: ["substack"], category: "Reading", cancelUrl: "https://substack.com/account", steps: ["Sign in", "Open the publication", "Click 'Cancel subscription'"], note: "Each Substack is cancelled separately." },
  { name: "Audible", domain: "audible.com", aliases: ["audible"], category: "Reading", cancelUrl: "https://www.audible.com/account/cancel-membership", steps: ["Sign in", "Choose cancel reason", "Click 'Cancel Membership'"], note: "Use credits before cancelling." },
  { name: "Kindle Unlimited", domain: "amazon.com", aliases: ["kindle unlimited", "kindle"], category: "Reading", cancelUrl: "https://www.amazon.com/manageyourkindle", steps: ["Sign in", "Open Manage Your Kindle", "Cancel Kindle Unlimited"] },
  { name: "Scribd", domain: "scribd.com", aliases: ["scribd"], category: "Reading", cancelUrl: "https://www.scribd.com/account-settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },

  // LinkedIn & Professional
  { name: "LinkedIn Premium", domain: "linkedin.com", aliases: ["linkedin", "linkedin premium"], category: "Professional", cancelUrl: "https://www.linkedin.com/premium/manage/", steps: ["Sign in", "Open Premium subscription settings", "Click 'Cancel subscription'"] },
  { name: "Duolingo Super", domain: "duolingo.com", aliases: ["duolingo", "duolingo super", "duolingo plus"], category: "Education", cancelUrl: "https://www.duolingo.com/settings/super", steps: ["Sign in", "Open Super → Manage Subscription", "Cancel"] },
]

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — INDIAN TOP 100
// ─────────────────────────────────────────────────────────────────────────────
const INDIA_TOP_100: SubscriptionEntry[] = [
  // OTT Streaming
  { name: "JioHotstar", domain: "jiohotstar.com", aliases: ["jiohotstar", "hotstar", "disney hotstar", "jio hotstar"], category: "Streaming", cancelUrl: "https://www.jiohotstar.com/in/subscribe", steps: ["Sign in", "Open Account → Subscription", "Cancel subscription"], note: "Formerly Disney+ Hotstar." },
  { name: "Amazon Prime India", domain: "amazon.in", aliases: ["amazon prime india", "prime india"], category: "Streaming", cancelUrl: "https://www.amazon.in/gp/primecentral", steps: ["Sign in", "Go to 'Manage Membership'", "Click 'End Membership'"] },
  { name: "Netflix India", domain: "netflix.com", aliases: ["netflix india"], category: "Streaming", cancelUrl: "https://www.netflix.com/cancelplan", steps: ["Sign in", "Click 'Finish Cancellation'", "Confirm"] },
  { name: "Sony LIV", domain: "sonyliv.com", aliases: ["sonyliv", "sony liv", "sony"], category: "Streaming", cancelUrl: "https://www.sonyliv.com/settings/subscription", steps: ["Sign in", "Open Settings → Subscription", "Cancel subscription"] },
  { name: "ZEE5", domain: "zee5.com", aliases: ["zee5", "zee 5"], category: "Streaming", cancelUrl: "https://www.zee5.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Voot", domain: "voot.com", aliases: ["voot", "voot select"], category: "Streaming", cancelUrl: "https://www.voot.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "MX Player", domain: "mxplayer.in", aliases: ["mx player", "mxplayer"], category: "Streaming", cancelUrl: "https://www.mxplayer.in/subscription", steps: ["Sign in", "Open Subscription", "Cancel MX Gold"] },
  { name: "Aha", domain: "aha.video", aliases: ["aha", "aha video"], category: "Streaming", cancelUrl: "https://www.aha.video/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Hoichoi", domain: "hoichoi.tv", aliases: ["hoichoi"], category: "Streaming", cancelUrl: "https://www.hoichoi.tv/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Manorama Max", domain: "manoramamax.com", aliases: ["manorama max", "manorama"], category: "Streaming", cancelUrl: "https://www.manoramamax.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Sun NXT", domain: "sunnxt.com", aliases: ["sun nxt", "sunnxt"], category: "Streaming", cancelUrl: "https://www.sunnxt.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Lionsgate Play", domain: "lionsgateplay.com", aliases: ["lionsgate play", "lionsgate"], category: "Streaming", cancelUrl: "https://www.lionsgateplay.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Hungama Play", domain: "hungama.com", aliases: ["hungama", "hungama play"], category: "Streaming", cancelUrl: "https://www.hungama.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "ShemarooMe", domain: "shemaroome.com", aliases: ["shemaroome", "shemaroo"], category: "Streaming", cancelUrl: "https://www.shemaroome.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Ullu", domain: "ullu.app", aliases: ["ullu"], category: "Streaming", cancelUrl: "https://www.ullu.app/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "JioCinema", domain: "jiocinema.com", aliases: ["jiocinema", "jio cinema"], category: "Streaming", cancelUrl: "https://www.jiocinema.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Airtel Xstream", domain: "airtelxstream.in", aliases: ["airtel xstream", "xstream"], category: "Streaming", cancelUrl: "https://www.airtelxstream.in/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },

  // Music India
  { name: "Gaana Plus", domain: "gaana.com", aliases: ["gaana", "gaana plus"], category: "Music", cancelUrl: "https://gaana.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel Gaana Plus"] },
  { name: "JioSaavn Pro", domain: "jiosaavn.com", aliases: ["jiosaavn", "jio saavn", "saavn"], category: "Music", cancelUrl: "https://www.jiosaavn.com/settings/subscription", steps: ["Sign in", "Open Settings → Subscription", "Cancel Pro"] },
  { name: "Wynk Music", domain: "wynk.in", aliases: ["wynk", "wynk music"], category: "Music", cancelUrl: "https://wynk.in/music/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Hungama Music", domain: "hungama.com", aliases: ["hungama music"], category: "Music", cancelUrl: "https://www.hungama.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },

  // EdTech India
  { name: "BYJU'S", domain: "byjus.com", aliases: ["byjus", "byju's", "byju"], category: "Education", cancelUrl: "https://byjus.com/contact-us/", steps: ["Contact BYJU'S support", "Request cancellation via email or call", "Get written confirmation"], note: "BYJU'S requires contacting support to cancel." },
  { name: "Unacademy", domain: "unacademy.com", aliases: ["unacademy"], category: "Education", cancelUrl: "https://unacademy.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Vedantu", domain: "vedantu.com", aliases: ["vedantu"], category: "Education", cancelUrl: "https://www.vedantu.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "upGrad", domain: "upgrad.com", aliases: ["upgrad"], category: "Education", cancelUrl: "https://www.upgrad.com/contact-us/", steps: ["Contact upGrad support", "Request cancellation", "Get confirmation"] },
  { name: "Coursera Plus", domain: "coursera.org", aliases: ["coursera", "coursera plus"], category: "Education", cancelUrl: "https://www.coursera.org/account-profile", steps: ["Sign in", "Open Account Profile → Subscriptions", "Cancel Coursera Plus"] },
  { name: "Udemy Business", domain: "udemy.com", aliases: ["udemy", "udemy business"], category: "Education", cancelUrl: "https://www.udemy.com/user/edit-account/", steps: ["Sign in", "Open Account Settings", "Cancel subscription"] },
  { name: "LinkedIn Learning", domain: "linkedin.com", aliases: ["linkedin learning"], category: "Education", cancelUrl: "https://www.linkedin.com/learning/settings/", steps: ["Sign in", "Open Learning Settings", "Cancel subscription"] },
  { name: "Skillshare", domain: "skillshare.com", aliases: ["skillshare"], category: "Education", cancelUrl: "https://www.skillshare.com/settings/membership", steps: ["Sign in", "Open Membership settings", "Cancel"] },
  { name: "Simplilearn", domain: "simplilearn.com", aliases: ["simplilearn"], category: "Education", cancelUrl: "https://www.simplilearn.com/contact-us", steps: ["Contact Simplilearn support", "Request cancellation"] },
  { name: "Great Learning", domain: "greatlearning.in", aliases: ["great learning", "greatlearning"], category: "Education", cancelUrl: "https://www.greatlearning.in/contact-us", steps: ["Contact support", "Request cancellation"] },
  { name: "Physics Wallah", domain: "pw.live", aliases: ["physics wallah", "pw", "pw live"], category: "Education", cancelUrl: "https://www.pw.live/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Khan Academy", domain: "khanacademy.org", aliases: ["khan academy", "khanacademy"], category: "Education", cancelUrl: "https://www.khanacademy.org/donate", steps: ["Sign in", "Open Donations/Subscriptions", "Cancel"] },

  // Fintech & Finance India
  { name: "Zerodha Kite", domain: "zerodha.com", aliases: ["zerodha", "kite"], category: "Finance", cancelUrl: "https://zerodha.com/account/", steps: ["Sign in", "Open Account", "Contact support to close account"] },
  { name: "Groww", domain: "groww.in", aliases: ["groww"], category: "Finance", cancelUrl: "https://groww.in/profile/settings", steps: ["Sign in", "Open Settings", "Contact support"] },
  { name: "Upstox", domain: "upstox.com", aliases: ["upstox"], category: "Finance", cancelUrl: "https://upstox.com/account/", steps: ["Sign in", "Open Account", "Contact support"] },
  { name: "ET Money", domain: "etmoney.com", aliases: ["et money", "etmoney"], category: "Finance", cancelUrl: "https://www.etmoney.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Paytm Money", domain: "paytmmoney.com", aliases: ["paytm money"], category: "Finance", cancelUrl: "https://www.paytmmoney.com/account", steps: ["Sign in", "Open Account", "Cancel subscription"] },

  // News India
  { name: "The Hindu", domain: "thehindu.com", aliases: ["the hindu", "hindu"], category: "News", cancelUrl: "https://www.thehindu.com/subscription/manage/", steps: ["Sign in", "Open Manage Subscription", "Cancel"] },
  { name: "Times of India", domain: "timesofindia.com", aliases: ["times of india", "toi"], category: "News", cancelUrl: "https://timesofindia.indiatimes.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Hindustan Times", domain: "hindustantimes.com", aliases: ["hindustan times", "ht"], category: "News", cancelUrl: "https://www.hindustantimes.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Indian Express", domain: "indianexpress.com", aliases: ["indian express"], category: "News", cancelUrl: "https://indianexpress.com/subscription/", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Mint", domain: "livemint.com", aliases: ["mint", "livemint"], category: "News", cancelUrl: "https://www.livemint.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "The Wire", domain: "thewire.in", aliases: ["the wire"], category: "News", cancelUrl: "https://thewire.in/support", steps: ["Sign in", "Open Support/Subscription", "Cancel"] },
  { name: "Scroll", domain: "scroll.in", aliases: ["scroll", "scroll.in"], category: "News", cancelUrl: "https://scroll.in/subscribe", steps: ["Sign in", "Open Subscription", "Cancel"] },

  // Health & Fitness India
  { name: "HealthifyMe", domain: "healthifyme.com", aliases: ["healthifyme"], category: "Health", cancelUrl: "https://www.healthifyme.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Cult.fit", domain: "cult.fit", aliases: ["cult.fit", "cult fit", "curefit"], category: "Fitness", cancelUrl: "https://www.cult.fit/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Fittr", domain: "fittr.com", aliases: ["fittr"], category: "Fitness", cancelUrl: "https://www.fittr.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "1mg", domain: "1mg.com", aliases: ["1mg", "tata 1mg"], category: "Health", cancelUrl: "https://www.1mg.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Practo", domain: "practo.com", aliases: ["practo"], category: "Health", cancelUrl: "https://www.practo.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },

  // Productivity India
  { name: "Zoho One", domain: "zoho.com", aliases: ["zoho", "zoho one", "zoho mail"], category: "Productivity", cancelUrl: "https://accounts.zoho.in/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Freshworks", domain: "freshworks.com", aliases: ["freshworks", "freshdesk", "freshsales"], category: "Productivity", cancelUrl: "https://support.freshworks.com/", steps: ["Contact Freshworks support", "Request cancellation"] },
  { name: "Razorpay", domain: "razorpay.com", aliases: ["razorpay"], category: "Finance", cancelUrl: "https://dashboard.razorpay.com/app/account", steps: ["Sign in", "Open Account", "Contact support to cancel"] },
  { name: "Instamojo", domain: "instamojo.com", aliases: ["instamojo"], category: "Finance", cancelUrl: "https://www.instamojo.com/accounts/settings/", steps: ["Sign in", "Open Settings", "Cancel subscription"] },

  // Gaming India
  { name: "MPL Pro", domain: "mpl.live", aliases: ["mpl", "mpl pro"], category: "Gaming", cancelUrl: "https://www.mpl.live/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Dream11", domain: "dream11.com", aliases: ["dream11"], category: "Gaming", cancelUrl: "https://www.dream11.com/account", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "WinZO", domain: "winzogames.com", aliases: ["winzo"], category: "Gaming", cancelUrl: "https://www.winzogames.com/account", steps: ["Sign in", "Open Account", "Cancel"] },

  // Telecom India
  { name: "Jio Postpaid", domain: "jio.com", aliases: ["jio", "jio postpaid", "reliance jio"], category: "Telecom", cancelUrl: "https://www.jio.com/selfcare/plans/", steps: ["Sign in to MyJio", "Open Plans", "Contact support to cancel"] },
  { name: "Airtel Postpaid", domain: "airtel.in", aliases: ["airtel", "airtel postpaid"], category: "Telecom", cancelUrl: "https://www.airtel.in/myairtel/", steps: ["Sign in to MyAirtel", "Open Account", "Contact support"] },
  { name: "Vi (Vodafone Idea)", domain: "myvi.in", aliases: ["vi", "vodafone", "idea", "vodafone idea"], category: "Telecom", cancelUrl: "https://www.myvi.in/", steps: ["Sign in to Vi app", "Open Account", "Contact support"] },
  { name: "BSNL", domain: "bsnl.in", aliases: ["bsnl"], category: "Telecom", cancelUrl: "https://selfcare.bsnl.co.in/", steps: ["Sign in to BSNL Self Care", "Open Subscription", "Cancel"] },

  // Food & Delivery India
  { name: "Swiggy One", domain: "swiggy.com", aliases: ["swiggy", "swiggy one"], category: "Food", cancelUrl: "https://www.swiggy.com/subscription", steps: ["Open Swiggy app", "Go to Account → Swiggy One", "Cancel membership"] },
  { name: "Zomato Pro", domain: "zomato.com", aliases: ["zomato", "zomato pro", "zomato gold"], category: "Food", cancelUrl: "https://www.zomato.com/subscription", steps: ["Open Zomato app", "Go to Profile → Zomato Pro", "Cancel"] },
  { name: "Blinkit Pass", domain: "blinkit.com", aliases: ["blinkit", "grofers"], category: "Grocery", cancelUrl: "https://blinkit.com/subscription", steps: ["Open Blinkit app", "Go to Account → Pass", "Cancel"] },
  { name: "BigBasket Star", domain: "bigbasket.com", aliases: ["bigbasket", "big basket"], category: "Grocery", cancelUrl: "https://www.bigbasket.com/subscription/", steps: ["Sign in", "Open Subscription", "Cancel Star membership"] },
  { name: "Dunzo Daily", domain: "dunzo.com", aliases: ["dunzo"], category: "Grocery", cancelUrl: "https://www.dunzo.com/subscription", steps: ["Open Dunzo app", "Go to Account", "Cancel subscription"] },

  // Travel India
  { name: "MakeMyTrip Black", domain: "makemytrip.com", aliases: ["makemytrip", "mmt"], category: "Travel", cancelUrl: "https://www.makemytrip.com/myaccount/", steps: ["Sign in", "Open My Account", "Cancel Black membership"] },
  { name: "IRCTC Premium", domain: "irctc.co.in", aliases: ["irctc"], category: "Travel", cancelUrl: "https://www.irctc.co.in/nget/profile/my-profile", steps: ["Sign in", "Open Profile", "Cancel premium subscription"] },
  { name: "Ola Select", domain: "olacabs.com", aliases: ["ola", "ola select"], category: "Travel", cancelUrl: "https://www.olacabs.com/subscription", steps: ["Open Ola app", "Go to Account → Select", "Cancel membership"] },
  { name: "Uber One", domain: "uber.com", aliases: ["uber", "uber one"], category: "Travel", cancelUrl: "https://www.uber.com/in/en/ride/uber-one/", steps: ["Open Uber app", "Go to Account → Uber One", "Cancel membership"] },
  { name: "Rapido Pass", domain: "rapido.bike", aliases: ["rapido"], category: "Travel", cancelUrl: "https://rapido.bike/subscription", steps: ["Open Rapido app", "Go to Account", "Cancel Pass"] },

  // Shopping India
  { name: "Flipkart Plus", domain: "flipkart.com", aliases: ["flipkart", "flipkart plus"], category: "Shopping", cancelUrl: "https://www.flipkart.com/plus", steps: ["Sign in", "Open Plus membership", "Cancel"] },
  { name: "Myntra Insider", domain: "myntra.com", aliases: ["myntra", "myntra insider"], category: "Shopping", cancelUrl: "https://www.myntra.com/insider", steps: ["Sign in", "Open Insider", "Cancel membership"] },
  { name: "Nykaa Prive", domain: "nykaa.com", aliases: ["nykaa", "nykaa prive"], category: "Shopping", cancelUrl: "https://www.nykaa.com/subscription", steps: ["Sign in", "Open Subscription", "Cancel Prive"] },
  { name: "Meesho", domain: "meesho.com", aliases: ["meesho"], category: "Shopping", cancelUrl: "https://www.meesho.com/account", steps: ["Sign in", "Open Account", "Cancel subscription"] },

  // Productivity India
  { name: "Notion India", domain: "notion.so", aliases: ["notion india"], category: "Productivity", cancelUrl: "https://www.notion.so/my-integrations", steps: ["Sign in", "Open Settings & Members → Plans", "Downgrade to Free"] },
  { name: "Slack India", domain: "slack.com", aliases: ["slack india"], category: "Productivity", cancelUrl: "https://my.slack.com/admin/billing", steps: ["Sign in as admin", "Open Billing", "Cancel paid plan"] },
]

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — NEXT 100 POPULAR (Gaming, Dev Tools, Design, B2B)
// ─────────────────────────────────────────────────────────────────────────────
const NEXT_100_POPULAR: SubscriptionEntry[] = [
  // Gaming
  { name: "Xbox Game Pass", domain: "xbox.com", aliases: ["xbox game pass", "xbox", "game pass", "xbox ultimate"], category: "Gaming", cancelUrl: "https://account.microsoft.com/services", steps: ["Sign in to Microsoft account", "Find Xbox Game Pass → Manage", "Cancel subscription"] },
  { name: "PlayStation Plus", domain: "playstation.com", aliases: ["playstation plus", "ps plus", "psn"], category: "Gaming", cancelUrl: "https://www.playstation.com/en-us/playstation-plus/", steps: ["Sign in to PSN", "Open Subscription Management", "Cancel PS Plus"] },
  { name: "Nintendo Switch Online", domain: "nintendo.com", aliases: ["nintendo", "nintendo switch online", "nso"], category: "Gaming", cancelUrl: "https://accounts.nintendo.com/profile/subscription", steps: ["Sign in to Nintendo account", "Open Subscription", "Cancel"] },
  { name: "EA Play", domain: "ea.com", aliases: ["ea play", "ea", "origin"], category: "Gaming", cancelUrl: "https://www.ea.com/ea-play", steps: ["Sign in to EA account", "Open EA Play subscription", "Cancel"] },
  { name: "Ubisoft+", domain: "ubisoft.com", aliases: ["ubisoft", "ubisoft+"], category: "Gaming", cancelUrl: "https://store.ubisoft.com/us/ubisoftplus", steps: ["Sign in", "Open Ubisoft+", "Cancel subscription"] },
  { name: "Steam", domain: "store.steampowered.com", aliases: ["steam"], category: "Gaming", cancelUrl: "https://store.steampowered.com/account/subscriptions/", steps: ["Sign in to Steam", "Open Account → Subscriptions", "Cancel"] },
  { name: "Twitch Turbo", domain: "twitch.tv", aliases: ["twitch", "twitch turbo"], category: "Gaming", cancelUrl: "https://www.twitch.tv/turbo", steps: ["Sign in", "Open Turbo settings", "Cancel subscription"] },
  { name: "Discord Nitro", domain: "discord.com", aliases: ["discord", "discord nitro"], category: "Gaming", cancelUrl: "https://discord.com/settings/subscriptions", steps: ["Sign in", "Open Settings → Subscriptions", "Cancel Nitro"] },

  // Developer Tools
  { name: "JetBrains", domain: "jetbrains.com", aliases: ["jetbrains", "intellij", "pycharm", "webstorm"], category: "Developer", cancelUrl: "https://account.jetbrains.com/licenses", steps: ["Sign in", "Open Licenses", "Cancel subscription"] },
  { name: "GitLab", domain: "gitlab.com", aliases: ["gitlab"], category: "Developer", cancelUrl: "https://gitlab.com/profile/billings", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Bitbucket", domain: "bitbucket.org", aliases: ["bitbucket"], category: "Developer", cancelUrl: "https://bitbucket.org/account/settings/billing/", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "CircleCI", domain: "circleci.com", aliases: ["circleci"], category: "Developer", cancelUrl: "https://app.circleci.com/settings/plan", steps: ["Sign in", "Open Plan settings", "Cancel"] },
  { name: "Sentry", domain: "sentry.io", aliases: ["sentry"], category: "Developer", cancelUrl: "https://sentry.io/settings/billing/", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Datadog", domain: "datadoghq.com", aliases: ["datadog"], category: "Developer", cancelUrl: "https://app.datadoghq.com/billing/plan", steps: ["Sign in", "Open Billing → Plan", "Cancel"] },
  { name: "New Relic", domain: "newrelic.com", aliases: ["new relic", "newrelic"], category: "Developer", cancelUrl: "https://one.newrelic.com/admin-portal/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Postman", domain: "postman.com", aliases: ["postman"], category: "Developer", cancelUrl: "https://go.postman.co/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "MongoDB Atlas", domain: "mongodb.com", aliases: ["mongodb", "atlas"], category: "Developer", cancelUrl: "https://cloud.mongodb.com/v2/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "PlanetScale", domain: "planetscale.com", aliases: ["planetscale"], category: "Developer", cancelUrl: "https://app.planetscale.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Supabase", domain: "supabase.com", aliases: ["supabase"], category: "Developer", cancelUrl: "https://supabase.com/dashboard/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Neon", domain: "neon.tech", aliases: ["neon", "neon db"], category: "Developer", cancelUrl: "https://console.neon.tech/app/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Fly.io", domain: "fly.io", aliases: ["fly.io", "flyio"], category: "Developer", cancelUrl: "https://fly.io/dashboard/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Cloudinary", domain: "cloudinary.com", aliases: ["cloudinary"], category: "Developer", cancelUrl: "https://cloudinary.com/console/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Algolia", domain: "algolia.com", aliases: ["algolia"], category: "Developer", cancelUrl: "https://www.algolia.com/billing/", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Stripe", domain: "stripe.com", aliases: ["stripe"], category: "Finance", cancelUrl: "https://dashboard.stripe.com/settings/billing/subscription", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Twilio", domain: "twilio.com", aliases: ["twilio"], category: "Developer", cancelUrl: "https://console.twilio.com/us1/billing/manage-billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "SendGrid", domain: "sendgrid.com", aliases: ["sendgrid"], category: "Developer", cancelUrl: "https://app.sendgrid.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Mailgun", domain: "mailgun.com", aliases: ["mailgun"], category: "Developer", cancelUrl: "https://app.mailgun.com/app/account/settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Pusher", domain: "pusher.com", aliases: ["pusher"], category: "Developer", cancelUrl: "https://dashboard.pusher.com/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },

  // Design & Creative
  { name: "Sketch", domain: "sketch.com", aliases: ["sketch"], category: "Design", cancelUrl: "https://www.sketch.com/account/", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "InVision", domain: "invisionapp.com", aliases: ["invision"], category: "Design", cancelUrl: "https://support.invisionapp.com/", steps: ["Contact InVision support", "Request cancellation"] },
  { name: "Framer", domain: "framer.com", aliases: ["framer"], category: "Design", cancelUrl: "https://www.framer.com/account/billing/", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Webflow", domain: "webflow.com", aliases: ["webflow"], category: "Design", cancelUrl: "https://webflow.com/dashboard/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Squarespace", domain: "squarespace.com", aliases: ["squarespace"], category: "Website", cancelUrl: "https://account.squarespace.com/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Wix", domain: "wix.com", aliases: ["wix"], category: "Website", cancelUrl: "https://manage.wix.com/premium-purchase-plan/subscriptions", steps: ["Sign in", "Open Subscriptions", "Cancel plan"] },
  { name: "WordPress.com", domain: "wordpress.com", aliases: ["wordpress", "wordpress.com"], category: "Website", cancelUrl: "https://wordpress.com/me/purchases", steps: ["Sign in", "Open Purchases", "Cancel subscription"] },
  { name: "Ghost", domain: "ghost.org", aliases: ["ghost"], category: "Website", cancelUrl: "https://account.ghost.org/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Bubble", domain: "bubble.io", aliases: ["bubble"], category: "Developer", cancelUrl: "https://bubble.io/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },

  // Marketing & CRM
  { name: "HubSpot", domain: "hubspot.com", aliases: ["hubspot"], category: "Marketing", cancelUrl: "https://app.hubspot.com/billing/", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Mailchimp", domain: "mailchimp.com", aliases: ["mailchimp"], category: "Marketing", cancelUrl: "https://us1.admin.mailchimp.com/account/billing-history/", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "ConvertKit", domain: "convertkit.com", aliases: ["convertkit"], category: "Marketing", cancelUrl: "https://app.convertkit.com/account_settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "ActiveCampaign", domain: "activecampaign.com", aliases: ["activecampaign"], category: "Marketing", cancelUrl: "https://www.activecampaign.com/billing/", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Klaviyo", domain: "klaviyo.com", aliases: ["klaviyo"], category: "Marketing", cancelUrl: "https://www.klaviyo.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Intercom", domain: "intercom.com", aliases: ["intercom"], category: "Marketing", cancelUrl: "https://app.intercom.com/a/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Zendesk", domain: "zendesk.com", aliases: ["zendesk"], category: "Support", cancelUrl: "https://www.zendesk.com/account/billing/", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Freshdesk", domain: "freshdesk.com", aliases: ["freshdesk"], category: "Support", cancelUrl: "https://support.freshdesk.com/", steps: ["Contact Freshdesk support", "Request cancellation"] },
  { name: "Crisp", domain: "crisp.chat", aliases: ["crisp"], category: "Support", cancelUrl: "https://app.crisp.chat/settings/billing/", steps: ["Sign in", "Open Billing", "Cancel plan"] },

  // Analytics
  { name: "Mixpanel", domain: "mixpanel.com", aliases: ["mixpanel"], category: "Analytics", cancelUrl: "https://mixpanel.com/settings/billing/", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Amplitude", domain: "amplitude.com", aliases: ["amplitude"], category: "Analytics", cancelUrl: "https://analytics.amplitude.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Hotjar", domain: "hotjar.com", aliases: ["hotjar"], category: "Analytics", cancelUrl: "https://insights.hotjar.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Segment", domain: "segment.com", aliases: ["segment"], category: "Analytics", cancelUrl: "https://app.segment.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },

  // Password & Security
  { name: "Keeper", domain: "keepersecurity.com", aliases: ["keeper"], category: "Security", cancelUrl: "https://keepersecurity.com/vault/#account", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "RoboForm", domain: "roboform.com", aliases: ["roboform"], category: "Security", cancelUrl: "https://my.roboform.com/", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "Malwarebytes", domain: "malwarebytes.com", aliases: ["malwarebytes"], category: "Security", cancelUrl: "https://my.malwarebytes.com/subscriptions", steps: ["Sign in", "Open Subscriptions", "Cancel"] },
  { name: "Norton", domain: "norton.com", aliases: ["norton", "norton 360"], category: "Security", cancelUrl: "https://my.norton.com/extspa/home?inid=nortoncom_nav_signin", steps: ["Sign in", "Open My Subscriptions", "Cancel"] },
  { name: "McAfee", domain: "mcafee.com", aliases: ["mcafee"], category: "Security", cancelUrl: "https://home.mcafee.com/root/autorenew.aspx", steps: ["Sign in", "Open Auto-Renewal settings", "Turn off auto-renewal"] },
  { name: "Avast", domain: "avast.com", aliases: ["avast"], category: "Security", cancelUrl: "https://my.avast.com/", steps: ["Sign in", "Open My Subscriptions", "Cancel"] },
  { name: "Bitdefender", domain: "bitdefender.com", aliases: ["bitdefender"], category: "Security", cancelUrl: "https://central.bitdefender.com/", steps: ["Sign in", "Open My Subscriptions", "Cancel"] },

  // Communication
  { name: "Zoom", domain: "zoom.us", aliases: ["zoom"], category: "Communication", cancelUrl: "https://zoom.us/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Microsoft Teams", domain: "microsoft.com", aliases: ["microsoft teams", "teams"], category: "Communication", cancelUrl: "https://account.microsoft.com/services", steps: ["Sign in", "Find Teams → Manage", "Cancel subscription"] },
  { name: "Webex", domain: "webex.com", aliases: ["webex", "cisco webex"], category: "Communication", cancelUrl: "https://admin.webex.com/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Calendly", domain: "calendly.com", aliases: ["calendly"], category: "Productivity", cancelUrl: "https://calendly.com/app/admin/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Doodle", domain: "doodle.com", aliases: ["doodle"], category: "Productivity", cancelUrl: "https://doodle.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },

  // Project Management
  { name: "Jira", domain: "atlassian.com", aliases: ["jira", "atlassian jira"], category: "Productivity", cancelUrl: "https://admin.atlassian.com/billing", steps: ["Sign in as admin", "Open Billing", "Cancel subscription"] },
  { name: "Confluence", domain: "atlassian.com", aliases: ["confluence"], category: "Productivity", cancelUrl: "https://admin.atlassian.com/billing", steps: ["Sign in as admin", "Open Billing", "Cancel subscription"] },
  { name: "Basecamp", domain: "basecamp.com", aliases: ["basecamp"], category: "Productivity", cancelUrl: "https://launchpad.37signals.com/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "ClickUp", domain: "clickup.com", aliases: ["clickup"], category: "Productivity", cancelUrl: "https://app.clickup.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Smartsheet", domain: "smartsheet.com", aliases: ["smartsheet"], category: "Productivity", cancelUrl: "https://app.smartsheet.com/b/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Wrike", domain: "wrike.com", aliases: ["wrike"], category: "Productivity", cancelUrl: "https://www.wrike.com/workspace.htm#billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Teamwork", domain: "teamwork.com", aliases: ["teamwork"], category: "Productivity", cancelUrl: "https://www.teamwork.com/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
]

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — OTHER 100+ (Niche, Regional, Lifestyle)
// ─────────────────────────────────────────────────────────────────────────────
const OTHER_100: SubscriptionEntry[] = [
  // Lifestyle & Hobbies
  { name: "MasterClass", domain: "masterclass.com", aliases: ["masterclass"], category: "Education", cancelUrl: "https://www.masterclass.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Skillshare", domain: "skillshare.com", aliases: ["skillshare"], category: "Education", cancelUrl: "https://www.skillshare.com/settings/membership", steps: ["Sign in", "Open Membership", "Cancel"] },
  { name: "Brilliant", domain: "brilliant.org", aliases: ["brilliant"], category: "Education", cancelUrl: "https://brilliant.org/settings/", steps: ["Sign in", "Open Settings", "Cancel subscription"] },
  { name: "Codecademy", domain: "codecademy.com", aliases: ["codecademy"], category: "Education", cancelUrl: "https://www.codecademy.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel Pro"] },
  { name: "Pluralsight", domain: "pluralsight.com", aliases: ["pluralsight"], category: "Education", cancelUrl: "https://app.pluralsight.com/id/settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Frontend Masters", domain: "frontendmasters.com", aliases: ["frontend masters"], category: "Education", cancelUrl: "https://frontendmasters.com/settings/billing/", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Egghead", domain: "egghead.io", aliases: ["egghead"], category: "Education", cancelUrl: "https://egghead.io/user/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "O'Reilly", domain: "oreilly.com", aliases: ["oreilly", "o'reilly"], category: "Education", cancelUrl: "https://www.oreilly.com/account/billing/", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Rosetta Stone", domain: "rosettastone.com", aliases: ["rosetta stone"], category: "Education", cancelUrl: "https://www.rosettastone.com/account/", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "Babbel", domain: "babbel.com", aliases: ["babbel"], category: "Education", cancelUrl: "https://my.babbel.com/settings/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Pimsleur", domain: "pimsleur.com", aliases: ["pimsleur"], category: "Education", cancelUrl: "https://www.pimsleur.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },

  // Finance & Investment
  { name: "Robinhood Gold", domain: "robinhood.com", aliases: ["robinhood", "robinhood gold"], category: "Finance", cancelUrl: "https://robinhood.com/account/gold", steps: ["Sign in", "Open Gold settings", "Cancel Gold"] },
  { name: "Acorns", domain: "acorns.com", aliases: ["acorns"], category: "Finance", cancelUrl: "https://app.acorns.com/settings/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Personal Capital", domain: "personalcapital.com", aliases: ["personal capital", "empower"], category: "Finance", cancelUrl: "https://home.personalcapital.com/", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "YNAB", domain: "ynab.com", aliases: ["ynab", "you need a budget"], category: "Finance", cancelUrl: "https://app.ynab.com/settings/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Quicken", domain: "quicken.com", aliases: ["quicken"], category: "Finance", cancelUrl: "https://www.quicken.com/account/", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "FreshBooks", domain: "freshbooks.com", aliases: ["freshbooks"], category: "Finance", cancelUrl: "https://my.freshbooks.com/#/settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "QuickBooks", domain: "quickbooks.intuit.com", aliases: ["quickbooks", "intuit"], category: "Finance", cancelUrl: "https://accounts.intuit.com/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Wave", domain: "waveapps.com", aliases: ["wave", "wave accounting"], category: "Finance", cancelUrl: "https://www.waveapps.com/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },

  // Health & Telemedicine
  { name: "Teladoc", domain: "teladoc.com", aliases: ["teladoc"], category: "Health", cancelUrl: "https://member.teladoc.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Hims", domain: "forhims.com", aliases: ["hims", "hers"], category: "Health", cancelUrl: "https://www.forhims.com/account/subscriptions", steps: ["Sign in", "Open Subscriptions", "Cancel"] },
  { name: "Roman", domain: "ro.co", aliases: ["roman", "ro"], category: "Health", cancelUrl: "https://ro.co/account/subscriptions", steps: ["Sign in", "Open Subscriptions", "Cancel"] },
  { name: "Noom", domain: "noom.com", aliases: ["noom"], category: "Health", cancelUrl: "https://web.noom.com/settings/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "WW (Weight Watchers)", domain: "weightwatchers.com", aliases: ["weight watchers", "ww"], category: "Health", cancelUrl: "https://www.weightwatchers.com/us/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },

  // Home & Lifestyle
  { name: "HelloFresh", domain: "hellofresh.com", aliases: ["hellofresh", "hello fresh"], category: "Food", cancelUrl: "https://www.hellofresh.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel plan"] },
  { name: "Blue Apron", domain: "blueapron.com", aliases: ["blue apron"], category: "Food", cancelUrl: "https://www.blueapron.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Dollar Shave Club", domain: "dollarshaveclub.com", aliases: ["dollar shave club", "dsc"], category: "Lifestyle", cancelUrl: "https://www.dollarshaveclub.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Birchbox", domain: "birchbox.com", aliases: ["birchbox"], category: "Lifestyle", cancelUrl: "https://www.birchbox.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "FabFitFun", domain: "fabfitfun.com", aliases: ["fabfitfun"], category: "Lifestyle", cancelUrl: "https://fabfitfun.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },

  // Podcasts & Audio
  { name: "Pocket Casts Plus", domain: "pocketcasts.com", aliases: ["pocket casts", "pocketcasts"], category: "Podcasts", cancelUrl: "https://pocketcasts.com/account/", steps: ["Sign in", "Open Account", "Cancel Plus"] },
  { name: "Overcast", domain: "overcast.fm", aliases: ["overcast"], category: "Podcasts", cancelUrl: "https://overcast.fm/account", steps: ["Sign in", "Open Account", "Cancel Premium"] },
  { name: "Luminary", domain: "luminarypodcasts.com", aliases: ["luminary"], category: "Podcasts", cancelUrl: "https://luminarypodcasts.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Stitcher Premium", domain: "stitcher.com", aliases: ["stitcher"], category: "Podcasts", cancelUrl: "https://www.stitcher.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel Premium"] },

  // Photo & Video
  { name: "Lightroom", domain: "adobe.com", aliases: ["lightroom", "adobe lightroom"], category: "Photo", cancelUrl: "https://account.adobe.com/plans", steps: ["Sign in to Adobe", "Click 'Manage plan' → 'Cancel plan'", "Confirm"] },
  { name: "Darkroom", domain: "darkroom.app", aliases: ["darkroom"], category: "Photo", cancelUrl: "https://darkroom.app/account", steps: ["Open Darkroom app", "Go to Account", "Cancel subscription"] },
  { name: "VSCO", domain: "vsco.co", aliases: ["vsco"], category: "Photo", cancelUrl: "https://vsco.co/user/settings/membership", steps: ["Sign in", "Open Membership", "Cancel"] },
  { name: "Snapseed", domain: "snapseed.online", aliases: ["snapseed"], category: "Photo", cancelUrl: "https://snapseed.online/account", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "Picsart Gold", domain: "picsart.com", aliases: ["picsart", "picsart gold"], category: "Photo", cancelUrl: "https://picsart.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel Gold"] },
  { name: "Vimeo", domain: "vimeo.com", aliases: ["vimeo"], category: "Video", cancelUrl: "https://vimeo.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Wistia", domain: "wistia.com", aliases: ["wistia"], category: "Video", cancelUrl: "https://wistia.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Descript", domain: "descript.com", aliases: ["descript"], category: "Video", cancelUrl: "https://www.descript.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "CapCut Pro", domain: "capcut.com", aliases: ["capcut", "capcut pro"], category: "Video", cancelUrl: "https://www.capcut.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel Pro"] },

  // Writing & Content
  { name: "ProWritingAid", domain: "prowritingaid.com", aliases: ["prowritingaid"], category: "Writing", cancelUrl: "https://prowritingaid.com/en/Account/Subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Hemingway Editor", domain: "hemingwayapp.com", aliases: ["hemingway"], category: "Writing", cancelUrl: "https://hemingwayapp.com/account", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "Scrivener", domain: "literatureandlatte.com", aliases: ["scrivener"], category: "Writing", cancelUrl: "https://www.literatureandlatte.com/account", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "Ulysses", domain: "ulysses.app", aliases: ["ulysses"], category: "Writing", cancelUrl: "https://ulysses.app/account/", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "Bear", domain: "bear.app", aliases: ["bear"], category: "Writing", cancelUrl: "https://bear.app/account/", steps: ["Sign in", "Open Account", "Cancel Pro"] },
  { name: "Obsidian Sync", domain: "obsidian.md", aliases: ["obsidian", "obsidian sync"], category: "Writing", cancelUrl: "https://obsidian.md/account", steps: ["Sign in", "Open Account", "Cancel Sync"] },

  // Maps & Navigation
  { name: "Google Maps Platform", domain: "cloud.google.com", aliases: ["google maps platform"], category: "Maps", cancelUrl: "https://console.cloud.google.com/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Waze Carpool", domain: "waze.com", aliases: ["waze"], category: "Maps", cancelUrl: "https://www.waze.com/account", steps: ["Sign in", "Open Account", "Cancel subscription"] },

  // Social Media Tools
  { name: "Buffer", domain: "buffer.com", aliases: ["buffer"], category: "Marketing", cancelUrl: "https://account.buffer.com/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Hootsuite", domain: "hootsuite.com", aliases: ["hootsuite"], category: "Marketing", cancelUrl: "https://hootsuite.com/dashboard#/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Sprout Social", domain: "sproutsocial.com", aliases: ["sprout social"], category: "Marketing", cancelUrl: "https://app.sproutsocial.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Later", domain: "later.com", aliases: ["later"], category: "Marketing", cancelUrl: "https://app.later.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "Planoly", domain: "planoly.com", aliases: ["planoly"], category: "Marketing", cancelUrl: "https://www.planoly.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },

  // E-commerce
  { name: "Shopify", domain: "shopify.com", aliases: ["shopify"], category: "E-commerce", cancelUrl: "https://www.shopify.com/admin/settings/plan", steps: ["Sign in", "Open Settings → Plan", "Cancel subscription"] },
  { name: "BigCommerce", domain: "bigcommerce.com", aliases: ["bigcommerce"], category: "E-commerce", cancelUrl: "https://login.bigcommerce.com/", steps: ["Sign in", "Open Account", "Cancel subscription"] },
  { name: "WooCommerce", domain: "woocommerce.com", aliases: ["woocommerce"], category: "E-commerce", cancelUrl: "https://woocommerce.com/my-account/subscriptions/", steps: ["Sign in", "Open Subscriptions", "Cancel"] },
  { name: "Gumroad", domain: "gumroad.com", aliases: ["gumroad"], category: "E-commerce", cancelUrl: "https://app.gumroad.com/settings/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },

  // Misc Popular
  { name: "Zapier", domain: "zapier.com", aliases: ["zapier"], category: "Automation", cancelUrl: "https://zapier.com/app/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Make (Integromat)", domain: "make.com", aliases: ["make", "integromat"], category: "Automation", cancelUrl: "https://www.make.com/en/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "n8n", domain: "n8n.io", aliases: ["n8n"], category: "Automation", cancelUrl: "https://app.n8n.cloud/billing", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Typeform", domain: "typeform.com", aliases: ["typeform"], category: "Productivity", cancelUrl: "https://admin.typeform.com/account/billing", steps: ["Sign in", "Open Billing", "Cancel subscription"] },
  { name: "SurveyMonkey", domain: "surveymonkey.com", aliases: ["surveymonkey"], category: "Productivity", cancelUrl: "https://www.surveymonkey.com/user/billing/", steps: ["Sign in", "Open Billing", "Cancel plan"] },
  { name: "Notion AI", domain: "notion.so", aliases: ["notion ai"], category: "AI", cancelUrl: "https://www.notion.so/my-integrations", steps: ["Sign in", "Open Settings → Plans", "Downgrade to remove AI add-on"] },
  { name: "Otter.ai", domain: "otter.ai", aliases: ["otter", "otter.ai"], category: "AI", cancelUrl: "https://otter.ai/settings/subscription", steps: ["Sign in", "Open Subscription", "Cancel Pro"] },
  { name: "Rev", domain: "rev.com", aliases: ["rev"], category: "AI", cancelUrl: "https://www.rev.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Speechify", domain: "speechify.com", aliases: ["speechify"], category: "AI", cancelUrl: "https://speechify.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel Premium"] },
  { name: "Readwise", domain: "readwise.io", aliases: ["readwise"], category: "Reading", cancelUrl: "https://readwise.io/accounts/subscription/", steps: ["Sign in", "Open Subscription", "Cancel"] },
  { name: "Pocket Premium", domain: "getpocket.com", aliases: ["pocket", "pocket premium"], category: "Reading", cancelUrl: "https://getpocket.com/premium/manage", steps: ["Sign in", "Open Premium", "Cancel"] },
  { name: "Instapaper Premium", domain: "instapaper.com", aliases: ["instapaper"], category: "Reading", cancelUrl: "https://www.instapaper.com/premium", steps: ["Sign in", "Open Premium", "Cancel"] },
  { name: "Feedly Pro", domain: "feedly.com", aliases: ["feedly"], category: "Reading", cancelUrl: "https://feedly.com/i/pro", steps: ["Sign in", "Open Pro settings", "Cancel subscription"] },
  { name: "Flipboard", domain: "flipboard.com", aliases: ["flipboard"], category: "Reading", cancelUrl: "https://flipboard.com/account/subscription", steps: ["Sign in", "Open Subscription", "Cancel"] },
]

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED CATALOG — all 700+ entries
// ─────────────────────────────────────────────────────────────────────────────
import { EXTENDED_CATALOG } from "./catalogExtended"

export const SUBSCRIPTION_CATALOG: SubscriptionEntry[] = [
  ...GLOBAL_TOP_100,
  ...INDIA_TOP_100,
  ...NEXT_100_POPULAR,
  ...OTHER_100,
  ...EXTENDED_CATALOG,
]

/**
 * Find a subscription entry by name (fuzzy match on name + aliases).
 */
export function findSubscription(name: string): SubscriptionEntry | null {
  if (!name) return null
  const q = name.toLowerCase().trim()
  if (!q) return null
  // Exact name match first
  const exact = SUBSCRIPTION_CATALOG.find(s => s.name.toLowerCase() === q)
  if (exact) return exact
  // Alias match
  for (const entry of SUBSCRIPTION_CATALOG) {
    if (entry.name.toLowerCase().includes(q) || q.includes(entry.name.toLowerCase())) return entry
    for (const alias of entry.aliases) {
      if (q.includes(alias) || alias.includes(q)) return entry
    }
  }
  return null
}

/**
 * Search subscriptions for autocomplete — returns top 8 matches.
 */
export function searchSubscriptions(query: string): SubscriptionEntry[] {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase().trim()
  const results: Array<{ entry: SubscriptionEntry; score: number }> = []

  for (const entry of SUBSCRIPTION_CATALOG) {
    let score = 0
    const nameLower = entry.name.toLowerCase()
    if (nameLower === q) score = 100
    else if (nameLower.startsWith(q)) score = 80
    else if (nameLower.includes(q)) score = 60
    else {
      for (const alias of entry.aliases) {
        if (alias === q) { score = 90; break }
        if (alias.startsWith(q)) { score = 70; break }
        if (alias.includes(q)) { score = 50; break }
      }
    }
    if (score > 0) results.push({ entry, score })
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(r => r.entry)
}

/**
 * Get favicon URL for a subscription domain.
 */
export function getFaviconUrl(domain: string, size = 32): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}
