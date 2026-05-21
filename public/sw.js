// Service Worker for Web Push notifications.
// Minimal: only handles push + notificationclick. No caching to avoid PWA preview issues.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "TOUT DE SUITE", body: "Nouvelle notification", url: "/", type: "info", id: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    data.body = event.data ? event.data.text() : data.body;
  }

  const isPremium = data.type === "new_premium_listing";
  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    image: data.image,
    tag: data.id || data.url,
    data: { url: data.url || "/" },
    vibrate: isPremium ? [200, 100, 200, 100, 300] : [100, 50, 100],
    requireInteraction: isPremium,
    actions: [{ action: "open", title: "Voir l'annonce" }],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
