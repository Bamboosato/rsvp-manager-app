const CACHE_VERSION = "rsvp-hub-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const NAVIGATION_CACHE = `${CACHE_VERSION}-navigation`;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const STATIC_ASSETS = [
  "/",
  "/login",
  "/icons/rsvp-hub-icon.svg",
  "/icons/rsvp-hub-icon-192.png",
  "/icons/rsvp-hub-icon-512.png"
];

self.addEventListener("install", (event) => {
  if (isLocalDevelopmentHost()) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isLocalDevelopmentHost()) {
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
  }
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const notification = normalizeNotificationPayload(payload);

  if (!notification) {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: "/icons/rsvp-hub-icon-192.png",
      badge: "/icons/rsvp-hub-icon-192.png",
      tag: notification.tag,
      data: {
        url: notification.url
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = resolveNotificationUrl(event.notification.data?.url);

  event.waitUntil(openOrFocusClient(targetUrl));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }

  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response.ok) {
      const cache = await caches.open(NAVIGATION_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const fallbackResponse = await caches.match("/login");

    return (
      fallbackResponse ??
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      })
    );
  }
}

function isLocalDevelopmentHost() {
  return LOCAL_HOSTNAMES.has(self.location.hostname);
}

function readPushPayload(event) {
  if (!event.data) {
    return null;
  }

  try {
    return event.data.json();
  } catch {
    return {
      notification: {
        title: "RSVP Hub",
        body: event.data.text()
      }
    };
  }
}

function normalizeNotificationPayload(payload) {
  if (!payload) {
    return null;
  }

  const notification = payload.notification ?? payload.webpush?.notification ?? {};
  const data = payload.data ?? notification.data ?? {};
  const title = notification.title ?? data.title ?? "RSVP Hub";
  const body = notification.body ?? data.body ?? "";

  return {
    title,
    body,
    tag: notification.tag ?? (data.planId ? `invite-response-${data.planId}` : undefined),
    url: data.url ?? payload.fcmOptions?.link ?? payload.webpush?.fcmOptions?.link
  };
}

function resolveNotificationUrl(rawUrl) {
  if (!rawUrl) {
    return `${self.location.origin}/admin/plans`;
  }

  try {
    return new URL(rawUrl, self.location.origin).href;
  } catch {
    return `${self.location.origin}/admin/plans`;
  }
}

async function openOrFocusClient(targetUrl) {
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });

  for (const client of clientList) {
    const clientUrl = new URL(client.url);
    const target = new URL(targetUrl);

    if (clientUrl.origin === target.origin) {
      if ("navigate" in client) {
        await client.navigate(targetUrl);
      }

      return client.focus();
    }
  }

  return self.clients.openWindow(targetUrl);
}
