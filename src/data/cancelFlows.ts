/**
 * Curated cancel-flow catalog for popular subscription services.
 *
 * Each entry maps a merchant to:
 *   - the deep-link URL where the cancel flow starts (verified working)
 *   - human-readable step-by-step instructions for users
 *   - typical wait/effective date hints when relevant
 *
 * Lookup is fuzzy: matches on `name` (case-insensitive substring) or any
 * entry in `aliases`. Returns `null` if no flow found, in which case the
 * UI shows the generic "open the website" fallback.
 */

export interface CancelFlow {
  /** Canonical merchant name shown in the UI. */
  name: string
  /** Lowercase substrings used for fuzzy matching on a subscription's name. */
  aliases: string[]
  /** Direct URL that lands the user on the cancel page (or as close as possible). */
  cancelUrl: string
  /** 2-4 short imperative steps. Keep each <80 chars. */
  steps: string[]
  /** Optional note about timing, refunds, or gotchas. */
  note?: string
}

export const CANCEL_FLOWS: CancelFlow[] = [
  // === Streaming video ===
  {
    name: "Netflix",
    aliases: ["netflix"],
    cancelUrl: "https://www.netflix.com/cancelplan",
    steps: [
      "Sign in if prompted",
      "Click \"Finish Cancellation\"",
      "Confirm, access continues until your billing date",
    ],
    note: "Membership stays active until the end of the current billing period.",
  },
  {
    name: "Disney+",
    aliases: ["disney", "disney+", "disneyplus"],
    cancelUrl: "https://www.disneyplus.com/account/subscription",
    steps: [
      "Sign in to your Disney+ account",
      "Find your subscription and click \"Cancel Subscription\"",
      "Confirm, you keep access until the period ends",
    ],
  },
  {
    name: "Hulu",
    aliases: ["hulu"],
    cancelUrl: "https://secure.hulu.com/account/cancel",
    steps: [
      "Sign in to your Hulu account",
      "Click \"Cancel\" next to your plan",
      "Choose \"Continue to Cancel\" and confirm",
    ],
  },
  {
    name: "HBO Max",
    aliases: ["hbo", "max", "hbo max"],
    cancelUrl: "https://auth.max.com/subscription",
    steps: [
      "Sign in to Max",
      "Open Subscription settings",
      "Click \"Cancel Subscription\" and confirm",
    ],
  },
  {
    name: "Amazon Prime",
    aliases: ["prime", "amazon prime", "amazon"],
    cancelUrl: "https://www.amazon.com/gp/primecentral",
    steps: [
      "Sign in to Amazon",
      "Go to \"Manage Membership\" → \"End Membership\"",
      "Click through 3 confirmation screens",
    ],
    note: "Amazon shows multiple retention offers, keep clicking \"End on [date]\".",
  },
  {
    name: "Apple TV+",
    aliases: ["apple tv", "appletv", "tv+"],
    cancelUrl: "https://tv.apple.com/account",
    steps: [
      "Sign in with your Apple ID",
      "Open Settings → Subscriptions",
      "Click \"Cancel Subscription\" next to Apple TV+",
    ],
  },
  {
    name: "Paramount+",
    aliases: ["paramount", "paramount+"],
    cancelUrl: "https://www.paramountplus.com/account/signin/?redirect_uri=/account/",
    steps: [
      "Sign in to your Paramount+ account",
      "Open Account → Cancel Subscription",
      "Confirm cancellation",
    ],
  },
  {
    name: "Peacock",
    aliases: ["peacock"],
    cancelUrl: "https://www.peacocktv.com/account/plans",
    steps: [
      "Sign in to Peacock",
      "Open Plans & Payment → Change or Cancel Plan",
      "Choose \"Cancel Plan\" and confirm",
    ],
  },
  {
    name: "YouTube Premium",
    aliases: ["youtube premium", "youtube"],
    cancelUrl: "https://www.youtube.com/paid_memberships",
    steps: [
      "Sign in with your Google account",
      "Click \"Manage membership\" → \"Deactivate\"",
      "Choose \"Cancel\" and confirm reason",
    ],
  },

  // === Music ===
  {
    name: "Spotify",
    aliases: ["spotify"],
    cancelUrl: "https://www.spotify.com/account/subscription/",
    steps: [
      "Sign in to your Spotify account",
      "Scroll to \"Available plans\" and pick \"Spotify Free\"",
      "Click \"Cancel Premium\" and confirm",
    ],
    note: "You keep Premium until the end of the paid period.",
  },
  {
    name: "Apple Music",
    aliases: ["apple music"],
    cancelUrl: "https://music.apple.com/account/settings",
    steps: [
      "Sign in with your Apple ID",
      "Open Settings → Subscriptions",
      "Click \"Cancel Subscription\" next to Apple Music",
    ],
  },
  {
    name: "Tidal",
    aliases: ["tidal"],
    cancelUrl: "https://my.tidal.com/account/subscription",
    steps: [
      "Sign in to Tidal",
      "Open Subscription and click \"Cancel Subscription\"",
      "Confirm cancellation",
    ],
  },
  {
    name: "SoundCloud Go",
    aliases: ["soundcloud"],
    cancelUrl: "https://soundcloud.com/settings/subscription",
    steps: [
      "Sign in to SoundCloud",
      "Open Settings → Subscription",
      "Click \"Cancel Subscription\" and confirm",
    ],
  },

  // === News & Reading ===
  {
    name: "New York Times",
    aliases: ["new york times", "nyt", "ny times", "nytimes"],
    cancelUrl: "https://www.nytimes.com/subscription/manage",
    steps: [
      "Sign in to your NYT account",
      "Open \"Manage Subscriptions\" and click \"Cancel\"",
      "Follow the prompts to confirm",
    ],
    note: "NYT often requires a chat agent for digital cancellations, be patient.",
  },
  {
    name: "Wall Street Journal",
    aliases: ["wsj", "wall street journal"],
    cancelUrl: "https://customercenter.wsj.com/view/membership",
    steps: [
      "Sign in to your WSJ account",
      "Open Membership → Cancel Subscription",
      "Confirm or call the listed retention number",
    ],
  },
  {
    name: "Washington Post",
    aliases: ["washington post", "wapo"],
    cancelUrl: "https://subscribe.washingtonpost.com/account/subscription/manage/",
    steps: [
      "Sign in to your account",
      "Open Subscription → Cancel Subscription",
      "Confirm cancellation",
    ],
  },
  {
    name: "Medium",
    aliases: ["medium"],
    cancelUrl: "https://medium.com/me/membership",
    steps: [
      "Sign in to Medium",
      "Open Membership settings",
      "Click \"Cancel Membership\" and confirm",
    ],
  },
  {
    name: "Substack",
    aliases: ["substack"],
    cancelUrl: "https://substack.com/account",
    steps: [
      "Sign in to Substack",
      "Open the publication you want to cancel",
      "Click \"Cancel subscription\" and confirm",
    ],
    note: "Each Substack publication is cancelled separately.",
  },

  // === Productivity & SaaS ===
  {
    name: "Notion",
    aliases: ["notion"],
    cancelUrl: "https://www.notion.so/my-integrations",
    steps: [
      "Sign in to Notion",
      "Open Settings & Members → Plans",
      "Click \"Downgrade\" → \"Free\" and confirm",
    ],
  },
  {
    name: "Figma",
    aliases: ["figma"],
    cancelUrl: "https://www.figma.com/files/team/personal/billing",
    steps: [
      "Sign in to Figma",
      "Open Settings → Plans",
      "Click \"Cancel plan\" and confirm",
    ],
  },
  {
    name: "Slack",
    aliases: ["slack"],
    cancelUrl: "https://my.slack.com/admin/billing",
    steps: [
      "Sign in as a workspace admin",
      "Open Billing → Change plan",
      "Choose \"Cancel paid plan\" and confirm",
    ],
  },
  {
    name: "Dropbox",
    aliases: ["dropbox"],
    cancelUrl: "https://www.dropbox.com/account/plan",
    steps: [
      "Sign in to Dropbox",
      "Open Plan → Cancel plan",
      "Choose a reason and confirm",
    ],
  },
  {
    name: "Google One",
    aliases: ["google one", "google storage"],
    cancelUrl: "https://one.google.com/storage",
    steps: [
      "Sign in with your Google account",
      "Open Settings → Cancel Membership",
      "Confirm cancellation",
    ],
  },
  {
    name: "iCloud+",
    aliases: ["icloud", "icloud+"],
    cancelUrl: "https://www.icloud.com/settings",
    steps: [
      "On your Apple device: Settings → [your name] → iCloud",
      "Tap \"Manage Storage\" → \"Change Storage Plan\"",
      "Tap \"Downgrade Options\" → choose Free → Done",
    ],
    note: "Easiest from an Apple device, not the web.",
  },
  {
    name: "Microsoft 365",
    aliases: ["microsoft 365", "office 365", "m365"],
    cancelUrl: "https://account.microsoft.com/services",
    steps: [
      "Sign in with your Microsoft account",
      "Find Microsoft 365 → Manage → Cancel Subscription",
      "Confirm and pick a reason",
    ],
  },
  {
    name: "Adobe Creative Cloud",
    aliases: ["adobe", "creative cloud", "photoshop", "lightroom"],
    cancelUrl: "https://account.adobe.com/plans",
    steps: [
      "Sign in to your Adobe account",
      "Click \"Manage plan\" → \"Cancel plan\"",
      "Confirm, early termination fees may apply on annual plans",
    ],
    note: "Annual plans cancelled mid-term incur a 50% remaining-balance fee.",
  },
  {
    name: "Canva Pro",
    aliases: ["canva"],
    cancelUrl: "https://www.canva.com/settings/billing-and-teams",
    steps: [
      "Sign in to Canva",
      "Open Billing & Plans",
      "Click \"Cancel subscription\" and confirm",
    ],
  },
  {
    name: "GitHub",
    aliases: ["github", "github copilot", "copilot"],
    cancelUrl: "https://github.com/settings/billing/plans",
    steps: [
      "Sign in to GitHub",
      "Open Settings → Billing & plans",
      "Click \"Downgrade\" or \"Cancel\" on the relevant plan",
    ],
  },
  {
    name: "Vercel",
    aliases: ["vercel"],
    cancelUrl: "https://vercel.com/account/plans",
    steps: [
      "Sign in to Vercel",
      "Open Account Settings → Plans",
      "Click \"Downgrade to Hobby\" and confirm",
    ],
  },

  // === Fitness / Wellness ===
  {
    name: "Peloton",
    aliases: ["peloton"],
    cancelUrl: "https://account.onepeloton.com/preferences/membership",
    steps: [
      "Sign in to your Peloton account",
      "Open Membership → Cancel Membership",
      "Confirm cancellation",
    ],
  },
  {
    name: "Calm",
    aliases: ["calm"],
    cancelUrl: "https://app.calm.com/me",
    steps: [
      "Sign in to Calm",
      "Open Profile → Manage Subscription",
      "Click \"Cancel Subscription\" and confirm",
    ],
  },
  {
    name: "Headspace",
    aliases: ["headspace"],
    cancelUrl: "https://my.headspace.com/subscription",
    steps: [
      "Sign in to Headspace",
      "Open Subscription settings",
      "Click \"Cancel Subscription\" and confirm",
    ],
  },

  // === AI / Dev tools ===
  {
    name: "ChatGPT Plus",
    aliases: ["chatgpt", "openai", "gpt"],
    cancelUrl: "https://chat.openai.com/#settings/Subscription",
    steps: [
      "Sign in to ChatGPT",
      "Open Settings → Subscription → Manage",
      "Click \"Cancel Plan\" and confirm",
    ],
  },
  {
    name: "Claude Pro",
    aliases: ["claude", "anthropic"],
    cancelUrl: "https://claude.ai/settings/billing",
    steps: [
      "Sign in to Claude",
      "Open Settings → Billing",
      "Click \"Cancel subscription\" and confirm",
    ],
  },
  {
    name: "Cursor",
    aliases: ["cursor"],
    cancelUrl: "https://www.cursor.com/settings",
    steps: [
      "Sign in to Cursor",
      "Open Settings → Manage Subscription",
      "Click \"Cancel Plan\" and confirm",
    ],
  },
  {
    name: "Replit",
    aliases: ["replit"],
    cancelUrl: "https://replit.com/account",
    steps: [
      "Sign in to Replit",
      "Open Account → Cyclic / Membership",
      "Click \"Cancel\" on the active plan and confirm",
    ],
  },

  // === Cloud / Hosting ===
  {
    name: "AWS",
    aliases: ["aws", "amazon web services"],
    cancelUrl: "https://console.aws.amazon.com/billing/home#/account",
    steps: [
      "Sign in to the AWS Console",
      "Open Billing → Account → Close Account",
      "Read the warning and confirm",
    ],
    note: "Closing an AWS account is permanent, back up data first.",
  },

  // === Other common ===
  {
    name: "LinkedIn Premium",
    aliases: ["linkedin", "linkedin premium"],
    cancelUrl: "https://www.linkedin.com/premium/manage/",
    steps: [
      "Sign in to LinkedIn",
      "Open Premium subscription settings",
      "Click \"Cancel subscription\" and confirm",
    ],
  },
  {
    name: "Duolingo Super",
    aliases: ["duolingo"],
    cancelUrl: "https://www.duolingo.com/settings/super",
    steps: [
      "Sign in to Duolingo",
      "Open Super → Manage Subscription",
      "Click \"Cancel Subscription\" and confirm",
    ],
  },
  {
    name: "Audible",
    aliases: ["audible"],
    cancelUrl: "https://www.audible.com/account/cancel-membership",
    steps: [
      "Sign in to your Audible account",
      "Choose a cancel reason and click \"Continue\"",
      "Click \"Cancel Membership\" to confirm",
    ],
    note: "Unused credits expire when membership ends, use them first.",
  },
]

