/* DrugBug backend adapter (iPhone app). Makes Firebase look like the db/user API the app already uses, and adds
   optional personal accounts (Sign in with Apple, email + password).
   Off unless window.DRUGBUG_CONFIG.firebase is filled in.

   How accounts work:
   - Every install starts with an anonymous Firebase account (no personal information).
   - Creating an account LINKS Apple or email to that same account, so the account ID and all progress are kept.
   - Signing in to an account that already exists switches to it; the app then merges this phone's progress in.
   - Passwords go only to Firebase Authentication (never stored by DrugBug). Apple identity tokens are verified
     by Firebase's servers. All traffic is HTTPS/TLS; Firebase encrypts data at rest.
   - Delete account: the app deletes the person's Firestore records, then the Firebase account (and, for Apple,
     revokes the Apple token when the SDK supports it). */
(function () {
  var C = window.DRUGBUG_CONFIG || {}, F = C.firebase;
  if (!F || !F.apiKey || window.claude) return;
  var base = "vendor/"; /* Firebase 10.12.2 compat SDK, bundled inside the app (never downloaded at runtime: App Review 2.5.2) */
  function load(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  var auth = null, fs = null, listeners = [];
  /* developer testing only: on this computer, with ?emu=1, talk to the Firebase emulators instead of
     the live project. The hostname check means it can never switch on at drugbugapp.com. */
  var EMU = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu=1/.test((window.__DBQ || "") + location.search);
  function emit() { listeners.forEach(function (fn) { try { fn(state()); } catch (e) {} }); }
  function state() {
    var u = auth && auth.currentUser; if (!u) return { signedIn: false, anonymous: true };
    var prov = (u.providerData || []).map(function (p) { return p.providerId; });
    return { uid: u.uid, anonymous: u.isAnonymous, signedIn: !u.isAnonymous, email: u.email || "", emailVerified: !!u.emailVerified,
      provider: prov.indexOf("apple.com") >= 0 ? "apple" : prov.indexOf("google.com") >= 0 ? "google" : prov.indexOf("password") >= 0 ? "email" : "",
      hasPassword: prov.indexOf("password") >= 0, hasAppleLink: prov.indexOf("apple.com") >= 0 };
  }
  /* what happened while connecting, shown in Settings when the phone cannot connect (owner, Nov 8 2026) */
  var D = window.__fbDiag = { stage: "loading", err: "" };
  var ready = load(base + "firebase-app-compat.js")
    .then(function () { D.stage = "loading-2"; return Promise.all([load(base + "firebase-auth-compat.js"), load(base + "firebase-firestore-compat.js")]); }, function () { D.stage = "sdk-missing"; throw new Error("vendor/firebase-app-compat.js did not load"); })
    .then(function () {
      D.stage = "init";
      /* In the iPhone app, Firebase Auth's sign-in-with-popup helper loads a hidden page from authDomain
         and waits for it before it reports any user; inside the app that page never answers, so sign-in
         hung forever ("timeout-auth"). The app never uses popups or redirects (Apple sign-in is native,
         email needs no page), so the iPhone starts Firebase without authDomain and skips it. (Nov 8 2026) */
      var opts = {}; for (var k in F) opts[k] = F[k];
      if (window.DRUGBUG_NATIVE) delete opts.authDomain;
      /* and it would also fetch Google's gapi loader for that page first; a stand-in that answers
         "not available" right away lets Firebase carry on instead of waiting up to 30 seconds */
      if (window.DRUGBUG_NATIVE && !window.gapi) window.gapi = { load: function (name, o) { setTimeout(function () { if (o && typeof o.ontimeout === "function") o.ontimeout(); }, 0); } };
      firebase.initializeApp(opts);
      auth = firebase.auth();
      if (EMU) auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
      D.stage = "auth";
      return new Promise(function (res) {
        var done = false;
        auth.onAuthStateChanged(function (u) {
          D.stage = u ? "signed-in" : "anon-start";
          if (u) { if (!done) { done = true; res(u); } emit(); }
          else auth.signInAnonymously().catch(function (e) { D.stage = "anon-failed"; D.err = (e && (e.code || e.message)) || "unknown"; if (!done) { done = true; res(null); } });
        });
        setTimeout(function () { if (!done) { done = true; if (!auth.currentUser) { D.stage = "timeout-" + D.stage; } res(auth.currentUser || null); } }, 12000);
      });
    })
    .then(function (u) {
      if (!u) return null;
      fs = firebase.firestore();
      if (EMU) fs.useEmulator("127.0.0.1", 8080);
      try { fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
      D.stage = "ready";
      return true;
    })
    .catch(function (e) { D.err = D.err || (e && (e.code || e.message)) || "unknown"; if (D.stage !== "sdk-missing") D.stage = "error-" + D.stage; return null; });
  var owner = function () { var u = auth && auth.currentUser; return !!u && !u.isAnonymous && (C.ownerUids || []).indexOf(u.uid) >= 0; };

  /* Sign in with Apple happens natively (AuthenticationServices) through messageHandlers.auth; the native side
     returns {idToken, rawNonce, code} or {error}. */
  var appleWait = null;
  window.DrugBugAuth = { onApple: function (r) { if (appleWait) { var w = appleWait; appleWait = null; r && r.idToken ? w.res(r) : w.rej(new Error((r && r.error) || "cancelled")); } } };
  function appleNative() {
    var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.auth;
    if (!h) return Promise.reject(new Error("Sign in with Apple is available in the iPhone app."));
    return new Promise(function (res, rej) { appleWait = { res: res, rej: rej }; h.postMessage({ cmd: "apple" }); });
  }
  function appleCred(r) { return new firebase.auth.OAuthProvider("apple.com").credential({ idToken: r.idToken, rawNonce: r.rawNonce }); }
  /* Sign in with Google, used by the website (owner, Nov 1 2026). Apple sign-in needs the native
     AuthenticationServices bridge above, so on the web Google is the one-tap option and email is
     the other. A popup is used rather than a redirect so the person does not lose the page they
     were on; if the browser blocks it we fall back to a redirect. */
  function googleProvider() { var p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" }); return p; }
  function googleSignIn() {
    var u = auth.currentUser, p = googleProvider();
    var go = u && u.isAnonymous
      ? u.linkWithPopup(p).then(function () { return { switched: false }; })
      : auth.signInWithPopup(p).then(function () { return { switched: true }; });
    return go.catch(function (e) {
      var c = e && e.code || "";
      if (c === "auth/credential-already-in-use" && e.credential) return auth.signInWithCredential(e.credential).then(function () { return { switched: true }; });
      if (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-this-environment") { auth.signInWithRedirect(p); return new Promise(function () {}); }
      throw e;
    }).then(function (r) { emit(); return r; });
  }
  /* link to the current anonymous account (keeps the account ID and its data); if that Apple/email account
     already exists, sign in to it instead and report switched: true so the app merges this phone's progress. */
  function attach(cred) {
    var u = auth.currentUser;
    var p = u && u.isAnonymous ? u.linkWithCredential(cred).then(function () { return { switched: false }; }) : auth.signInWithCredential(cred).then(function () { return { switched: true }; });
    return p.catch(function (e) {
      if (e && (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use") && e.credential) return auth.signInWithCredential(e.credential).then(function () { return { switched: true }; });
      throw e;
    }).then(function (r) { emit(); return r; });
  }
  function msg(e) {
    var c = e && e.code || "";
    return { "auth/invalid-email": "That email address doesn't look right.", "auth/weak-password": "Use a password of at least 8 characters.",
      "auth/email-already-in-use": "An account already uses that email. Sign in instead.", "auth/wrong-password": "Email or password is incorrect.",
      "auth/user-not-found": "Email or password is incorrect.", "auth/invalid-credential": "Email or password is incorrect.", "auth/invalid-login-credentials": "Email or password is incorrect.",
      "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.", "auth/network-request-failed": "No internet connection.",
      "auth/requires-recent-login": "For your security, sign in again, then try once more.",
      "auth/account-exists-with-different-credential": "You already have a DrugBug account with this email. Sign in with your email and password instead. (Signed up with Google on the website? Add a password there in Settings, Account.)", "auth/credential-already-in-use": "That Apple ID is already linked to another DrugBug account. Sign out, then sign in with it.",
      "auth/popup-closed-by-user": "", "auth/cancelled-popup-request": "", "auth/user-cancelled": "" }[c] ||
      (/AuthorizationError error 1000/.test(e && e.message || "") ? "Sign in with Apple isn't available in this version of the app yet. Use email for now." : "") || (e && e.message) || "Something went wrong.";
  }
  var account = {
    state: state,
    onChange: function (fn) { listeners.push(fn); },
    signInApple: function () { return appleNative().then(function (r) { return attach(appleCred(r)); }); },
    /* add Apple to the account you are signed in to, so Apple signs you straight into it next time (owner, Nov 8 2026) */
    linkApple: function () { return appleNative().then(function (r) { var u = auth.currentUser; if (!u) throw new Error("Sign in first."); return u.linkWithCredential(appleCred(r)).then(function () { emit(); return true; }); }); },
    signInGoogle: googleSignIn,
    hasApple: function () { return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.auth); },
    createEmail: function (email, pw) {
      if (String(pw || "").length < 8) return Promise.reject({ message: "Use a password of at least 8 characters." });
      return attach(firebase.auth.EmailAuthProvider.credential(email, pw)).then(function (r) { try { auth.currentUser.sendEmailVerification(); } catch (e) {} return r; });
    },
    /* Link my other device (Nov 13 2026): a short code from the other device turns into a sign-in token */
    signInToken: function (tok) { return auth.signInWithCustomToken(tok).then(function () { emit(); return { switched: true }; }); },
    signInEmail: function (email, pw) { return auth.signInWithEmailAndPassword(email, pw).then(function () { emit(); return { switched: true }; }); },
    resetPassword: function (email) { return auth.sendPasswordResetEmail(email); },
    /* an Apple or Google account adds a password, so it can sign in with email where that button is missing
       (Apple only in the iPhone app, Google only on the website). Firebase may ask for a fresh sign-in first. */
    addPassword: function (pw) {
      var u = auth.currentUser;
      if (!u || !u.email) return Promise.reject({ message: "This account has no email address to sign in with." });
      if (String(pw || "").length < 8) return Promise.reject({ message: "Use a password of at least 8 characters." });
      return u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw)).then(function () { emit(); return true; });
    },
    signOut: function () { return auth.signOut().then(function () { return auth.signInAnonymously(); }).then(function () { emit(); }); },
    /* re-confirm identity before deleting (Firebase requires a recent sign-in) */
    reauth: function (pw) {
      var u = auth.currentUser, s = state();
      if (s.provider === "apple") return appleNative().then(function (r) { return u.reauthenticateWithCredential(appleCred(r)).then(function () { return r; }); });
      if (s.provider === "google") return u.reauthenticateWithPopup(googleProvider()).then(function () { return {}; });
      return u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw)).then(function () { return {}; });
    },
    deleteUser: function (appleCode) {
      var u = auth.currentUser; if (!u) return Promise.resolve();
      var rev = appleCode && typeof auth.revokeAccessToken === "function" ? auth.revokeAccessToken(appleCode).catch(function () {}) : Promise.resolve();
      return rev.then(function () { return u.delete(); }).then(function () { return auth.signInAnonymously(); }).then(function () { emit(); });
    },
    /* a short-lived ID token for calling our own Cloud Functions (checkout) */
    token: function () { var u = auth && auth.currentUser; return u ? u.getIdToken() : Promise.resolve(null); },
    error: msg
  };
  window.claude = {
    use: function (name) {
      return ready.then(function (ok) {
        if (!ok) return null;
        var u = auth.currentUser;
        if (name === "db") return { doc: function (p) { return fs.doc(p); }, collection: function (p) { return fs.collection(p); } };
        if (name === "user") return {
          id: function () { return Promise.resolve(auth.currentUser ? auth.currentUser.uid : null); },
          me: function () { return Promise.resolve({ id: auth.currentUser ? auth.currentUser.uid : null, name: "" }); },
          isOwner: function () { return Promise.resolve(owner()); }, canEdit: function () { return Promise.resolve(owner()); }, can: function () { return Promise.resolve(owner()); }
        };
        if (name === "account") return account;
        return null;
      });
    }
  };
})();
