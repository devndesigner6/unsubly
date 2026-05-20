/**
 * Extended subscription catalog — 300+ additional services (2025-2026)
 * Categories: AI Tools, Gaming, VPN, Fitness, Health, News, Education,
 * Developer Tools, Design, Finance, Food, Music, Productivity, Security
 */

import type { SubscriptionEntry } from "./subscriptionCatalog"

export const EXTENDED_CATALOG: SubscriptionEntry[] = [
  // ─── AI Tools (2025-2026) ──────────────────────────────────────────────
  { name: "Gemini Advanced", domain: "gemini.google.com", aliases: ["gemini", "gemini advanced", "google gemini"], category: "AI", cancelUrl: "https://one.google.com/about/plans", steps: ["Sign in with Google", "Open Google One → Plans", "Cancel Gemini Advanced"] },
  { name: "Grok", domain: "x.com", aliases: ["grok", "x premium", "twitter premium"], category: "AI", cancelUrl: "https://x.com/settings/manage_subscription", steps: ["Sign in to X", "Settings → Subscription", "Cancel"] },
  { name: "Perplexity Pro", domain: "perplexity.ai", aliases: ["perplexity", "perplexity pro"], category: "AI", cancelUrl: "https://www.perplexity.ai/settings/subscription", steps: ["Sign in", "Settings → Subscription", "Cancel Pro"] },
  { name: "Midjourney", domain: "midjourney.com", aliases: ["midjourney"], category: "AI", cancelUrl: "https://www.midjourney.com/account", steps: ["Sign in", "Account → Manage Subscription", "Cancel"] },
  { name: "Runway ML", domain: "runwayml.com", aliases: ["runway", "runway ml"], category: "AI", cancelUrl: "https://app.runwayml.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel plan"] },
  { name: "Pika", domain: "pika.art", aliases: ["pika"], category: "AI", cancelUrl: "https://pika.art/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "ElevenLabs", domain: "elevenlabs.io", aliases: ["elevenlabs", "eleven labs"], category: "AI", cancelUrl: "https://elevenlabs.io/subscription", steps: ["Sign in", "Subscription", "Cancel plan"] },
  { name: "Suno AI", domain: "suno.com", aliases: ["suno", "suno ai"], category: "AI", cancelUrl: "https://suno.com/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Udio", domain: "udio.com", aliases: ["udio"], category: "AI", cancelUrl: "https://www.udio.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Jasper AI", domain: "jasper.ai", aliases: ["jasper", "jasper ai"], category: "AI", cancelUrl: "https://app.jasper.ai/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel subscription"] },
  { name: "Copy.ai", domain: "copy.ai", aliases: ["copy.ai", "copyai"], category: "AI", cancelUrl: "https://app.copy.ai/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Writesonic", domain: "writesonic.com", aliases: ["writesonic"], category: "AI", cancelUrl: "https://app.writesonic.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Descript", domain: "descript.com", aliases: ["descript"], category: "AI", cancelUrl: "https://www.descript.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel plan"] },
  { name: "Synthesia", domain: "synthesia.io", aliases: ["synthesia"], category: "AI", cancelUrl: "https://app.synthesia.io/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "HeyGen", domain: "heygen.com", aliases: ["heygen"], category: "AI", cancelUrl: "https://app.heygen.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Luma AI", domain: "lumalabs.ai", aliases: ["luma", "luma ai"], category: "AI", cancelUrl: "https://lumalabs.ai/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Krea AI", domain: "krea.ai", aliases: ["krea"], category: "AI", cancelUrl: "https://www.krea.ai/settings", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Leonardo AI", domain: "leonardo.ai", aliases: ["leonardo", "leonardo ai"], category: "AI", cancelUrl: "https://app.leonardo.ai/settings", steps: ["Sign in", "Settings → Subscription", "Cancel"] },
  { name: "Windsurf", domain: "windsurf.com", aliases: ["windsurf", "codeium"], category: "AI", cancelUrl: "https://windsurf.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Lovable", domain: "lovable.dev", aliases: ["lovable"], category: "AI", cancelUrl: "https://lovable.dev/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "v0", domain: "v0.dev", aliases: ["v0", "vercel v0"], category: "AI", cancelUrl: "https://v0.dev/settings", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Bolt.new", domain: "bolt.new", aliases: ["bolt", "bolt.new"], category: "AI", cancelUrl: "https://bolt.new/settings", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Replit Agent", domain: "replit.com", aliases: ["replit agent", "replit core"], category: "AI", cancelUrl: "https://replit.com/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Google Health", domain: "health.google.com", aliases: ["google health", "fitbit premium"], category: "Health", cancelUrl: "https://one.google.com/about/plans", steps: ["Sign in", "Google One → Plans", "Cancel"] },

  // ─── Gaming ────────────────────────────────────────────────────────────
  { name: "Xbox Game Pass", domain: "xbox.com", aliases: ["xbox game pass", "game pass", "xbox"], category: "Gaming", cancelUrl: "https://account.microsoft.com/services", steps: ["Sign in with Microsoft", "Find Game Pass", "Cancel subscription"] },
  { name: "PlayStation Plus", domain: "playstation.com", aliases: ["ps plus", "playstation plus", "psn"], category: "Gaming", cancelUrl: "https://store.playstation.com/subscriptions", steps: ["Sign in", "Subscription Management", "Cancel"] },
  { name: "Nintendo Switch Online", domain: "nintendo.com", aliases: ["nintendo online", "switch online"], category: "Gaming", cancelUrl: "https://accounts.nintendo.com/shop/subscription", steps: ["Sign in", "Shop → Subscription", "Turn off auto-renewal"] },
  { name: "EA Play", domain: "ea.com", aliases: ["ea play", "ea access"], category: "Gaming", cancelUrl: "https://myaccount.ea.com/cp-ui/subscriptions", steps: ["Sign in", "Subscriptions", "Cancel EA Play"] },
  { name: "Ubisoft+", domain: "ubisoft.com", aliases: ["ubisoft+", "ubisoft plus"], category: "Gaming", cancelUrl: "https://store.ubisoft.com/account/subscriptions", steps: ["Sign in", "Account → Subscriptions", "Cancel"] },
  { name: "GeForce NOW", domain: "nvidia.com", aliases: ["geforce now", "nvidia geforce"], category: "Gaming", cancelUrl: "https://www.nvidia.com/en-us/geforce-now/memberships/", steps: ["Sign in", "Memberships", "Cancel"] },
  { name: "Steam (recurring)", domain: "store.steampowered.com", aliases: ["steam"], category: "Gaming", cancelUrl: "https://store.steampowered.com/account/", steps: ["Sign in", "Account → Manage Subscriptions", "Cancel"] },
  { name: "Epic Games Store", domain: "epicgames.com", aliases: ["epic games"], category: "Gaming", cancelUrl: "https://www.epicgames.com/account/subscriptions", steps: ["Sign in", "Account → Subscriptions", "Cancel"] },
  { name: "Humble Bundle", domain: "humblebundle.com", aliases: ["humble bundle", "humble choice"], category: "Gaming", cancelUrl: "https://www.humblebundle.com/subscription/manage", steps: ["Sign in", "Manage Subscription", "Cancel"] },
  { name: "Apple Arcade", domain: "apple.com", aliases: ["apple arcade"], category: "Gaming", cancelUrl: "https://apps.apple.com/account/subscriptions", steps: ["Settings → Apple ID → Subscriptions", "Find Apple Arcade", "Cancel"] },
  { name: "Google Play Pass", domain: "play.google.com", aliases: ["play pass", "google play pass"], category: "Gaming", cancelUrl: "https://play.google.com/store/account/subscriptions", steps: ["Open Play Store", "Account → Subscriptions", "Cancel Play Pass"] },

  // ─── VPN & Security ────────────────────────────────────────────────────
  { name: "NordVPN (Teams)", domain: "nordlayer.com", aliases: ["nordlayer", "nord teams"], category: "VPN", cancelUrl: "https://nordlayer.com/billing", steps: ["Sign in", "Billing", "Cancel team plan"] },
  { name: "ExpressVPN (Router)", domain: "expressvpn.com", aliases: ["expressvpn router"], category: "VPN", cancelUrl: "https://www.expressvpn.com/subscriptions", steps: ["Sign in", "Subscriptions", "Cancel router plan"] },
  { name: "Surfshark One", domain: "surfshark.com", aliases: ["surfshark one"], category: "VPN", cancelUrl: "https://my.surfshark.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel Surfshark One bundle"] },
  { name: "ProtonMail Plus", domain: "proton.me", aliases: ["protonmail", "proton mail"], category: "Security", cancelUrl: "https://account.proton.me/u/0/subscription", steps: ["Sign in", "Subscription", "Downgrade to Free"] },
  { name: "CyberGhost", domain: "cyberghostvpn.com", aliases: ["cyberghost"], category: "VPN", cancelUrl: "https://my.cyberghostvpn.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Private Internet Access", domain: "privateinternetaccess.com", aliases: ["pia", "private internet access"], category: "VPN", cancelUrl: "https://www.privateinternetaccess.com/account/subscription", steps: ["Sign in", "Subscription", "Cancel"] },
  { name: "Mullvad VPN", domain: "mullvad.net", aliases: ["mullvad"], category: "VPN", cancelUrl: "https://mullvad.net/en/account", steps: ["Enter account number", "Don't add more time — it expires naturally"] },
  { name: "Keeper Security", domain: "keepersecurity.com", aliases: ["keeper"], category: "Security", cancelUrl: "https://keepersecurity.com/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Dashlane", domain: "dashlane.com", aliases: ["dashlane"], category: "Security", cancelUrl: "https://app.dashlane.com/account/subscriptions", steps: ["Sign in", "Account → Subscriptions", "Cancel"] },
  { name: "Norton 360", domain: "norton.com", aliases: ["norton", "norton 360"], category: "Security", cancelUrl: "https://my.norton.com/extspa/subscriptions", steps: ["Sign in", "Subscriptions", "Cancel auto-renewal"] },
  { name: "McAfee", domain: "mcafee.com", aliases: ["mcafee"], category: "Security", cancelUrl: "https://home.mcafee.com/root/subscription", steps: ["Sign in", "My Account → Subscription", "Turn off auto-renewal"] },

  // ─── Fitness & Health ──────────────────────────────────────────────────
  { name: "Peloton", domain: "onepeloton.com", aliases: ["peloton"], category: "Fitness", cancelUrl: "https://account.onepeloton.com/preferences/membership", steps: ["Sign in", "Membership", "Cancel"] },
  { name: "Apple Fitness+", domain: "apple.com", aliases: ["apple fitness", "fitness+"], category: "Fitness", cancelUrl: "https://apps.apple.com/account/subscriptions", steps: ["Settings → Apple ID → Subscriptions", "Find Fitness+", "Cancel"] },
  { name: "Zwift", domain: "zwift.com", aliases: ["zwift"], category: "Fitness", cancelUrl: "https://my.zwift.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Fitbit Premium", domain: "fitbit.com", aliases: ["fitbit premium", "fitbit"], category: "Fitness", cancelUrl: "https://www.fitbit.com/settings/subscription", steps: ["Sign in", "Settings → Subscription", "Cancel"] },
  { name: "Nike Training Club", domain: "nike.com", aliases: ["nike training", "ntc"], category: "Fitness", cancelUrl: "https://www.nike.com/member/settings", steps: ["Sign in", "Member Settings", "Cancel subscription"] },
  { name: "Whoop", domain: "whoop.com", aliases: ["whoop"], category: "Fitness", cancelUrl: "https://app.whoop.com/account/membership", steps: ["Sign in", "Account → Membership", "Cancel"] },
  { name: "BetterHelp", domain: "betterhelp.com", aliases: ["betterhelp"], category: "Health", cancelUrl: "https://www.betterhelp.com/account/settings", steps: ["Sign in", "Account Settings", "Cancel membership"] },
  { name: "Talkspace", domain: "talkspace.com", aliases: ["talkspace"], category: "Health", cancelUrl: "https://www.talkspace.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },

  // ─── News & Media ──────────────────────────────────────────────────────
  { name: "The Athletic", domain: "theathletic.com", aliases: ["the athletic", "athletic"], category: "News", cancelUrl: "https://theathletic.com/account/manage-subscription", steps: ["Sign in", "Account → Manage Subscription", "Cancel"] },
  { name: "Bloomberg", domain: "bloomberg.com", aliases: ["bloomberg"], category: "News", cancelUrl: "https://www.bloomberg.com/account/subscriptions", steps: ["Sign in", "Account → Subscriptions", "Cancel"] },
  { name: "The Economist", domain: "economist.com", aliases: ["economist", "the economist"], category: "News", cancelUrl: "https://myaccount.economist.com/s/", steps: ["Sign in", "My Account → Subscription", "Cancel"] },
  { name: "Financial Times", domain: "ft.com", aliases: ["ft", "financial times"], category: "News", cancelUrl: "https://myaccount.ft.com/details/core/view", steps: ["Sign in", "My Account → Subscription", "Cancel"] },
  { name: "The Information", domain: "theinformation.com", aliases: ["the information"], category: "News", cancelUrl: "https://www.theinformation.com/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Wired", domain: "wired.com", aliases: ["wired"], category: "News", cancelUrl: "https://www.wired.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "The Verge+", domain: "theverge.com", aliases: ["verge", "the verge"], category: "News", cancelUrl: "https://www.theverge.com/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },

  // ─── Education ─────────────────────────────────────────────────────────
  { name: "Treehouse", domain: "teamtreehouse.com", aliases: ["treehouse"], category: "Education", cancelUrl: "https://teamtreehouse.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Udacity", domain: "udacity.com", aliases: ["udacity"], category: "Education", cancelUrl: "https://www.udacity.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Skillshare", domain: "skillshare.com", aliases: ["skillshare"], category: "Education", cancelUrl: "https://www.skillshare.com/settings/payments", steps: ["Sign in", "Settings → Payments", "Cancel membership"] },
  { name: "MasterClass", domain: "masterclass.com", aliases: ["masterclass"], category: "Education", cancelUrl: "https://www.masterclass.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Brilliant", domain: "brilliant.org", aliases: ["brilliant"], category: "Education", cancelUrl: "https://brilliant.org/account/", steps: ["Sign in", "Account → Subscription", "Cancel Premium"] },
  { name: "Codecademy Pro", domain: "codecademy.com", aliases: ["codecademy"], category: "Education", cancelUrl: "https://www.codecademy.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel Pro"] },
  { name: "DataCamp", domain: "datacamp.com", aliases: ["datacamp"], category: "Education", cancelUrl: "https://www.datacamp.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Pluralsight", domain: "pluralsight.com", aliases: ["pluralsight"], category: "Education", cancelUrl: "https://app.pluralsight.com/id/subscription", steps: ["Sign in", "Subscription", "Cancel plan"] },
  { name: "Blinkist", domain: "blinkist.com", aliases: ["blinkist"], category: "Education", cancelUrl: "https://www.blinkist.com/en/nc/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Wondrium", domain: "wondrium.com", aliases: ["wondrium", "great courses"], category: "Education", cancelUrl: "https://www.wondrium.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },

  // ─── Developer Tools ───────────────────────────────────────────────────
  { name: "JetBrains", domain: "jetbrains.com", aliases: ["jetbrains", "intellij", "webstorm", "pycharm"], category: "Development", cancelUrl: "https://account.jetbrains.com/licenses", steps: ["Sign in", "Licenses → Subscription", "Cancel auto-renewal"] },
  { name: "Postman", domain: "postman.com", aliases: ["postman"], category: "Development", cancelUrl: "https://web.postman.co/settings/team/billing-details", steps: ["Sign in", "Settings → Billing", "Cancel plan"] },
  { name: "Netlify Pro", domain: "netlify.com", aliases: ["netlify"], category: "Development", cancelUrl: "https://app.netlify.com/teams/billing", steps: ["Sign in", "Team → Billing", "Downgrade"] },
  { name: "Railway", domain: "railway.app", aliases: ["railway"], category: "Development", cancelUrl: "https://railway.app/account/billing", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Supabase Pro", domain: "supabase.com", aliases: ["supabase", "supabase pro"], category: "Development", cancelUrl: "https://supabase.com/dashboard/org/_/billing", steps: ["Sign in", "Organization → Billing", "Downgrade to Free"] },
  { name: "PlanetScale", domain: "planetscale.com", aliases: ["planetscale"], category: "Development", cancelUrl: "https://app.planetscale.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Render", domain: "render.com", aliases: ["render"], category: "Development", cancelUrl: "https://dashboard.render.com/billing", steps: ["Sign in", "Billing", "Cancel plan"] },
  { name: "Fly.io", domain: "fly.io", aliases: ["fly.io", "fly"], category: "Development", cancelUrl: "https://fly.io/dashboard/billing", steps: ["Sign in", "Dashboard → Billing", "Cancel"] },
  { name: "Cloudflare Pro", domain: "cloudflare.com", aliases: ["cloudflare"], category: "Development", cancelUrl: "https://dash.cloudflare.com/account/billing", steps: ["Sign in", "Account → Billing", "Downgrade"] },
  { name: "Sentry", domain: "sentry.io", aliases: ["sentry"], category: "Development", cancelUrl: "https://sentry.io/settings/billing/", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Datadog", domain: "datadoghq.com", aliases: ["datadog"], category: "Development", cancelUrl: "https://app.datadoghq.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel plan"] },
  { name: "New Relic", domain: "newrelic.com", aliases: ["new relic"], category: "Development", cancelUrl: "https://one.newrelic.com/admin-portal/billing", steps: ["Sign in", "Admin → Billing", "Cancel"] },
  { name: "Algolia", domain: "algolia.com", aliases: ["algolia"], category: "Development", cancelUrl: "https://www.algolia.com/account/billing/overview/", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Twilio", domain: "twilio.com", aliases: ["twilio"], category: "Development", cancelUrl: "https://www.twilio.com/console/billing", steps: ["Sign in", "Console → Billing", "Cancel"] },
  { name: "SendGrid", domain: "sendgrid.com", aliases: ["sendgrid"], category: "Development", cancelUrl: "https://app.sendgrid.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Downgrade"] },
  { name: "Resend", domain: "resend.com", aliases: ["resend"], category: "Development", cancelUrl: "https://resend.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },

  // ─── Design & Creative ─────────────────────────────────────────────────
  { name: "Framer", domain: "framer.com", aliases: ["framer"], category: "Design", cancelUrl: "https://framer.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Webflow", domain: "webflow.com", aliases: ["webflow"], category: "Design", cancelUrl: "https://webflow.com/dashboard/account/billing", steps: ["Sign in", "Account → Billing", "Cancel plan"] },
  { name: "Sketch", domain: "sketch.com", aliases: ["sketch"], category: "Design", cancelUrl: "https://www.sketch.com/settings/billing/", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "InVision", domain: "invisionapp.com", aliases: ["invision"], category: "Design", cancelUrl: "https://projects.invisionapp.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Miro", domain: "miro.com", aliases: ["miro"], category: "Design", cancelUrl: "https://miro.com/app/settings/team/billing/", steps: ["Sign in", "Settings → Billing", "Cancel plan"] },
  { name: "Loom", domain: "loom.com", aliases: ["loom"], category: "Productivity", cancelUrl: "https://www.loom.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Pitch", domain: "pitch.com", aliases: ["pitch"], category: "Design", cancelUrl: "https://app.pitch.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Spline", domain: "spline.design", aliases: ["spline"], category: "Design", cancelUrl: "https://app.spline.design/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Rive", domain: "rive.app", aliases: ["rive"], category: "Design", cancelUrl: "https://rive.app/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },

  // ─── Music & Audio ─────────────────────────────────────────────────────
  { name: "Qobuz", domain: "qobuz.com", aliases: ["qobuz"], category: "Music", cancelUrl: "https://www.qobuz.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Bandcamp", domain: "bandcamp.com", aliases: ["bandcamp"], category: "Music", cancelUrl: "https://bandcamp.com/settings", steps: ["Sign in", "Settings → Subscription", "Cancel"] },
  { name: "Pandora", domain: "pandora.com", aliases: ["pandora"], category: "Music", cancelUrl: "https://www.pandora.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Pocket Casts", domain: "pocketcasts.com", aliases: ["pocket casts"], category: "Music", cancelUrl: "https://www.pocketcasts.com/account/", steps: ["Sign in", "Account → Subscription", "Cancel Plus"] },

  // ─── Food & Delivery ───────────────────────────────────────────────────
  { name: "DoorDash DashPass", domain: "doordash.com", aliases: ["doordash", "dashpass"], category: "Food", cancelUrl: "https://www.doordash.com/consumer/membership/", steps: ["Sign in", "DashPass → Manage", "Cancel membership"] },
  { name: "Uber One", domain: "uber.com", aliases: ["uber one", "uber"], category: "Food", cancelUrl: "https://www.uber.com/us/en/u/uber-one/", steps: ["Sign in", "Uber One → Manage", "Cancel"] },
  { name: "Instacart+", domain: "instacart.com", aliases: ["instacart", "instacart+"], category: "Food", cancelUrl: "https://www.instacart.com/store/account/instacart-plus", steps: ["Sign in", "Account → Instacart+", "Cancel membership"] },
  { name: "HelloFresh", domain: "hellofresh.com", aliases: ["hellofresh", "hello fresh"], category: "Food", cancelUrl: "https://www.hellofresh.com/my-account/deliveries/", steps: ["Sign in", "Account → Plan Settings", "Cancel plan"] },
  { name: "Blue Apron", domain: "blueapron.com", aliases: ["blue apron"], category: "Food", cancelUrl: "https://www.blueapron.com/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },

  // ─── Productivity & Business ───────────────────────────────────────────
  { name: "Basecamp", domain: "basecamp.com", aliases: ["basecamp"], category: "Productivity", cancelUrl: "https://launchpad.37signals.com/account", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Linear", domain: "linear.app", aliases: ["linear"], category: "Productivity", cancelUrl: "https://linear.app/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Height", domain: "height.app", aliases: ["height"], category: "Productivity", cancelUrl: "https://height.app/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Zapier", domain: "zapier.com", aliases: ["zapier"], category: "Productivity", cancelUrl: "https://zapier.com/app/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel plan"] },
  { name: "Make (Integromat)", domain: "make.com", aliases: ["make", "integromat"], category: "Productivity", cancelUrl: "https://www.make.com/en/account/subscription", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Calendly", domain: "calendly.com", aliases: ["calendly"], category: "Productivity", cancelUrl: "https://calendly.com/account/billing", steps: ["Sign in", "Account → Billing", "Cancel"] },
  { name: "Obsidian Sync", domain: "obsidian.md", aliases: ["obsidian", "obsidian sync"], category: "Productivity", cancelUrl: "https://obsidian.md/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Superhuman", domain: "superhuman.com", aliases: ["superhuman"], category: "Productivity", cancelUrl: "https://superhuman.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Spark Mail", domain: "sparkmailapp.com", aliases: ["spark", "spark mail"], category: "Productivity", cancelUrl: "https://sparkmailapp.com/account", steps: ["Sign in", "Account → Subscription", "Cancel Premium"] },
  { name: "Cron Calendar", domain: "cron.com", aliases: ["cron", "notion calendar"], category: "Productivity", cancelUrl: "https://cron.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel"] },
  { name: "Raycast Pro", domain: "raycast.com", aliases: ["raycast"], category: "Productivity", cancelUrl: "https://raycast.com/settings/billing", steps: ["Sign in", "Settings → Billing", "Cancel Pro"] },
  { name: "Arc Browser Max", domain: "arc.net", aliases: ["arc", "arc browser"], category: "Productivity", cancelUrl: "https://arc.net/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },

  // ─── Finance ───────────────────────────────────────────────────────────
  { name: "YNAB", domain: "ynab.com", aliases: ["ynab", "you need a budget"], category: "Finance", cancelUrl: "https://app.ynab.com/settings/subscription", steps: ["Sign in", "Settings → Subscription", "Cancel"] },
  { name: "Mint Premium", domain: "mint.intuit.com", aliases: ["mint"], category: "Finance", cancelUrl: "https://mint.intuit.com/settings", steps: ["Sign in", "Settings → Subscription", "Cancel"] },
  { name: "Personal Capital", domain: "personalcapital.com", aliases: ["personal capital", "empower"], category: "Finance", cancelUrl: "https://www.personalcapital.com/account/settings", steps: ["Sign in", "Settings", "Cancel premium"] },
  { name: "Robinhood Gold", domain: "robinhood.com", aliases: ["robinhood", "robinhood gold"], category: "Finance", cancelUrl: "https://robinhood.com/account/settings", steps: ["Sign in", "Account → Settings → Gold", "Cancel Gold"] },
  { name: "Coinbase One", domain: "coinbase.com", aliases: ["coinbase one", "coinbase"], category: "Finance", cancelUrl: "https://www.coinbase.com/settings/subscription", steps: ["Sign in", "Settings → Subscription", "Cancel Coinbase One"] },

  // ─── Indian Services (2025-2026) ───────────────────────────────────────
  { name: "Kuku FM", domain: "kukufm.com", aliases: ["kuku fm", "kukufm"], category: "Entertainment", cancelUrl: "https://kukufm.com/account", steps: ["Open app", "Account → Subscription", "Cancel"] },
  { name: "Pocket FM", domain: "pocketfm.com", aliases: ["pocket fm"], category: "Entertainment", cancelUrl: "https://pocketfm.com/account", steps: ["Open app", "Account → Subscription", "Cancel"] },
  { name: "Pratilipi Premium", domain: "pratilipi.com", aliases: ["pratilipi"], category: "Education", cancelUrl: "https://www.pratilipi.com/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "PhonePe Wealth", domain: "phonepe.com", aliases: ["phonepe"], category: "Finance", cancelUrl: "https://www.phonepe.com/account", steps: ["Open app", "Account → Subscriptions", "Cancel"] },
  { name: "CRED Mint", domain: "cred.club", aliases: ["cred", "cred mint"], category: "Finance", cancelUrl: "https://cred.club/account", steps: ["Open app", "Account → Subscriptions", "Cancel"] },
  { name: "Zerodha", domain: "zerodha.com", aliases: ["zerodha"], category: "Finance", cancelUrl: "https://console.zerodha.com/account/subscription", steps: ["Sign in to Console", "Account → Subscription", "Cancel"] },
  { name: "Groww", domain: "groww.in", aliases: ["groww"], category: "Finance", cancelUrl: "https://groww.in/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Unacademy Plus", domain: "unacademy.com", aliases: ["unacademy", "unacademy plus"], category: "Education", cancelUrl: "https://unacademy.com/settings/subscription", steps: ["Sign in", "Settings → Subscription", "Cancel"] },
  { name: "BYJU'S", domain: "byjus.com", aliases: ["byjus", "byju's"], category: "Education", cancelUrl: "https://byjus.com/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Vedantu", domain: "vedantu.com", aliases: ["vedantu"], category: "Education", cancelUrl: "https://www.vedantu.com/account", steps: ["Sign in", "Account → Subscription", "Cancel"] },
  { name: "Lenskart Gold", domain: "lenskart.com", aliases: ["lenskart", "lenskart gold"], category: "Shopping", cancelUrl: "https://www.lenskart.com/account/gold", steps: ["Sign in", "Account → Gold Membership", "Cancel"] },
  { name: "Swiggy One", domain: "swiggy.com", aliases: ["swiggy one", "swiggy"], category: "Food", cancelUrl: "https://www.swiggy.com/account/super", steps: ["Open app", "Account → Swiggy One", "Cancel"] },
  { name: "Zomato Gold", domain: "zomato.com", aliases: ["zomato gold", "zomato"], category: "Food", cancelUrl: "https://www.zomato.com/gold", steps: ["Open app", "Account → Gold", "Cancel"] },
  { name: "BigBasket BBStar", domain: "bigbasket.com", aliases: ["bigbasket", "bbstar"], category: "Food", cancelUrl: "https://www.bigbasket.com/account/subscription", steps: ["Sign in", "Account → BBStar", "Cancel"] },
  { name: "Dunzo Daily", domain: "dunzo.com", aliases: ["dunzo"], category: "Food", cancelUrl: "https://www.dunzo.com/account", steps: ["Open app", "Account → Subscription", "Cancel"] },
]
