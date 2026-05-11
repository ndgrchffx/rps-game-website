// public/sw.js - Service Worker JANKEN
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "JANKEN";
  const options = {
    body: data.body || "Ada notifikasi baru!",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: data.data || {},
    requireInteraction: data.data?.type === "challenge",
    actions: data.data?.type === "challenge" ? [
      { action: "accept", title: "⚔️ Terima Challenge" },
      { action: "decline", title: "❌ Tolak" },
    ] : [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data;

  if (event.action === "decline") return;

  // Buka app dan arahkan ke leaderboard untuk accept challenge
  const urlToOpen = data?.url || "/leaderboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Jika app sudah terbuka, fokus dan navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.postMessage({ type: "PUSH_NAVIGATE", url: urlToOpen, challengeData: data });
          return;
        }
      }
      // Jika app belum terbuka, buka baru
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
