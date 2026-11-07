// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/PredictiveColumns.mjs
// This planner extends the existing chunk queue along a bounded movement corridor while retaining useful in-flight work. Immediate neighboring columns take precedence over speculative detail.
import { cancelProgressive } from '../ProceduralVoxelWorld/ProgressiveChunks.mjs';
export function planColumns(m, cx, cz) {
  const now = performance.now(), previous = m.motion;
  let vx = previous?.vx || 0, vz = previous?.vz || 0;
  if (previous && (cx!==previous.x||cz!==previous.z) && now > previous.time) {
    const dt = Math.max(.05, (now - previous.time) / 1000);
    vx = Math.max(-4, Math.min(4, (cx - previous.x) / dt));
    vz = Math.max(-4, Math.min(4, (cz - previous.z) / dt));
  }
  m.motion = { x: cx, z: cz, time: previous&&cx===previous.x&&cz===previous.z?previous.time:now, vx, vz };
  const lead = m.predictive ? [Math.round(vx), Math.round(vz)] : [0, 0];
  const wanted = new Map(), width = Math.ceil(m.generator.dimensions[0] / 32), depth = Math.ceil(m.generator.dimensions[2] / 32);
  const add = (x,z) => { if(x>=0&&z>=0&&x<width&&z<depth)wanted.set(`${x},${z}`,[x,null,z]); };
  for(let z=cz-m.radius;z<=cz+m.radius;z++)for(let x=cx-m.radius;x<=cx+m.radius;x++)add(x,z);
  for(let t=1;t<=4;t++)for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++)add(cx+Math.round(lead[0]*t/4)+x,cz+Math.round(lead[1]*t/4)+z);
  for(const [x,z] of m.refinementColumns || [])add(x,z);
  const pending=m.pending?.cell;
  if(pending&&!wanted.has(`${pending[0]},${pending[2]}`))cancelProgressive(m);
  // A small retention margin avoids disposal/recreation when crossing a boundary repeatedly.
  for(const [key,e] of m.loaded)if(!wanted.has(`${e.cell[0]},${e.cell[2]}`)&&Math.max(Math.abs(e.cell[0]-cx),Math.abs(e.cell[2]-cz))>m.radius+3){m.stats.evicted++;m.releaseEntry(key);}
  const score=c=>{const dx=c[0]-cx,dz=c[2]-cz,d=dx*dx+dz*dz;return d<=2?-100+d:d-.8*(dx*lead[0]+dz*lead[1]);};
  m.queue=[...wanted.values()].sort((a,b)=>score(a)-score(b));
  m.stats.prefetchColumns=[...wanted.values()].filter(c=>Math.max(Math.abs(c[0]-cx),Math.abs(c[2]-cz))>m.radius).length;
  m.stats.predictedCenter=[cx+lead[0],cz+lead[1]];
  m.center=`${cx},${cz}`;
  // Keep the level registry bounded with the same retention policy as resident detail.
  for(const key of m.columnLevels.keys())if(!wanted.has(key)){const [x,z]=key.split(',').map(Number);if(Math.max(Math.abs(x-cx),Math.abs(z-cz))>m.radius+3)m.columnLevels.delete(key);}
}
