// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProgressiveChunks.mjs
// This scheduler advances existing chunk operations under a soft frame-time budget, cancels stale teleport work, and caps resident geographic mesh memory independently of world extent.
import { chunkKey } from './VoxelCoordinates.mjs';
export function advanceProgressive(manager) {
  const m=manager,start=performance.now(),deadline=start+m.options.budgetMs;
  function* task(cell){
    if(cell[1]!==null)return yield* m.build(cell);
    const [x,,z]=cell,levels=yield* m.generator.getChunkLevelsSteps(x,z);
    const dirty=[...m.loaded.values()].filter(e=>e.cell[0]===x&&e.cell[2]===z&&m.invalidated.has(chunkKey(e.cell))).map(e=>e.cell[1]);
    const cells=[...new Set([...levels,...dirty])].sort((a,b)=>b-a).map(y=>[x,y,z]).filter(c=>!m.loaded.has(chunkKey(c))||m.invalidated.has(chunkKey(c)));
    m.queue.unshift(...cells);return null;
  }
  while(performance.now()<deadline){
    if(!m.pending){const cell=m.queue.shift();if(!cell)break;m.pending={cell,iterator:task(cell)};}
    const result=m.pending.iterator.next();if(!result.done)continue;
    const {cell}=m.pending;m.pending=null;
    if(result.value){m.storeEntry(cell,result.value);break;}
  }
  while(m.loaded.size>m.options.maxChunks||m.stats.residentBytes>m.options.maxBytes){
    const [cx,cz]=m.center.split(',').map(Number);let worst=null,distance=-1;
    for(const [key,e] of m.loaded){const d=(e.cell[0]-cx)**2+(e.cell[2]-cz)**2;if(d>distance){distance=d;worst=key;}}
    m.releaseEntry(worst);
  }
  m.stats.loaded=m.loaded.size;m.stats.queued=m.queue.length+(m.pending?1:0);
  m.stats.peakLoaded=Math.max(m.stats.peakLoaded,m.loaded.size);
  m.stats.maxUpdateMs=Math.max(m.stats.maxUpdateMs,performance.now()-start);
}
export function cancelProgressive(manager){if(manager.pending){manager.pending.iterator.return?.();manager.pending=null;manager.stats.cancelled++;}}
