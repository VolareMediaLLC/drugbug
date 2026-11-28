#!/usr/bin/env node
/* App Store screenshot pack for DrugBug.
   Usage: node scripts/make-appstore-shots.js [outDir]        (default: appstore-screenshots/)
   Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium).

   It serves app/ on a local port, drives the REAL app in headless Chromium at 430x932 (3x) with a seeded demo profile, and
   frames each screen in an iPhone bezel under a Night Shift Gold marketing header. Output, per slide:
     iphone-6.7in-1290x2796/NN-name.png     iPhone 6.7" (Pro Max / Plus class)
     iphone-6.5in-1242x2688/NN-name.png     iPhone 6.5" (XS Max / 11 Pro Max class)
   plus contact-sheet.png for a quick look. The network is mocked (leaderboard, account), so nothing real is read or written. */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
let pw; try { pw = require("playwright"); } catch (e) { pw = require("/opt/node-tools/node_modules/playwright"); }
const { chromium } = pw;
const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "appstore-screenshots"));
const APP = path.join(ROOT, "app");
const SIZES = [{ dir: "iphone-6.7in-1290x2796", w: 1290, h: 2796 }, { dir: "iphone-6.5in-1242x2688", w: 1242, h: 2688 }];

/* ---------- the six slides, most eye-catching first ---------- */
const SLIDES = [
  { id: "01-hero", head: "Pharmacology That <em>Actually Sticks</em>", sub: "2,000+ plain-language & clinical med cards for EMS, Nursing, Med & Pharmacy.", seed: { avatar: "emperor-dragonfly", wear: { hat: "beanie" } }, go: [["tab", "menu"]] },
  { id: "02-bug-rush", head: "Beat the Clock in <em>Bug Rush</em>", sub: "Real-time cardiac rhythms, high-acuity calls & NREMT/NCLEX-grade questions.", seed: { avatar: "emperor-dragonfly", wear: {} }, go: [["tab", "practice"], ["text", "^Bug Rush"], ["rushgo"]] },
  { id: "03-med-cards", head: "Plain English First. <em>Deep Science</em> When You Need It.", sub: "Switch between Professor Sage summaries, dosing, 3D molecules & The Wormhole.", seed: { avatar: "emperor-dragonfly", wear: {} }, go: [["tab", "learn"], ["text", "^BugDex"], ["text", "^All Medications"], ["drug", "Epinephrine"]] },
  { id: "04-terrarium", head: "Collect, Evolve & <em>Dress Your Bug</em>", sub: "Earn sticks as you study to unlock rare bugs and 140+ outfits in your Terrarium.", seed: { avatar: "sky-ace-wasp", wear: { outfit: "labcoat", neck: "stetho2", held: "coffee" }, owned: ["pond-dragonfly", "emperor-dragonfly", "free-mantis", "orchid-mantis", "sky-ace-wasp", "golden-return-stag", "glow-firefly"] }, go: [["tab", "terr"]] },
  { id: "05-hive", head: "Explore Meds by <em>System & 3D Anatomy</em>", sub: "Interactive 3D anatomy and honeycomb system maps built for fast recall.", seed: { avatar: "emperor-dragonfly", wear: {} }, go: [["tab", "learn"], ["text", "^The Hive"]] },
  { id: "06-ranks", head: "Compete With Your Crew & <em>Nationwide</em>", sub: "Weekly podium prizes for Top Players, Agencies, and Squads.", seed: { avatar: "emperor-dragonfly", wear: { hat: "beanie" } }, go: [["tab", "stats"]] }
];

