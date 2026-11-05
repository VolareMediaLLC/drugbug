const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:320,height:470},deviceScaleFactor:2});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+__dirname+'/page.html'); await pg.waitForTimeout(600);
const keys=['head','neck','chest','abdomen','pelvis','armL','legL','back','butt','fall'];
for (const k of keys) {
  // freeze the reaction at a chosen point in its hold
  const at = k==='fall'?0.4:k==='chest'?0.6:0.5;
  const r=await pg.evaluate(([k,at])=>{
    const S=D3GL._s, def=D3GL._RX[k];
    S.rx={def:def,key:k,start:0}; S.freeze=at;
    S.ang=k==='butt'||k==='back'?Math.PI:0;
    return new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      // freeze time for the measurement
      const R=S.rig, out={};
      if(def.ik){ for(const side of ['L','R']){ const sp=def.ik[side]; if(!sp) continue;
        const T=D3.xf(R.nodes[sp.n].world, sp.o.map((v,i)=>i===1&&sp.slide?(sp.slide[0]+sp.slide[1])/2:v));
        const P=R.palm(side); out[side]=+Math.hypot(T[0]-P[0],T[1]-P[1],T[2]-P[2]).toFixed(3);} }
      out.lowest=+Math.min(...R.meshes.map(m=>m.world[13])).toFixed(3);
      res(out);})));
  },[k,at]);
  await pg.evaluate(([k,at])=>{const S=D3GL._s;S.rx.start=performance.now()-S.rx.def.dur*1000*at;},[k,at]);
  await pg.waitForTimeout(40);
  await pg.screenshot({path:'p-'+k+'.png'});
  console.log(k.padEnd(8),'hand->target (m):',JSON.stringify(r));
  await pg.evaluate(()=>{D3GL._s.rx=null;D3GL._s.freeze=null;});
}
console.log('ERR',errs.slice(0,3));
await b.close();})();
