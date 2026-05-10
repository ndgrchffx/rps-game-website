// Service Worker for JANKEN Web Push
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "JANKEN";
  const options = {
    body: data.body || "Ada notifikasi baru!",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: data.data || {},
    actions: data.data?.type === "challenge" ? [
      { action: "accept", title: "⚔️ Terima" },
      { action: "decline", title: "❌ Tolak" },
    ] : [],
    requireInteraction: data.data?.type === "challenge",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data;
  if (event.action === "accept" || !event.action) {
    event.waitUntil(clients.openWindow(`/?challenge=${data.challengerId || ""}`));
  }
});