/* ---------- a demo profile + a mocked network, so the app looks lived-in and nothing real is touched ---------- */
function seedScript(s) {
  return `(()=>{window.__DRUGBUG_SKIP_DISC=true;
  try{new MutationObserver(()=>{document.querySelectorAll('#otanews,#accdlg,#secwin,.secwin,#hvintro,#sbdlg,#evodlg,#gtwrap,.gtdim,#vabar').forEach(x=>x.remove())}).observe(document,{childList:true,subtree:true})}catch(e){}
  if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');
  const set=(k,v)=>localStorage.setItem('drugbug:'+k,JSON.stringify(v));const d=new Date();const day=(o)=>{const x=new Date(d.getTime()-o*864e5);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
  set('agree',{v:'2026-11-20',age:'adult',ts:Date.now()});set('welcome',1);set('tourV',999);set('sbIntro',1);set('hive',1);set('theme','dark');set('lastLevel','paramedic');set('viewAs','pro');
  set('hvIntro',{rush:1,learn:1,practice:1,terr:1,stats:1,menu:1,home:1,scoreboard:1,hive:1,qs:1,anatomy:1,drugs:1});
  const drugs={};['epinephrine','amiodarone','atropine','adenosine','naloxone','fentanyl','morphine','ketamine','midazolam','nitroglycerin','aspirin','albuterol','ondansetron','dextrose','diphenhydramine','lidocaine','calcium-chloride','sodium-bicarbonate'].forEach((id,i)=>{drugs[id]={n:10,b:i<9?6:3,h:i<9?'1111111111':'1101110111',t:Date.now()}});
  const days={};for(let i=0;i<12;i++)days[day(i)]=1;
  const S=${JSON.stringify(s)};
  set('progress',{earned:9000,spent:4200,owned:S.owned||['emperor-dragonfly','free-mantis','orchid-mantis','sky-ace-wasp','golden-return-stag','glow-firefly','pond-dragonfly','giant-hornet','tarantula-hawk'],avatar:S.avatar,avatarTs:Date.now(),items:['labcoat','stetho2','coffee','beanie'],drugs,calc:{},qcat:{},xp:4200,days,streak:12,best:12,lastDaily:day(0),dailyCount:1,ach:{},answered:140,chal:{},role:'paramedic',startLevel:'paramedic',wear:S.wear||{}});
  const ME=${JSON.stringify("")};})()`;
}
const MOCK = `(()=>{
const av=(b,w)=>({b,s:5,w:w||{},f:''});
const players=[['Medic_Maya','Harris Co EMS','TX',9420,98,'emperor-dragonfly',{hat:'beanie'}],['NightRN_Dev','St. Luke’s ICU','MO',8810,96,'orchid-mantis',{}],['FlightDoc','AirCare 3','CO',8120,95,'sky-ace-wasp',{}],['PharmD_Kay','UCSF Pharmacy','CA',7400,94,'golden-return-stag',{}],['TheLVN','Mercy North','OH',6900,92,'glow-firefly',{}],['Ricky_EMT','Metro Fire','AZ',6120,91,'giant-hornet',{}],['StepOneSam','Rush Med','IL',5800,90,'free-mantis',{}]].map((r,i)=>({rank:i+1,nick:r[0],agency:r[1],state:r[2],pts:r[3],acc:r[4],av:av(r[5],r[6]),me:false}));
const rows=[['Harris County EMS','Houston','TX','emperor-dragonfly'],['AirCare 3 Flight','Denver','CO','sky-ace-wasp'],['Metro Fire & Rescue','Phoenix','AZ','giant-hornet'],['St. Luke’s ICU','Kansas City','MO','orchid-mantis'],['Mercy North','Toledo','OH','glow-firefly'],['Rush Med','Chicago','IL','free-mantis']].map((r,i)=>({id:'a'+i,rank:i+1,name:r[0],city:r[1],state:r[2],top3:[28400,26100,24800,22300,20100,18800][i],filled:3,mine:false,av:av(r[3])}));
const tier={ok:true,tier:'national',wk:'2026-11-23',players,rows,you:null,tiers:{national:{prizes:[]},stateOn:false},rewardsLive:null};
window.claude={use:function(n){
  if(n==='user')return Promise.resolve({canEdit:()=>Promise.resolve(true),id:()=>Promise.resolve('demo'),isOwner:()=>Promise.resolve(true)});
  if(n==='account')return Promise.resolve(new Proxy({state:()=>({signedIn:true,user:{name:'Medic_Maya'}}),token:()=>Promise.resolve('mock'),onChange:()=>{}},{get:(t,k)=>k in t?t[k]:k==='then'?undefined:function(){return Promise.resolve(null)}}));
  return Promise.resolve(null)}};
const of=window.fetch;window.fetch=function(u,o){const s=String(u);const m=s.match(/cloudfunctions\\.net\\/(\\w+)/);if(m){const n=m[1];const body=n==='agencyTier'?tier:n==='agencyBoard'?{ok:true,member:false,wk:'2026-11-23',rewards:[],rewardsLive:null}:{ok:true};return Promise.resolve(new Response(JSON.stringify({result:body}),{status:200,headers:{'Content-Type':'application/json'}}));}
  if(/googleapis|gstatic|endorsely|firebase/.test(s))return Promise.reject(new Error('blocked'));return of.apply(this,arguments)};
})();`;

function serve() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".woff2": "font/woff2" };
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
      const f = path.join(APP, p); if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
    }).listen(0, "127.0.0.1", () => res(srv));
  });
}

