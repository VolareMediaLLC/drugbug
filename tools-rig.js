/* Pose the rig by naming where each joint should END UP, then solve the rotation AND the
   foreshortening scale for each segment. A flat front view cannot show a limb pointing at the
   viewer, so an elbow that should come forward instead flew off the side of the canvas. Scaling
   the segment down fakes that foreshortening and keeps the pose compact and readable. */
const D=r=>r*180/Math.PI;
const RIG={
  shoulder:{L:[46,78],R:[114,78]}, upper:50, fore:53,
  hip:{L:[67,206],R:[93,206]},     thigh:44, shin:45,
  rest:{armL:8,armR:-8,legL:2,legR:-2}
};
function seg(P,Q,L){              // natural length L -> rotation + scale
  const dx=Q[0]-P[0], dy=Q[1]-P[1], d=Math.hypot(dx,dy);
  const th=D(Math.atan2(-dx,dy));
  return {th, s:d/L, d};
}
function chain(kind,side,joint,end){
  const P = kind==='arm'?RIG.shoulder[side]:RIG.hip[side];
  const L1= kind==='arm'?RIG.upper:RIG.thigh, L2= kind==='arm'?RIG.fore:RIG.shin;
  const a=seg(P,joint,L1), b=seg(joint,end,L2);
  const rest=RIG.rest[kind+side];
  let u=a.th-rest;  while(u>180)u-=360; while(u<-180)u+=360;
  let l=b.th-a.th;  while(l>180)l-=360; while(l<-180)l+=360;
  const warn=[]; if(a.s>1.02)warn.push('upper stretched '+a.s.toFixed(2)); if(b.s>1.02)warn.push('lower stretched '+b.s.toFixed(2));
  return {u:Math.round(u), us:+a.s.toFixed(2), l:Math.round(l), ls:+b.s.toFixed(2), warn};
}
function css(name,o){
  const t1='rotate('+o.u+'deg)'+(Math.abs(o.us-1)>.03?' scaleY('+o.us+')':'');
  const t2='rotate('+o.l+'deg)'+(Math.abs(o.ls-1)>.03?' scaleY('+o.ls+')':'');
  console.log('  '+name.padEnd(16)+t1.padEnd(32)+t2.padEnd(32)+(o.warn.length?'  !! '+o.warn.join(', '):''));
}
const P=(label,list)=>{console.log('\n'+label);list.forEach(([n,k,s,j,e])=>css(n,chain(k,s,j,e)));};

P('HEAD - hands onto the head, elbows out and foreshortened',[
  ['armL','arm','L',[26,46],[62,30]], ['armR','arm','R',[134,46],[98,30]]]);
P('THROAT - left hand guards the throat, elbow tucked at the side',[
  ['armL','arm','L',[40,104],[72,62]]]);
P('CHEST - kneeling, both hands clutching the chest',[
  ['armL','arm','L',[24,116],[70,110]], ['armR','arm','R',[136,116],[90,110]]]);
P('BELLY - hugging it',[
  ['armL','arm','L',[28,126],[72,158]], ['armR','arm','R',[132,126],[88,158]]]);
P('GROIN - hands down in front',[
  ['armL','arm','L',[40,126],[64,172]], ['armR','arm','R',[120,126],[96,172]]]);
P('ARM RUB - the free hand crosses to the sore arm',[
  ['armR','arm','R',[100,126],[50,118]], ['armL','arm','L',[60,126],[110,118]]]);
P('LEG - the sore leg lifts, the hand comes down to it',[
  ['legR','leg','R',[104,236],[94,260]], ['armR','arm','R',[120,124],[100,182]],
  ['legL','leg','L',[56,236],[66,260]],  ['armL','arm','L',[40,124],[60,182]]]);
P('KNEEL - thighs fold, shins tuck back out of sight',[
  ['legL','leg','L',[62,238],[70,216]], ['legR','leg','R',[98,238],[90,216]]]);
