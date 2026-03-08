import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

// This public VAPID key is generated once and shared between frontend and edge function.
// The corresponding private key is stored as a Supabase secret (VAPID_PRIVATE_KEY).
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ""

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications() {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    setIsSupported(supported)
    if (supported) {
      setPermission(Notification.permission)
    }
  }, [])

  // Check existing subscription
  useEffect(() => {
    if (!isSupported || !user) return
    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        setIsSubscribed(!!subscription)
      } catch {
        setIsSubscribed(false)
      }
    }
    checkSubscription()
  }, [isSupported, user])

  const subscribe = useCallback(async () => {
    if (!user || !isSupported || !VAPID_PUBLIC_KEY) {
      toast.error("Push notifications not available", {
        description: !VAPID_PUBLIC_KEY ? "VAPID key not configured" : "Browser doesn't support push notifications",
      })
      return
    }

    setIsLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== "granted") {
        toast.error("Notification permission denied")
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const sub = subscription.toJSON()
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        throw new Error("Invalid push subscription")
      }

      // Save to database
      const { error } = await supabase.from("push_subscriptions" as any).upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        } as any,
        { onConflict: "user_id,endpoint" }
      )

      if (error) throw error

      setIsSubscribed(true)
      toast.success("Push notifications enabled!", {
        description: "You'll be notified before upcoming subscription charges",
      })
    } catch (err: any) {
      console.error("Push subscription error:", err)
      toast.error("Failed to enable notifications", { description: err?.message })
    } finally {
      setIsLoading(false)
    }
  }, [user, isSupported])

  const unsubscribe = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()

        // Remove from database
        await supabase
          .from("push_subscriptions" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", endpoint)
      }

      setIsSubscribed(false)
      toast.info("Push notifications disabled")
    } catch (err: any) {
      console.error("Push unsubscribe error:", err)
      toast.error("Failed to disable notifications", { description: err?.message })
    } finally {
      setIsLoading(false)
    }
  }, [user])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  }
}
