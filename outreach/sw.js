/* lets Chrome/Edge offer "Install DrugBug Outreach"; always uses the network so nothing goes stale */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () {});
