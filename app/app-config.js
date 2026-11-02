/* DrugBug settings for the website build (dist/ and drugbug.app).
   The live site is drugbugapp.com (the CNAME in the repo), not drugbug.app.
   The iPhone build has its own copy at tools/ios/app-config.js; keep the Firebase block identical
   between them, because the two apps have to share one account and one database.

   These Firebase keys are public by design. They identify the project, they do not authorise
   anything: what actually protects the data is the Firestore security rules (tools/firestore.rules).
   Firebase project: DrugBug (drugbug-69d42), owned by volaremediallc@gmail.com. */
window.DRUGBUG_CONFIG = Object.assign({
  site: "https://drugbugapp.com",
  supportEmail: "VolareMediaLLC@gmail.com",
  firebase: {
    apiKey: "AIzaSyC7cNkPSpPqfHPLNSY54u8QSL1jnaYsVMM",
    authDomain: "drugbug-69d42.firebaseapp.com",
    projectId: "drugbug-69d42",
    storageBucket: "drugbug-69d42.firebasestorage.app",
    messagingSenderId: "123306339603",
    appId: "1:123306339603:web:2a0021f13fd8e620253ee6"
  },
  ownerUids: []   /* your own account id, from Settings once you have signed in, so the Control Center appears */
}, window.DRUGBUG_CONFIG || {});
