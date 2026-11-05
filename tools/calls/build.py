import json, sys
sys.path.insert(0, "/home/claude/work/calls")
from content import SCALES, CALLS
from questions import Q

ids = {s["id"] for s in SCALES}
for q in Q:
    assert q["scale"] is None or q["scale"] in ids, q["q"]
    if q["t"] == "M":
        q["opts"] = [[o[0] == "+", o[1]] for o in q["opts"]]

J = lambda o: json.dumps(o, ensure_ascii=True, separators=(",", ":"))
js = r'''
/* ---------- Big Calls: stroke, STEMI, sepsis, trauma, ROSC (owner, Nov 5 2026) ----------
   Learning pages plus a quiz. The stroke page asks which stroke scale your agency uses (on the
   side) and from then on only asks scale questions about that scale, here and in Registry prep.
   Education only, no doses. Content from the 2026 AHA/ASA acute ischemic stroke guideline and the
   AHA Mission: Lifeline EMS routing algorithm; see tools/calls/ in the repo for the sources. */
var CALLS = __CALLS__;
var CALL_SCALES = __SCALES__;
var CALLQ = __Q__;
ICO.calls = '<path d="M3 12h4l2-5 4 10 2-5h6"/><circle cx="12" cy="12" r="10" stroke-opacity=".35"/>';
(function () {
  if (typeof DB === "undefined") return;
  DB.RQ = DB.RQ || [];
  CALLQ.forEach(function (q, k) {
    var it = { reg: 1, lv: q.lv, cat: q.cat, d: "", q: q.q, x: q.x, w: [], call: q.call, scale: q.scale || "", cqid: "cq" + k };
    if (q.t === "S") { it.a = q.a; it.w = q.w.slice(); }
    else if (q.t === "M") { it.t = "multi"; it.opts = q.opts.map(function (o) { return o[1]; }); it.ok = q.opts.filter(function (o) { return o[0]; }).map(function (o) { return o[1]; }); it.a = it.ok.join("; "); }
    else { it.t = "order"; it.prio = 1; it.opts = q.opts.slice(); it.ok = q.opts.slice(); it.a = q.opts.map(function (p, i) { return (i + 1) + ". " + p; }).join("  "); }
    q.it = it; DB.RQ.push(it);
  });
})();
function strokeScale() { return (typeof Prog !== "undefined" && Prog.d && Prog.d.strokeScale) || ""; }
function scaleById(id) { return CALL_SCALES.filter(function (s) { return s.id === id; })[0] || null; }
/* a scale question only shows once the agency's scale is known, and only for that scale */
function callScaleOK(q) { if (!q || !q.scale) return true; var sc = strokeScale(); return !sc || q.scale === sc; }
function callQs(call) { return CALLQ.filter(function (q) { return q.call === call && callScaleOK(q); }); }
function callTabOK() { return S.view === "level" && (routeOfLevel(S.level) === "ph" || S.level === "rn" || S.level === "flightrn"); }
function scaleCard(s, full) {
  return '<div class="cscard"><div class="cskind">' + esc(s.kind) + '</div><h3>' + esc(s.name) + '</h3><p class="cstell">' + esc(s.tells) + '</p>' +
    '<ul class="csitems">' + s.items.map(function (i) { return '<li><b>' + esc(i[0]) + '</b>' + (i[1] ? ' ' + esc(i[1]) : '') + '</li>'; }).join("") + '</ul>' +
    '<p class="cspos"><b>Positive:</b> ' + esc(s.pos) + '</p>' + (full ? '<p class="cspearl">' + esc(s.pearl) + '</p>' : '') + '</div>';
}
function scalePicker() {
  var sc = strokeScale(), s = scaleById(sc);
  var sel = '<label class="cslabel" for="cscale">What stroke scale does your agency use?</label><select id="cscale" class="cssel"><option value="">Pick your scale</option>' +
    CALL_SCALES.map(function (x) { return '<option value="' + x.id + '"' + (x.id === sc ? ' selected' : '') + '>' + esc(x.short) + ' (' + esc(x.kind.toLowerCase()) + ')</option>'; }).join("") + '</select>';
  return '<aside class="callside">' + sel + (s ? '<p class="csnote">Quizzes now ask only about ' + esc(s.short) + '. Change it any time.</p><details class="csdet"' + (window.innerWidth >= 900 ? ' open' : '') + '><summary>How ' + esc(s.short) + ' works</summary>' + scaleCard(s, true) + '</details>'
    : '<p class="csnote">Pick the one you use and the quiz will only ask about that scale from now on.</p>') + '</aside>';
}
function callsView() {
  var C = CALLS.filter(function (c) { return c.id === S.callId; })[0];
  if (!C) {
    S.callId = null;
    return '<p class="muted">The time-critical calls: what to recognize, the clocks that matter, and where the patient needs to go. Education only; your protocols decide care.</p>' +
      '<div class="calllist">' + CALLS.map(function (c) { var n = callQs(c.id).length; return '<button class="callitem" data-callid="' + c.id + '"><strong>' + esc(c.name) + '</strong><span>' + esc(c.line) + '</span><em>' + n + ' questions</em></button>'; }).join("") + '</div>';
  }
  var main = '<header class="callhead"><h2>' + esc(C.name) + '</h2><p class="muted">' + esc(C.line) + '</p></header>' + callQuizHTML(C);
  main += C.sec.map(function (s, i) {
    return '<details class="callsec"' + (i === 0 ? ' open' : '') + '><summary>' + esc(s[0]) + '</summary><ul>' + s[1].map(function (l) { return '<li>' + esc(l) + '</li>'; }).join("") + '</ul></details>';
  }).join("");
  if (C.id === "stroke") {
    var sc = strokeScale();
    main += '<details class="callsec"><summary>Other stroke scales you may see</summary><div class="csgrid">' + CALL_SCALES.filter(function (s) { return s.id !== sc; }).map(function (s) { return scaleCard(s, false); }).join("") + '</div></details>';
  }
  main += '<p class="dnote callfoot">Education only. Follow your local protocols and medical direction. DrugBug does not give drug doses here.</p>';
  if (C.id !== "stroke") return '<div class="callwrap">' + main + '</div>';
  return '<div class="callgrid"><div class="callmain">' + main + '</div>' + scalePicker() + '</div>';
}
/* the quiz: 10 questions from this call, one at a time */
function callQuizHTML(C) {
  var Z = S.cq && S.cq.call === C.id ? S.cq : null;
  var pool = callQs(C.id);
  if (!Z) {
    var need = C.id === "stroke" && !strokeScale();
    return '<div class="cq start"><div><b>Quiz me</b><span>' + Math.min(10, pool.length) + ' of ' + pool.length + ' questions' + (need ? '. Pick your stroke scale first so it only asks about yours.' : '') + '</span></div><button class="btn small" data-cqstart="' + C.id + '">Start</button></div>';
  }
  if (Z.i >= Z.list.length) {
    return '<div class="cq done"><b>' + Z.score + ' of ' + Z.list.length + ' right</b><div class="cqacts"><button class="btn small" data-cqstart="' + C.id + '">Another 10</button><button class="btn small ghost" data-cqend="1">Done</button></div></div>';
  }
  var q = CALLQ[Z.list[Z.i]], h = '<div class="cq"><div class="cqtop"><span>Question ' + (Z.i + 1) + ' of ' + Z.list.length + '</span>' + (q.scale ? '<span class="pill">' + esc((scaleById(q.scale) || {}).short || "") + '</span>' : '') + '</div><p class="cqq">' + esc(q.q) + '</p>';
  if (q.t === "S") {
    if (!Z.order) Z.order = shuffle([q.a].concat(q.w));
    h += '<div class="cqopts">' + Z.order.map(function (o, k) {
      var cls = Z.ans == null ? "" : o === q.a ? " right" : k === Z.ans ? " wrong" : " dim";
      return '<button class="cqo' + cls + '" data-cqa="' + k + '"' + (Z.ans != null ? ' disabled' : '') + '>' + esc(o) + '</button>';
    }).join("") + '</div>';
  } else if (q.t === "M") {
    if (!Z.order) { Z.order = shuffle(q.opts.map(function (o, k) { return k; })); Z.sel = {}; }
    h += '<p class="cqhint">Select all that apply.</p><div class="cqopts">' + Z.order.map(function (k) {
      var o = q.opts[k], on = !!Z.sel[k], cls = on ? " on" : "";
      if (Z.ans != null) cls += o[0] ? (on ? " right" : " missed") : (on ? " wrong" : " dim");
      return '<button class="cqo multi' + cls + '" data-cqm="' + k + '"' + (Z.ans != null ? ' disabled' : '') + '><i aria-hidden="true"></i>' + esc(o[1]) + '</button>';
    }).join("") + '</div>' + (Z.ans == null ? '<button class="btn small" data-cqcheck="1">Check</button>' : '');
  } else {
    if (!Z.order) { Z.order = shuffle(q.opts.map(function (o, k) { return k; })); Z.seq = []; }
    h += '<p class="cqhint">Tap them in order, first to last.</p><div class="cqopts">' + Z.order.map(function (k) {
      var n = Z.seq.indexOf(k), cls = n >= 0 ? " on" : "";
      if (Z.ans != null) cls += Z.seq[k] === k ? "" : "";
      return '<button class="cqo ord' + cls + '" data-cqord="' + k + '"' + (Z.ans != null || n >= 0 ? ' disabled' : '') + '><i aria-hidden="true">' + (n >= 0 ? n + 1 : '') + '</i>' + esc(q.opts[k]) + '</button>';
    }).join("") + '</div>' + (Z.ans == null && Z.seq.length ? '<button class="btn small ghost" data-cqreset="1">Start over</button>' : '');
    if (Z.ans != null) h += '<ol class="cqorder">' + q.opts.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join("") + '</ol>';
  }
  if (Z.ans != null) h += '<div class="cqx ' + (Z.ok ? 'ok' : 'no') + '"><b>' + (Z.ok ? 'Right.' : 'Not quite.') + '</b> ' + esc(q.x) + '</div><button class="btn small" data-cqnext="1">' + (Z.i + 1 < Z.list.length ? 'Next' : 'See score') + '</button>';
  return h + '</div>';
}
function cqRender() { var el = document.querySelector(".cq"); if (!el || !S.callId) return render(); var C = CALLS.filter(function (c) { return c.id === S.callId; })[0]; var w = document.createElement("div"); w.innerHTML = callQuizHTML(C); el.parentNode.replaceChild(w.firstChild, el); }
function cqFinish(ok) { var Z = S.cq; Z.ans = 1; Z.ok = ok; if (ok) Z.score++; try { if (typeof sfx === "function") sfx(ok); } catch (e) {} cqRender(); }
function callsClick(t, a) {
  if (a.callid) { S.callId = a.callid; S.cq = null; render(); try { window.scrollTo(0, 0); } catch (e) {} return true; }
  if (a.callback) { S.callId = null; S.cq = null; render(); try { window.scrollTo(0, 0); } catch (e) {} return true; }
  if (a.cqend) { S.cq = null; cqRender(); return true; }
  if (a.cqstart) {
    var pool = []; CALLQ.forEach(function (q, k) { if (q.call === a.cqstart && callScaleOK(q)) pool.push(k); });
    S.cq = { call: a.cqstart, list: shuffle(pool).slice(0, 10), i: 0, score: 0 }; cqRender(); return true;
  }
  var Z = S.cq; if (!Z) return false;
  var q = CALLQ[Z.list[Z.i]];
  if (a.cqa != null && Z.ans == null) { Z.ans = +a.cqa; var ok = Z.order[+a.cqa] === q.a; Z.ans = +a.cqa; Z.ok = ok; if (ok) Z.score++; try { if (typeof sfx === "function") sfx(ok); } catch (e) {} cqRender(); return true; }
  if (a.cqm != null && Z.ans == null) { Z.sel[+a.cqm] = !Z.sel[+a.cqm]; t.classList.toggle("on"); return true; }
  if (a.cqcheck) { cqFinish(q.opts.every(function (o, k) { return !!o[0] === !!Z.sel[k]; })); return true; }
  if (a.cqord != null && Z.ans == null) { Z.seq.push(+a.cqord); if (Z.seq.length === q.opts.length) cqFinish(Z.seq.every(function (k, i) { return k === i; })); else cqRender(); return true; }
  if (a.cqreset) { Z.seq = []; cqRender(); return true; }
  if (a.cqnext) { Z.i++; Z.ans = null; Z.order = null; Z.ok = null; cqRender(); var el = document.querySelector(".cq"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); return true; }
  return false;
}
document.addEventListener("change", function (e) {
  if (!e.target || e.target.id !== "cscale") return;
  Prog.d.strokeScale = e.target.value || ""; if (typeof saveProg === "function") saveProg();
  if (S.cq && S.cq.call === "stroke") S.cq = null;
  render();
});
(function () {
  var css = '.calllist{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:12px}' +
    '.callitem{text-align:left;border:1px solid var(--line);border-radius:16px;padding:14px;background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;display:flex;flex-direction:column;gap:4px}' +
    '.callitem strong{font-size:17px}.callitem span{font-size:14px;color:var(--muted);line-height:1.35}.callitem em{font-style:normal;font-size:12px;font-weight:700;color:var(--muted);margin-top:4px}' +
    '.callgrid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}.callside{order:-1}' +
    '@media (min-width:900px){.callgrid{grid-template-columns:minmax(0,1fr) 300px;align-items:start}.callside{order:0;position:sticky;top:12px}}' +
    '.callside{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:14px}' +
    '.cslabel{display:block;font-weight:800;font-size:15px;margin-bottom:8px}.cssel{width:100%;font:inherit;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}' +
    '.csnote{font-size:13px;color:var(--muted);margin:8px 0}' +
    '.csdet summary{cursor:pointer;font-weight:700;font-size:14px;color:var(--gen,#2bb3a3)}' +
    '.cscard{border-top:1px solid var(--line);padding-top:10px;margin-top:6px}.cskind{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}.cscard h3{margin:2px 0 6px;font-size:16px}' +
    '.cstell{font-size:14px;margin:0 0 8px}.csitems{margin:0 0 8px;padding-left:18px;font-size:14px}.csitems li{margin:4px 0}.cspos{font-size:14px;margin:0 0 6px;padding:8px 10px;border-radius:10px;background:var(--surface-2)}.cspearl{font-size:13px;color:var(--muted);margin:0}' +
    '.csgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}.csgrid .cscard{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:0;background:var(--bg)}' +
    '.callhead h2{margin:0 0 2px}.callhead p{margin:0 0 10px}' +
    '.callsec{border:1px solid var(--line);border-radius:14px;background:var(--surface);margin:0 0 10px}.callsec summary{cursor:pointer;font-weight:800;padding:12px 14px;list-style:none}.callsec summary::-webkit-details-marker{display:none}.callsec summary::after{content:"+";float:right;color:var(--muted)}.callsec[open] summary::after{content:"-"}' +
    '.callsec ul{margin:0;padding:0 16px 12px 32px}.callsec li{margin:6px 0;line-height:1.45;font-size:15px}.callsec .csgrid{padding:0 12px 12px}' +
    '.cq{border:1.5px solid var(--gen,#2bb3a3);border-radius:16px;padding:12px 14px;margin:0 0 12px;background:var(--surface)}' +
    '.cq.start,.cq.done{display:flex;align-items:center;justify-content:space-between;gap:12px}.cq.start div{display:flex;flex-direction:column}.cq.start span{font-size:13px;color:var(--muted)}.cqacts{display:flex;gap:8px}' +
    '.cqtop{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);font-weight:700}.cqq{font-size:16px;font-weight:700;margin:8px 0 10px;line-height:1.4}.cqhint{font-size:13px;color:var(--muted);margin:-4px 0 8px}' +
    '.cqopts{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}.cqo{text-align:left;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;font-size:15px;padding:10px 12px;border-radius:12px;cursor:pointer;display:flex;gap:10px;align-items:flex-start}' +
    '.cqo i{flex:none;width:20px;height:20px;border-radius:6px;border:1.5px solid var(--line);font-style:normal;font-size:12px;font-weight:800;display:grid;place-items:center}.cqo.on{border-color:var(--gen,#2bb3a3)}.cqo.on i{background:var(--gen,#2bb3a3);border-color:transparent;color:#fff}' +
    '.cqo.right{border-color:var(--ok,#22a06b);background:color-mix(in srgb,var(--ok,#22a06b) 14%,var(--bg))}.cqo.wrong{border-color:var(--bad,#e5484d);background:color-mix(in srgb,var(--bad,#e5484d) 12%,var(--bg))}.cqo.missed{border-style:dashed;border-color:var(--ok,#22a06b)}.cqo.dim{opacity:.55}.cqo:disabled{cursor:default;color:var(--ink)}' +
    '.cqx{font-size:14px;line-height:1.45;padding:10px 12px;border-radius:12px;background:var(--surface-2);margin-bottom:10px;border-left:4px solid var(--ok,#22a06b)}.cqx.no{border-left-color:var(--bad,#e5484d)}.cqorder{font-size:14px;margin:0 0 10px;padding-left:22px}' +
    '.callfoot{margin-top:14px}';
  try { var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); } catch (e) {}
})();
'''
js = js.replace("__CALLS__", J(CALLS)).replace("__SCALES__", J(SCALES)).replace("__Q__", J([{k: v for k, v in q.items()} for q in Q]))
open("/home/claude/work/calls/calls.js", "w").write(js)
from collections import Counter
print(len(Q), Counter(q["call"] for q in Q), Counter(q["scale"] for q in Q if q["scale"]))
