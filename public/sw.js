// Push notification service worker
self.addEventListener("push", (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const options = {
      body: data.body || "You have a notification",
      icon: data.icon || "/logo-192.png",
      badge: data.badge || "/favicon-32x32.png",
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    }
    event.waitUntil(self.registration.showNotification(data.title || "Unsubscribely", options))
  } catch {
    const text = event.data.text()
    event.waitUntil(self.registration.showNotification("Unsubscribely", { body: text }))
  }
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "dismiss") return

  const url = event.notification.data?.url || "/dashboard"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
