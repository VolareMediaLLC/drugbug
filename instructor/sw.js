/* DrugBug for Instructors, installed as a desktop app (Nov 20 2026). Network first: you always get the newest page
   when online; a saved copy is shown only when the computer is offline. Class data (cloudfunctions) and sign-in are
   never cached, so nothing about students is stored by this file. */
var CACHE = "dbi-v1";
var CORE = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png", "qbank.json",
  "../app/vendor/firebase-app-compat.js", "../app/vendor/firebase-auth-compat.js", "../icon-48.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () {}); })); self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf("dbi-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); })); self.clients.claim(); });
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(function (r) {
    if (r && r.ok && r.type === "basic") { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match("index.html"); }); }));
});
