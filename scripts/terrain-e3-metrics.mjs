// Nodevision/scripts/terrain-e3-metrics.mjs
// Measure natural top-surface height/normal errors and duplicate boundary samples without confusing underside, excavation, liquid or feature surfaces with ordinary ground.
export function surfaceMetrics(entries,fixture){
 const heights=[],angles=[],jumps=[],directions=new Set(),shared=new Map();let vertices=0,triangles=0,bytes=0,seamPairs=0,seamNormalMax=0;
 for(const {geometry:g,offset=[0,0,0]} of entries){
  vertices+=g.attributes.position.count;triangles+=g.index.count/3;bytes+=Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+g.index.array.byteLength;
  const valid=new Set();
  for(let i=0;i<g.attributes.position.count;i++){
   const p=[0,1,2].map(a=>g.attributes.position.array[i*3+a]+offset[a]),n=Array.from(g.attributes.normal.array.slice(i*3,i*3+3)),h=fixture.analytic(p[0],p[2]);
   if(p[0]<3||p[0]>29||p[2]<3||p[2]>29||n[1]<.5||Math.abs(p[1]-h)>.4)continue;
   valid.add(i);heights.push(p[1]-h);directions.add(n.map(v=>v.toFixed(5)).join(','));
   const dx=fixture.name==='steep'?.65:.16,dz=.07+.25/9*Math.cos(p[2]/9),length=Math.hypot(dx,1,dz),dot=(-dx*n[0]+n[1]-dz*n[2])/length;
   angles.push(Math.acos(Math.min(1,Math.max(-1,dot)))*180/Math.PI);
   const key=p.map(v=>v.toFixed(5)).join(','),before=shared.get(key);if(before){seamPairs++;seamNormalMax=Math.max(seamNormalMax,...n.map((v,a)=>Math.abs(v-before[a])));}else shared.set(key,n);
  }
  const edges=new Set();for(let i=0;i<g.index.count;i+=3)for(const [a,b] of [[0,1],[1,2],[2,0]]){
   const x=g.index.array[i+a],y=g.index.array[i+b],key=Math.min(x,y)+','+Math.max(x,y);if(!valid.has(x)||!valid.has(y)||edges.has(key))continue;edges.add(key);
   const n=g.attributes.normal.array;let dot=0;for(let k=0;k<3;k++)dot+=n[x*3+k]*n[y*3+k];jumps.push(Math.acos(Math.min(1,Math.max(-1,dot)))*180/Math.PI);
  }
 }
 const mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
 return {vertices,triangles,bufferBytes:bytes,naturalTopSamples:heights.length,uniqueTopNormals:directions.size,heightMeanErrorM:mean(heights),heightRmseM:mean(heights.map(v=>v*v))**.5,normalMeanErrorDegrees:mean(angles),edgeNormalMeanJumpDegrees:mean(jumps),seamPairs,seamNormalMaxComponentDifference:seamNormalMax};
}
