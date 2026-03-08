import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
}

// Web Push utilities using Web Crypto API (no npm dependency needed)
// Based on RFC 8291 and RFC 8292

async function importVapidKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(base64Key)
  return crypto.subtle.importKey("pkcs8", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
}

function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4)
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function createJwt(audience: string, subject: string, vapidPrivateKey: CryptoKey, vapidPublicKey: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" }
  const now = Math.floor(Date.now() / 1000)
  const payload = { aud: audience, exp: now + 86400, sub: subject }
  
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const input = `${headerB64}.${payloadB64}`
  
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    vapidPrivateKey,
    new TextEncoder().encode(input)
  )
  
  // Convert DER signature to raw r||s format
  const sig = new Uint8Array(signature)
  let r: Uint8Array, s: Uint8Array
  
  if (sig[0] === 0x30) {
    // DER format
    const rLen = sig[3]
    const rStart = 4
    r = sig.slice(rStart, rStart + rLen)
    const sLen = sig[rStart + rLen + 1]
    const sStart = rStart + rLen + 2
    s = sig.slice(sStart, sStart + sLen)
    
    // Remove leading zeros
    if (r.length > 32) r = r.slice(r.length - 32)
    if (s.length > 32) s = s.slice(s.length - 32)
    
    // Pad to 32 bytes
    const rawSig = new Uint8Array(64)
    rawSig.set(r, 32 - r.length)
    rawSig.set(s, 64 - s.length)
    
    return `${input}.${base64UrlEncode(rawSig)}`
  }
  
  return `${input}.${base64UrlEncode(signature)}`
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])
  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  const localPublicKey = new Uint8Array(localPublicKeyRaw)
  
  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw", base64UrlDecode(p256dhKey), { name: "ECDH", namedCurve: "P-256" }, false, []
  )
  
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPublicKey },
    localKeyPair.privateKey, 256
  )
  
  const authBytes = base64UrlDecode(authSecret)
  
  // HKDF for IKM
  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"])
  const subscriberPublicKeyRaw = base64UrlDecode(p256dhKey)
  
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...subscriberPublicKeyRaw,
    ...localPublicKey,
  ])
  
  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authBytes, info: authInfo },
    ikmKey, 256
  )
  
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"])
  
  // Derive content encryption key
  const cekInfo = new Uint8Array([...new TextEncoder().encode("Content-Encoding: aes128gcm\0")])
  const cek = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    prkKey, 128
  )
  
  // Derive nonce
  const nonceInfo = new Uint8Array([...new TextEncoder().encode("Content-Encoding: nonce\0")])
  const nonce = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    prkKey, 96
  )
  
  // Encrypt with AES-128-GCM
  const encKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"])
  const payloadBytes = new TextEncoder().encode(payload)
  
  // Add padding delimiter
  const padded = new Uint8Array(payloadBytes.length + 1)
  padded.set(payloadBytes)
  padded[payloadBytes.length] = 2 // padding delimiter
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    encKey, padded
  )
  
  // Build aes128gcm payload
  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, padded.length + 16 + 86) // approximate
  
  const header = new Uint8Array(86)
  header.set(salt, 0) // 16 bytes salt
  new DataView(header.buffer).setUint32(16, 4096) // record size
  header[20] = 65 // key length
  header.set(localPublicKey, 21) // 65 bytes local public key
  
  const body = new Uint8Array(header.length + encrypted.byteLength)
  body.set(header)
  body.set(new Uint8Array(encrypted), header.length)
  
  return { ciphertext: body, salt, localPublicKey }
}

async function sendPushNotification(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object,
  vapidPrivateKeyB64: string,
  vapidPublicKeyB64: string,
  vapidSubject: string
): Promise<boolean> {
  try {
    const payloadStr = JSON.stringify(payload)
    const { ciphertext } = await encryptPayload(payloadStr, p256dh, auth)
    
    const url = new URL(endpoint)
    const audience = `${url.protocol}//${url.host}`
    
    const vapidPrivateKey = await importVapidKey(vapidPrivateKeyB64)
    const jwt = await createJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKeyB64)
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKeyB64}`,
      },
      body: ciphertext,
    })
    
    if (!response.ok) {
      console.error(`Push failed (${response.status}):`, await response.text())
      return false
    }
    return true
  } catch (err) {
    console.error("Push notification error:", err)
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")

    if (!vapidPrivateKey || !vapidPublicKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find subscriptions billing within the next N days
    const alertDays = 3 // default
    const today = new Date()
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + alertDays)

    const { data: upcomingSubs, error: subsError } = await supabase
      .from("subscriptions")
      .select("id, name, amount, currency, next_billing_date, user_id, alert_days, alert_enabled, last_alert_sent")
      .eq("status", "active")
      .eq("alert_enabled", true)
      .lte("next_billing_date", futureDate.toISOString().split("T")[0])
      .gte("next_billing_date", today.toISOString().split("T")[0])

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError)
      throw subsError
    }

    if (!upcomingSubs || upcomingSubs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming subscriptions to notify", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    let totalSent = 0

    // Group by user
    const byUser: Record<string, typeof upcomingSubs> = {}
    for (const sub of upcomingSubs) {
      // Skip if alert was already sent today
      if (sub.last_alert_sent) {
        const lastSent = new Date(sub.last_alert_sent).toISOString().split("T")[0]
        if (lastSent === today.toISOString().split("T")[0]) continue
      }

      if (!byUser[sub.user_id]) byUser[sub.user_id] = []
      byUser[sub.user_id].push(sub)
    }

    for (const [userId, subs] of Object.entries(byUser)) {
      // Get push subscriptions for this user
      const { data: pushSubs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId)

      if (!pushSubs || pushSubs.length === 0) continue

      for (const sub of subs) {
        const daysUntil = Math.ceil(
          (new Date(sub.next_billing_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        const dayLabel = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`

        const payload = {
          title: `${sub.name} billing ${dayLabel}`,
          body: `${sub.currency || "USD"} ${sub.amount} will be charged ${dayLabel}`,
          icon: "/logo-192.png",
          badge: "/favicon-32x32.png",
          data: {
            url: "/subscriptions",
            subscriptionId: sub.id,
          },
        }

        for (const pushSub of pushSubs) {
          const success = await sendPushNotification(
            pushSub.endpoint,
            pushSub.p256dh,
            pushSub.auth,
            payload,
            vapidPrivateKey,
            vapidPublicKey,
            "mailto:notifications@unsubscribely.app"
          )
          if (success) totalSent++
        }

        // Mark alert as sent
        await supabase
          .from("subscriptions")
          .update({ last_alert_sent: new Date().toISOString() })
          .eq("id", sub.id)
      }
    }

    return new Response(
      JSON.stringify({ message: "Push notifications sent", sent: totalSent, checked: upcomingSubs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Edge function error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
