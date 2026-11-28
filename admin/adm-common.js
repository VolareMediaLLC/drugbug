/* Shared by the standalone Admin Dashboard pages that sit inside admin/index.html (Weekly Rewards, Protocols & AI Questions).
   Signs in with the same Firebase session as the dashboard (same site, same browser storage), calls the owner Cloud Functions with the
   person's ID token, and gives the pages Firestore for the few things they write straight to it (rules allow admins only).
   window.__ADMIN_TEST is a seam for the browser tests: when it is set, calls and writes go to it and nothing touches the network. */
(function () {
  var CFG = { apiKey: "AIzaSyC7cNkPSpPqfHPLNSY54u8QSL1jnaYsVMM", authDomain: "drugbug-69d42.firebaseapp.com", projectId: "drugbug-69d42", appId: "1:123306339603:web:2a0021f13fd8e620253ee6" };
  var FN = "https://us-central1-drugbug-69d42.cloudfunctions.net/";
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu=1/.test(location.search);
  if (local) { CFG.apiKey = "demo-key"; CFG.projectId = "demo-drugbug"; FN = "http://127.0.0.1:5001/demo-drugbug/us-central1/"; }
  var T = window.__ADMIN_TEST, auth = null, fsdb = null;
  if (!T) {
    if (!firebase.apps.length) firebase.initializeApp(CFG);
    auth = firebase.auth();
    if (local) auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
  }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function call(name, data) {
    if (T) return Promise.resolve().then(function () { return T.call(name, data || {}); });
    var u = auth.currentUser;
    if (!u || u.isAnonymous) return Promise.reject(new Error("Sign in on the dashboard first."));
    return u.getIdToken().then(function (tok) {
      return fetch(FN + name, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ data: data || {} }) });
    }).then(function (r) { if (r.status === 404) throw new Error("not deployed"); return r.json(); })
      .then(function (j) { if (j.error) throw new Error(j.error.message || j.error.status); return j.result; });
  }
  var NOTDEP = "This needs the newest server functions, which are not live yet. Deploy the server, then refresh.";
  function errTxt(e) { return /not deployed|failed to fetch|cors/i.test((e && e.message) || "") ? NOTDEP : (e && e.message) || "Something went wrong."; }
  function db() { if (T) return T.fs; if (!fsdb) fsdb = firebase.firestore(); return fsdb; }
  var ready = T ? Promise.resolve({ uid: "test-admin", email: "admin@test" }) : new Promise(function (res) { var off = auth.onAuthStateChanged(function (u) { if (u && !u.isAnonymous) { off(); res(u); } else if (u === null) res(null); }); });
  var kb = function (n) { return n >= 1024 ? Math.round(n / 1024) + " KB" : n + " B"; };
  window.ADM = { call: call, esc: esc, errTxt: errTxt, db: db, ready: ready, kb: kb, user: function () { return T ? { uid: "test-admin" } : auth.currentUser; } };
  if (/[?&]embed=1/.test(location.search)) document.documentElement.classList.add("embed");
})();
