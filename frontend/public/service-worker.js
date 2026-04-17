/* Round Table — Service Worker (PWA + Push Notifications) */
const CACHE_VERSION = "rt-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for everything; lets the app run normally and just enables installability.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
});

// ── Push Notifications ─────────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "Round Table", body: "You have a new notification" };
  try {
    if (event.data) data = event.data.json();
  } catch { /* use defaults */ }

  const options = {
    body: data.body || "",
    icon: data.icon || "/logo192.png",
    badge: data.badge || "/logo192.png",
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: data.data?.type || "general",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Round Table", options)
  );
});

// Click on notification → focus/open app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlPath = event.notification.data?.type === "walkie" ? "/walkie" :
                  event.notification.data?.type === "message" ? "/messages" :
                  event.notification.data?.type === "call" ? "/walkie" : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(urlPath);
          return;
        }
      }
      return self.clients.openWindow(urlPath);
    })
  );
});
