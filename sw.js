// Keeps Porchlight's files on this computer, so coming back is quicker.
//
// Only the game's own files (the ones loaded with ?v=, like "main.js?v=0.65"),
// the fonts and the voice library are kept. Each build keeps its own copy
// (the page registers "sw.js?v=<build>"), and older copies are cleared out,
// so an update always loads the new files. The page itself (index.html),
// the house server, the weather and YouTube are never kept here: they
// always come fresh.
const VERSION = new URL(self.location.href).searchParams.get("v") || "0";
const CACHE = "porchlight-" + VERSION;
const SHARED_HOSTS = ["esm.sh", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("porchlight-") && name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode === "navigate") return;
  const url = new URL(request.url);
  const ours = url.origin === self.location.origin && url.searchParams.has("v");
  if (!ours && !SHARED_HOSTS.includes(url.hostname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const kept = await cache.match(request);
      if (kept) return kept;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })()
  );
});
