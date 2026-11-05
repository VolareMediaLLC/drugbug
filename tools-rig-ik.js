const D=r=>r*180/Math.PI;
const RIG={shoulder:{L:[46,78],R:[114,78]},upper:50,fore:53,hip:{L:[67,206],R:[93,206]},thigh:44,shin:45,
  rest:{armL:8,armR:-8,legL:2,legR:-2}};
function ik(P,T,L1,L2,side){
  let dx=T[0]-P[0],dy=T[1]-P[1],d=Math.hypot(dx,dy);
  d=Math.max(Math.abs(L1-L2)+.01,Math.min(L1+L2-.01,d));
  const dir=Math.atan2(-dx,dy);
  const a=Math.acos(Math.max(-1,Math.min(1,(L1*L1+d*d-L2*L2)/(2*L1*d))));
  const phi=dir+side*a;
  const j=[P[0]-Math.sin(phi)*L1,P[1]+Math.cos(phi)*L1];
  const psi=Math.atan2(-(T[0]-j[0]),T[1]-j[1]);
  let rel=D(psi)-D(phi); while(rel>180)rel-=360; while(rel<-180)rel+=360;
  return {u:D(phi),l:rel,j:j.map(v=>+v.toFixed(1))};
}
function solve(kind,side,T,jointBox){
  const P = kind==='arm'?RIG.shoulder[side]:RIG.hip[side];
  const L1 = kind==='arm'?RIG.upper:RIG.thigh, L2 = kind==='arm'?RIG.fore:RIG.shin;
  const rest = RIG.rest[kind+side];
  let best=null;
  for (const s of [1,-1]) {
    const r=ik(P,T,L1,L2,s);
    // score: how far the joint sits outside the box we want it in
    const [x0,y0,x1,y1]=jointBox;
    const pen=Math.max(0,x0-r.j[0])+Math.max(0,r.j[0]-x1)+Math.max(0,y0-r.j[1])+Math.max(0,r.j[1]-y1);
    let u=r.u-rest; while(u>180)u-=360; while(u<-180)u+=360;
    const cand={u:Math.round(u),l:Math.round(r.l),j:r.j,pen:+pen.toFixed(1)};
    if(!best||cand.pen<best.pen) best=cand;
  }
  return best;
}
const rows=[];
const add=(n,o)=>rows.push([n,o]);
// hands on the head, elbows flared but still on screen
add('head  armL',solve('arm','L',[62,30],[6,34,40,82]));
add('head  armR',solve('arm','R',[98,30],[120,34,154,82]));
// one hand guarding the throat, elbow down in front
add('throat armL',solve('arm','L',[74,60],[70,96,100,124]));
// both hands clutching the chest, elbows out at waist height
add('chest armL',solve('arm','L',[72,112],[14,104,40,134]));
add('chest armR',solve('arm','R',[88,112],[120,104,146,134]));
// hugging the belly
add('belly armL',solve('arm','L',[71,158],[22,112,42,138]));
add('belly armR',solve('arm','R',[89,158],[118,112,138,138]));
// hands down in front of the groin
add('groin armL',solve('arm','L',[72,196],[46,110,66,136]));
add('groin armR',solve('arm','R',[88,196],[94,110,114,136]));
// the free hand crosses to rub the other upper arm
add('rub  armR->L',solve('arm','R',[52,120],[96,112,120,140]));
add('rub  armL->R',solve('arm','L',[108,120],[40,112,64,140]));
// hand down to hold the lifted shin
add('hold armL',solve('arm','L',[62,190],[44,112,62,140]));
add('hold armR',solve('arm','R',[98,190],[98,112,116,140]));
// knee up and forward, foot tucked back and in
add('lift legL',solve('leg','L',[76,246],[44,226,70,252]));
add('lift legR',solve('leg','R',[84,246],[90,226,116,252]));
rows.forEach(([n,o])=>console.log('  '+n.padEnd(14)+'rotate('+String(o.u).padStart(5)+'deg)  lower rotate('+String(o.l).padStart(5)+'deg)   joint '+JSON.stringify(o.j)+(o.pen?'   OUTSIDE by '+o.pen:'')));