async function capture(browser, base, slide) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await p.addInitScript(seedScript(slide.seed)); await p.addInitScript(MOCK);
  await p.goto(base + "/index.html"); await p.waitForTimeout(3800);
  const clickText = (re) => p.evaluate((r) => { const e = [...document.querySelectorAll("button,a")].find((x) => new RegExp(r, "i").test(x.textContent)); if (!e) throw new Error("no button " + r); e.click(); }, re);
  for (const st of slide.go) {
    if (st[0] === "tab") await p.click('[data-hvgo="' + st[1] + '"]');
    else if (st[0] === "text") await clickText(st[1]);
    else if (st[0] === "drug") await p.evaluate((n) => { const e = [...document.querySelectorAll("button,a,li,div")].find((x) => new RegExp("^" + n, "i").test((x.textContent || "").trim()) && x.children.length < 6); if (e) e.click(); }, st[1]);
    else if (st[0] === "rushgo") {
      await p.waitForTimeout(800);
      await p.evaluate(() => { const c = document.querySelector("input[type=checkbox]"); if (c) c.click(); }); await p.waitForTimeout(400);
      await clickText("Continue to the simulation").catch(() => {}); await p.waitForTimeout(2200);
      await p.evaluate(() => { const e = [...document.querySelectorAll("button")].find((x) => /ready|begin|start the call|dispatch/i.test(x.textContent) && x.getBoundingClientRect().height > 30); if (e) e.click(); }); await p.waitForTimeout(2500);
      await p.evaluate(() => { const e = [...document.querySelectorAll("button")].find((x) => /show vitals|choices/i.test(x.textContent)); if (e) e.click(); }); await p.waitForTimeout(3500);
    }
    await p.waitForTimeout(1700);
  }
  await p.addStyleTag({ content: "#vabar,#gtwrap,.gtdim,#buddy{display:none!important}" });
  await p.waitForTimeout(500);
  const buf = await p.screenshot(); await ctx.close();
  return { buf, errs };
}

function frameHtml(slide, shot) {
  return `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html,body{width:430px;height:932px;overflow:hidden}
body{font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;color:#F1F5F9;position:relative;
background:radial-gradient(120% 60% at 50% 0%,rgba(59,108,246,.55),rgba(91,75,219,.25) 45%,transparent 70%),radial-gradient(90% 40% at 0% 100%,rgba(14,165,164,.35),transparent 60%),linear-gradient(180deg,#0E1630 0%,#0A0F1E 60%,#0A0F1E 100%)}
.hd{position:absolute;left:0;right:0;top:0;padding:52px 28px 0;text-align:center}
h1{font-size:38px;line-height:1.04;font-weight:850;letter-spacing:-.8px;text-wrap:balance}
h1 em{font-style:normal;color:#F59E0B}
p{margin-top:12px;font-size:16.5px;line-height:1.32;font-weight:560;color:#CBD5E1;padding:0 8px;text-wrap:balance}
.ph{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);width:326px;height:694px;border-radius:50px;padding:8px;background:linear-gradient(145deg,#2b3350,#0b0f1d 40%,#1c2340);box-shadow:0 0 0 1.5px #3a4468 inset,0 30px 70px rgba(0,0,0,.6),0 0 90px rgba(59,108,246,.35)}
.sc{position:relative;width:100%;height:100%;border-radius:42px;overflow:hidden;background:#0A0F1E}
.sc img{width:100%;height:100%;display:block;object-fit:cover}
.isl{position:absolute;top:9px;left:50%;transform:translateX(-50%);width:84px;height:24px;border-radius:14px;background:#000}
.tag{position:absolute;left:0;right:0;top:12px;text-align:center;font-size:11px;font-weight:800;letter-spacing:.2em;color:#F59E0B;text-transform:uppercase}
</style><div class="tag">DrugBug</div><div class="hd"><h1>${slide.head}</h1><p>${slide.sub.replace(/&/g, "&amp;")}</p></div>
<div class="ph"><div class="sc"><img src="data:image/png;base64,${shot.toString("base64")}"><div class="isl"></div></div></div>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true }); const srv = await serve(); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(); const shots = [];
  for (const s of SLIDES) { const r = await capture(browser, base, s); shots.push(r.buf); console.log("captured", s.id, r.errs.length ? "page errors: " + r.errs.slice(0, 2).join(" | ") : "ok"); }
  const sheet = [];
  for (const sz of SIZES) {
    const dir = path.join(OUT, sz.dir); fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: sz.w / 3, height: sz.h / 3 }, deviceScaleFactor: 3 });
    const p = await ctx.newPage();
    for (let i = 0; i < SLIDES.length; i++) {
      await p.setContent(frameHtml(SLIDES[i], shots[i])); if (sz.w !== 1290) await p.addStyleTag({ content: "html{zoom:" + (sz.w / 3 / 430).toFixed(5) + "}" });
      await p.waitForTimeout(250);
      const f = path.join(dir, SLIDES[i].id + ".png"); await p.screenshot({ path: f }); if (sz.w === 1290) sheet.push(f);
    }
    await ctx.close();
  }
  /* contact sheet of the 6.7" set */
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 600 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  await p.setContent('<body style="margin:0;background:#05070f;display:grid;grid-template-columns:repeat(6,1fr);gap:14px;padding:18px;font-family:sans-serif;color:#9AA6C6">' + sheet.map((f, i) => '<figure style="margin:0"><img style="width:100%;border-radius:14px" src="data:image/png;base64,' + fs.readFileSync(f).toString("base64") + '"><figcaption style="text-align:center;padding-top:8px;font-size:13px">' + SLIDES[i].id + "</figcaption></figure>").join("") + "</body>");
  await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, "contact-sheet.png"), fullPage: true });
  await browser.close(); srv.close(); console.log("done ->", OUT);
}
module.exports = { seedScript, MOCK, serve, APP };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