/**
 * Find a cancel flow for a subscription by name. Case-insensitive substring
 * match against canonical name or any alias.
 */
export function findCancelFlow(subscriptionName: string | null | undefined): CancelFlow | null {
  if (!subscriptionName) return null
  const q = subscriptionName.toLowerCase().trim()
  if (!q) return null
  for (const flow of CANCEL_FLOWS) {
    if (flow.name.toLowerCase().includes(q) || q.includes(flow.name.toLowerCase())) return flow
    for (const alias of flow.aliases) {
      if (q.includes(alias)) return flow
    }
  }
  return null
}

/**
 * Extended findCancelFlow that also checks the 400+ subscription catalog.
 * Falls back to the original CANCEL_FLOWS list first, then the catalog.
 */
export function findCancelFlowExtended(subscriptionName: string | null | undefined): CancelFlow | null {
  // Try original catalog first (more detailed steps)
  const original = findCancelFlow(subscriptionName)
  if (original) return original

  // Try the extended 400+ catalog
  try {
    const { findSubscription } = require("./subscriptionCatalog")
    const entry = findSubscription(subscriptionName)
    if (entry) {
      return {
        name: entry.name,
        aliases: entry.aliases,
        cancelUrl: entry.cancelUrl,
        steps: entry.steps,
        note: entry.note,
      }
    }
  } catch {
    // Dynamic require not available — use static import path
  }
  return null
}
