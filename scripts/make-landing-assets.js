#!/usr/bin/env node
/* Captures the real app (phone screens + BUGART_V2 bug portraits) into landing/ for the marketing homepage.
   Usage: node scripts/make-landing-assets.js   (Playwright + Chromium needed). Uses the same demo profile and mocked network as make-appstore-shots.js. */
"use strict";
const fs = require("fs"), path = require("path");
const { seedScript, MOCK, serve } = require("./make-appstore-shots.js");
let pw; try { pw = require("playwright"); } catch (e) { pw = require("/opt/node-tools/node_modules/playwright"); }
const OUT = path.resolve(__dirname, "..", "landing");
const BUGS = [["emperor-dragonfly", "Emperor Dragonfly"], ["free-mantis", "Praying Mantis"], ["golden-return-stag", "Golden Stag Beetle"], ["glow-firefly", "Glow Firefly"], ["sky-ace-wasp", "Sky Ace Wasp"], ["giant-hornet", "Giant Hornet"]];
const TABS = [["menu", "home", null], ["learn", "learn", null], ["practice", "practice", null], ["terr", "terrarium", null], ["stats", "ranks", null]];
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); const srv = await serve(); const base = "http://127.0.0.1:" + srv.address().port;
  const b = await pw.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await p.addInitScript(seedScript({ avatar: "emperor-dragonfly", wear: {}, owned: BUGS.map((x) => x[0]).concat(["pond-dragonfly", "orchid-mantis"]) })); await p.addInitScript(MOCK);
  await p.goto(base + "/index.html"); await p.waitForTimeout(4000);
  await p.addStyleTag({ content: "#vabar,#buddy,#gtwrap,.gtdim{display:none!important}*{animation:none!important;transition:none!important}" });
  for (const [t, name] of TABS) { await p.click('[data-hvgo="' + t + '"]'); await p.waitForTimeout(2200); await p.screenshot({ path: path.join(OUT, "app-" + name + ".jpg"), type: "jpeg", quality: 88 }); console.log("shot", name); }
  /* bug portraits: each bug drawn alone, large, on a transparent background */
  await p.click('[data-hvgo="terr"]'); await p.waitForTimeout(1500);
  await p.addStyleTag({ content: "html.cap,html.cap body{background:transparent!important}html.cap body>*:not(#capbug){visibility:hidden!important}#capbug{position:fixed;left:0;top:0;width:360px;height:360px;z-index:99999;visibility:visible!important}#capbug svg{width:360px;height:360px;overflow:visible}" });
  for (const [id] of BUGS) {
    const ok = await p.evaluate((bid) => {
      const src = document.querySelector('.bubble[data-b3id="' + bid + '"] .orb svg'); if (!src) return false;
      let d = document.getElementById("capbug"); if (!d) { d = document.createElement("div"); d.id = "capbug"; document.body.appendChild(d); }
      d.innerHTML = ""; const c = src.cloneNode(true); c.removeAttribute("style"); c.setAttribute("width", "360"); c.setAttribute("height", "360"); d.appendChild(c); document.documentElement.classList.add("cap"); return true;
    }, id);
    if (!ok) { console.log("missing", id); continue; }
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(OUT, "bug-" + id + ".png"), omitBackground: true, clip: { x: 0, y: 0, width: 360, height: 360 }, animations: "disabled" }); console.log("bug", id);
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
