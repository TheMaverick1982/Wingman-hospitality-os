// Wingman service worker — offline caching only (no push yet). Hand-rolled to
// avoid a build plugin on this customized Next. Strategy:
//   - /_next/static + static file types -> stale-while-revalidate (safe: no user data)
//   - navigations (HTML)                -> network-first, /offline fallback. We never
//        serve cached authed HTML, so no user is ever shown another user's page.
//   - /api and everything else          -> passthrough (untouched)
// Bump VERSION when the offline page or caching logic changes to drop old caches.
const VERSION = "v1";
const STATIC_CACHE = `wm-static-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  // Intentionally NOT skipWaiting here — the client shows an update prompt and
  // messages SKIP_WAITING when the user chooses to refresh.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("wm-static-") && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || /\.(?:js|css|woff2?|ttf|png|jpe?g|svg|webp|gif|ico|avif)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // same-origin only
  if (url.pathname.startsWith("/api")) return; // never touch API / auth

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirstNav(req));
  }
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function networkFirstNav(req) {
  try {
    return await fetch(req);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
  }
}
