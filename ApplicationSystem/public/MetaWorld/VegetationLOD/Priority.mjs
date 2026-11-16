// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Priority.mjs
// Reorder existing bounded detailed work toward nearby incomplete trees and the motion corridor. This does not add columns, enlarge residency or interrupt collision work already in progress.
export function prioritizeVegetation(manager,ownership,point,previous){
 if(!manager.queue?.length)return;
 const dx=previous?point[0]-previous[0]:0,dz=previous?point[1]-previous[1]:0,records=[...ownership.records()].filter(r=>r.proxy&&!r.ready);
 const distance=r=>Math.hypot(r.feature.origin[0]*.25-point[0],r.feature.origin[2]*.25-point[1]);
 records.sort((a,b)=>distance(a)-distance(b));const urgent=new Set();
 for(const r of records.slice(0,4))if(distance(r)<32)for(const key of r.chunks)urgent.add(key);
 const columns=new Set([...urgent].map(k=>{const [x,,z]=k.split(',');return `${x},${z}`;}));
 const score=cell=>{
  const x=cell[0]*8+4-point[0],z=cell[2]*8+4-point[1],d=Math.hypot(x,z),ahead=(x*dx+z*dz)>0;
  const priority=cell[1]===null?columns.has(`${cell[0]},${cell[2]}`):urgent.has(cell.join(','));
  return d-(priority?12:0)-(ahead?4:0);
 };
 const scores=new Map(manager.queue.map(c=>[c,score(c)]));manager.queue.sort((a,b)=>scores.get(a)-scores.get(b));
}
