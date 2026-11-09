/* DrugBug Dashboard offline copy (Nov 9 2026). Network first, so you always get the newest
   version when online; the saved copy is used only when the computer is offline. Server
   calls (cloudfunctions, Google sign-in) are never cached. */
var CACHE = "dbd-v2";
var CORE = ["./", "index.html", "outreach.html", "notes.html", "dash.js", "manifest.json", "meta.json", "icon-192.png",
  "../app/vendor/firebase-app-compat.js", "../app/vendor/firebase-auth-compat.js", "../icon-48.png", "../icon-180.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  /* always ask the server for the newest copy (skip the 10-minute browser cache) */
  e.respondWith(fetch(r.mode === "navigate" ? r.url : r, { cache: "no-cache", credentials: "same-origin" }).then(function (res) {
    if (res && res.ok && res.type === "basic") { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match(u.pathname.replace(/\/$/, "/index.html")); }).then(function (m) { return m || Response.error(); });
  }));
});
