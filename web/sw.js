// Service worker: ออนไลน์ = โหลดของใหม่ล่าสุดเสมอ (อัปเดตอัตโนมัติ) · ออฟไลน์ = ใช้ของที่เก็บไว้
const CACHE = "pcp-__BUILD__";
const SHELL = ["./", "index.html", "app.js", "shared.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // ฟอนต์ ฯลฯ ให้เบราว์เซอร์จัดการเอง
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: "no-store" });
      if (res.ok) { const c = await caches.open(CACHE); c.put(url.pathname.endsWith("prices.json") ? "data/prices.json" : req, res.clone()); }
      return res;
    } catch (err) {
      const hit = await caches.match(url.pathname.endsWith("prices.json") ? "data/prices.json" : req, { ignoreSearch: true });
      return hit || caches.match("index.html");
    }
  })());
});
