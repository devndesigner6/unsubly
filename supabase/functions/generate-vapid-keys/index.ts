import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Generate VAPID key pair using Web Crypto
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    )

    const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey)
    const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)

    // Base64url encode
    function base64UrlEncode(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer)
      let binary = ""
      for (const b of bytes) binary += String.fromCharCode(b)
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    }

    const publicKey = base64UrlEncode(publicKeyRaw)
    const privateKey = base64UrlEncode(privateKeyPkcs8)

    return new Response(
      JSON.stringify({
        publicKey,
        privateKey,
        instructions: [
          "1. Save VAPID_PUBLIC_KEY as a Supabase secret",
          "2. Save VAPID_PRIVATE_KEY as a Supabase secret",
          "3. Set VITE_VAPID_PUBLIC_KEY in your .env (same value as publicKey)",
          "4. Delete this edge function after setup",
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
