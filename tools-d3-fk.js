// load the engine core in node and check the skeleton
const fs=require('fs'); const src=fs.readFileSync(__dirname+'/d3.js','utf8');
const code=src.slice(src.indexOf('/* D3:BEGIN */'),src.indexOf('/* D3:END */'));
const D3=new Function(code+'\nreturn D3;')();
module.exports=D3;
if (require.main===module){
  const R=new D3.Rig(); R.pose({});
  const f=v=>v.map(x=>+x.toFixed(3));
  console.log('meshes',R.meshes.length,'nodes',R.list.length);
  for (const n of ['hips','chest','neck','head','shL','elL','wrL','hipL','knL','anL'])
    console.log('  '+n.padEnd(5),JSON.stringify(f(R.at(n))));
  console.log('  palmL',JSON.stringify(f(R.palm('L'))),' palmR',JSON.stringify(f(R.palm('R'))));
  console.log('  top of head',JSON.stringify(f(R.at('head',[0,0.262,0]))));
}
