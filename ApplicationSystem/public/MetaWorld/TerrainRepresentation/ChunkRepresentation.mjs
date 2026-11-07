// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/ChunkRepresentation.mjs
// Prepares bounded replacement geometry offscreen and commits a terrain's loaded chunks atomically, retaining the generator, palette and old display until completion.
import {terrainRepresentation,prepareSteps} from './Representation.mjs';
import {cancelProgressive} from '../ProceduralVoxelWorld/ProgressiveChunks.mjs';
export function chunkRepresentation(definition,manager,build,release){
  let active=terrainRepresentation(definition.representation),revision=0,pending=false,disposed=false,completed=0,total=0;
  return {
    get progress(){return {pending,completed,total};},get active(){return active;},get pending(){return pending;},
    cancel(){revision++;pending=false;},
    dispose(){disposed=true;revision++;pending=false;},
    async setRepresentation(value,beforeCommit=()=>{}){
      const next=terrainRepresentation(value),job=++revision;pending=false;
      if(disposed)return false;if(next===active)return true;
      const started=performance.now();pending=true;completed=0;total=manager.loaded.size;cancelProgressive(manager);const replacements=[];let bytes=0;
      const valid=()=>!disposed&&job===revision;
      try{
        for(const old of manager.loaded.values()){
          const entry=await prepareSteps(build(old.cell,next,true,manager.invalidated.has(old.cell.join(','))?null:old.data),valid);if(!entry)return false;
          if(old.data&&!manager.invalidated.has(old.cell.join(',')))manager.stats.occupancyReuseHits=(manager.stats.occupancyReuseHits||0)+1;completed++;replacements.push({cell:old.cell,entry});bytes+=entry.residentBytes;
          if(bytes>128*1024**2)throw Error('Replacement terrain exceeds the 128 MiB geometry budget. Reduce viewing distance.');
        }
        if(!valid())return false;
        beforeCommit();
        for(const {cell,entry} of replacements){if(entry.mesh)entry.mesh.visible=true;manager.storeEntry(cell,entry);}
        replacements.length=0;active=next;definition.representation=next;manager.center='';manager.queue.length=0;return true;
      }finally{for(const {entry} of replacements)release(entry);if(job===revision){pending=false;manager.stats.switchMs=performance.now()-started;}}
    }
  };
}
