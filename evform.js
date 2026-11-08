/* Evaluator sign-up form with the evaluator agreement (owner, Nov 8 2026). Used on the home page
   and on evaluate.html. Sends to evalApply; if the server can't be reached, opens an email instead. */
(function () {
  var f = document.getElementById("evform"); if (!f) return;
  var m = document.getElementById("ef-msg"), b = document.getElementById("ef-go");
  var v = function (i) { return (document.getElementById(i).value || "").trim(); };
  var say = function (t, ok) { m.hidden = false; m.className = "evmsg " + (ok ? "ok" : "err"); m.textContent = t; };
  var full = function (s) { return s.split(/\s+/).filter(function (x) { return x.length > 1; }).length >= 2; };
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var acks = [].map.call(f.querySelectorAll("[data-ack]:checked"), function (x) { return x.getAttribute("data-ack"); });
    var d = { name: v("ef-name"), email: v("ef-mail"), cred: v("ef-cred"), years: v("ef-years"), place: v("ef-place"), why: v("ef-why"), website: v("ef-web"), acks: acks, sig: v("ef-sig"), v: "2026-11-08" };
    if (!full(d.name)) return say("Please enter your full name (first and last).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return say("Please enter a valid email address.");
    if (!d.cred) return say("Please pick your role or credential.");
    if (acks.length < f.querySelectorAll("[data-ack]").length) return say("Please tick every box in the evaluator agreement.");
    if (!full(d.sig)) return say("Type your full name to sign the evaluator agreement.");
    b.disabled = true; b.textContent = "Sending…";
    var mail = function () {
      var body = "Name: " + d.name + "\nEmail: " + d.email + "\nRole: " + d.cred + "\nYears: " + (d.years || "-") + "\nWhere: " + (d.place || "-") + "\n\n" + d.why + "\n\nEvaluator agreement (" + d.v + ") ticked and signed: " + d.sig;
      location.href = "mailto:VolareMediaLLC@gmail.com?subject=" + encodeURIComponent("DrugBug evaluator sign-up: " + d.name) + "&body=" + encodeURIComponent(body);
      say("Your email app should open with your sign-up filled in. Send it and we will be in touch.", true);
    };
    fetch("https://us-central1-drugbug-69d42.cloudfunctions.net/evalApply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: d }) })
      .then(function (r) { if (r.status === 404) throw new Error("nf"); return r.json(); })
      .then(function (j) {
        b.disabled = false; b.textContent = "Sign me up";
        if (j.error) return say(j.error.message || "Something went wrong. Try again.");
        f.querySelectorAll("input,select,textarea").forEach(function (x) { if (x.type === "checkbox") x.checked = false; else x.value = ""; });
        say("Thank you! We got your sign-up. We will email you if you are chosen as an evaluator.", true);
      })
      .catch(function () { b.disabled = false; b.textContent = "Sign me up"; mail(); });
  });
})();
