/* DrugBug Dashboard: shared sign-in, server calls and the offline-first store (Nov 9 2026).
   Used by outreach.html and notes.html. Every change is saved on this computer right away
   and queued; when the computer is online and signed in, the queue is sent to the server
   (dashSync) and changes made on other devices come back. */
(function () {
  "use strict";
  var CFG = { apiKey: "AIzaSyC7cNkPSpPqfHPLNSY54u8QSL1jnaYsVMM", authDomain: "drugbug-69d42.firebaseapp.com", projectId: "drugbug-69d42", appId: "1:123306339603:web:2a0021f13fd8e620253ee6" };
  var FN = "https://us-central1-drugbug-69d42.cloudfunctions.net/";
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu=1/.test(location.search);
  if (local) { CFG.apiKey = "demo-key"; CFG.projectId = "demo-drugbug"; FN = "http://127.0.0.1:5001/demo-drugbug/us-central1/"; }
  if (!firebase.apps.length) firebase.initializeApp(CFG);
  var auth = firebase.auth();
  if (local) try { auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true }); } catch (e) {}

  function call(name, data) {
    var u = auth.currentUser;
    if (!u) return Promise.reject(new Error("Sign in first."));
    return u.getIdToken().then(function (tok) {
      return fetch(FN + name, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ data: data || {} }) });
    }).then(function (r) { if (r.status === 404) throw new Error("not deployed"); return r.json(); })
      .then(function (j) { if (j.error) throw new Error(j.error.message || j.error.status); return j.result; });
  }

  var K = { docs: "dbd:docs", out: "dbd:outbox", since: "dbd:since", data: "dbd:contacts", last: "dbd:lastsync" };
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function keep(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  var COLS = ["outreach", "notes", "settings", "friends"];
  var docs = load(K.docs, {}); COLS.forEach(function (c) { docs[c] = docs[c] || {}; });
  var outbox = load(K.out, []);
  var since = load(K.since, 0);
  var lastSync = load(K.last, 0);
  var subs = [], stSubs = [], state = { online: navigator.onLine, syncing: false, err: "", user: null, ready: false };
  var dataCache = load(K.data, null);

  function emit() { subs.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function emitSt() { stSubs.forEach(function (f) { try { f(status()); } catch (e) {} }); }
  function status() { return { online: navigator.onLine, syncing: state.syncing, pending: outbox.length, err: state.err, last: lastSync, user: state.user, ready: state.ready }; }

  function get(col, id) { var d = docs[col][id]; return d && !d.del ? d : null; }
  function all(col) { var o = {}; Object.keys(docs[col]).forEach(function (k) { if (!docs[col][k].del) o[k] = docs[col][k]; }); return o; }
  function put(col, id, doc) {
    var d = Object.assign({}, doc, { at: Date.now() });
    docs[col][id] = d;
    outbox = outbox.filter(function (w) { return !(w.col === col && w.id === id); });
    outbox.push({ col: col, id: id, doc: d });
    keep(K.docs, docs); keep(K.out, outbox);
    emit(); emitSt(); soon();
    return d;
  }
  function del(col, id) { return put(col, id, { del: true }); }

  var timer = null;
  function soon() { clearTimeout(timer); timer = setTimeout(sync, 1500); }
  function sync() {
    if (state.syncing || !navigator.onLine || !auth.currentUser || auth.currentUser.isAnonymous) { emitSt(); return Promise.resolve(); }
    state.syncing = true; state.err = ""; emitSt();
    var sent = outbox.slice(0, 400);
    return call("dashSync", { writes: sent, since: Math.max(0, since - 300000) }).then(function (r) {
      /* drop what was sent, unless it changed again while the call was out */
      outbox = outbox.filter(function (w) { return !sent.some(function (s) { return s.col === w.col && s.id === w.id && s.doc.at === w.doc.at; }); });
      var pend = {}; outbox.forEach(function (w) { pend[w.col + "/" + w.id] = 1; });
      COLS.forEach(function (c) { var got = (r.docs && r.docs[c]) || {}; Object.keys(got).forEach(function (id) { if (!pend[c + "/" + id]) { var cur = docs[c][id]; if (!cur || (got[id].at || 0) >= (cur.at || 0)) docs[c][id] = got[id]; } }); });
      since = r.since || since; lastSync = Date.now();
      keep(K.docs, docs); keep(K.out, outbox); keep(K.since, since); keep(K.last, lastSync);
      state.syncing = false; emit(); emitSt();
      if (r.dataV && (!dataCache || dataCache.v !== r.dataV)) fetchData();
      if (outbox.length) soon();
    }).catch(function (e) {
      state.syncing = false;
      var m = (e && e.message) || "";
      state.err = /not deployed|not.?found/i.test(m) ? "The server part isn't installed yet. Run DEPLOY.cmd on your PC." : /permission|owner/i.test(m) ? "This account isn't the DrugBug owner account." : /failed to fetch|network/i.test(m) ? "" : m;
      emitSt();
    });
  }
  var dataWait = [];
  function fetchData() {
    return call("dashData").then(function (d) {
      dataCache = d; if (!keep(K.data, d)) console.warn("contact list too big to keep offline");
      dataWait.splice(0).forEach(function (f) { f(d); }); emit();
      return d;
    });
  }
  /* contacts: from this computer if saved, otherwise from the server */
  function contacts() {
    if (dataCache) return Promise.resolve(dataCache);
    return new Promise(function (res) { dataWait.push(res); if (auth.currentUser && navigator.onLine) fetchData().catch(function (e) { state.err = /not deployed/i.test(e.message) ? "The server part isn't installed yet. Run DEPLOY.cmd on your PC." : e.message; emitSt(); }); });
  }

  auth.onAuthStateChanged(function (u) {
    state.user = u && !u.isAnonymous ? (u.email || "signed in") : null; state.ready = true; emitSt();
    if (state.user) { sync(); if (!dataCache && dataWait.length) fetchData().catch(function () {}); }
  });
  window.addEventListener("online", function () { emitSt(); sync(); });
  window.addEventListener("offline", emitSt);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) sync(); });
  setInterval(function () { if (!document.hidden) sync(); }, 120000);
  window.addEventListener("storage", function (e) { if (e.key === K.docs) { docs = load(K.docs, docs); COLS.forEach(function (c) { docs[c] = docs[c] || {}; }); outbox = load(K.out, outbox); emit(); emitSt(); } });

  function ago(ms) { if (!ms) return "never"; var m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; }
  function statusText(s) {
    if (!s.ready) return "Starting…";
    if (!s.user) return "Not signed in. Sign in on the Home tab. Changes are saved on this computer until you do.";
    if (s.err) return s.err + (s.pending ? " " + s.pending + " change" + (s.pending === 1 ? "" : "s") + " saved on this computer." : "");
    if (!s.online) return "Offline. " + (s.pending ? s.pending + " change" + (s.pending === 1 ? "" : "s") + " saved on this computer, will sync when you're back online." : "Everything is saved on this computer.");
    if (s.syncing) return "Syncing…";
    if (s.pending) return s.pending + " change" + (s.pending === 1 ? "" : "s") + " waiting to sync…";
    return "Synced " + ago(s.last);
  }

  window.DASH = {
    auth: auth, call: call, get: get, all: all, put: put, del: del, sync: sync, contacts: contacts,
    on: function (f) { subs.push(f); }, onStatus: function (f) { stSubs.push(f); f(status()); }, status: status, statusText: statusText
  };
})();
