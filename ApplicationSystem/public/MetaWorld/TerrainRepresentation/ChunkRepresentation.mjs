// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/ChunkRepresentation.mjs
// Prepares bounded replacement geometry offscreen and commits a terrain's loaded chunks atomically, retaining the generator, palette and old display until completion.
import {terrainRepresentation,prepareSteps} from './Representation.mjs';
import {cancelProgressive} from '../ProceduralVoxelWorld/ProgressiveChunks.mjs';
export function chunkRepresentation(definition,manager,build,release){
  let active=terrainRepresentation(definition.representation),revision=0,pending=false,disposed=false;
  return {
    get active(){return active;},get pending(){return pending;},
    cancel(){revision++;pending=false;},
    dispose(){disposed=true;revision++;pending=false;},
    async setRepresentation(value,beforeCommit=()=>{}){
      const next=terrainRepresentation(value),job=++revision;pending=false;
      if(disposed)return false;if(next===active)return true;
      pending=true;cancelProgressive(manager);const replacements=[];let bytes=0;
      const valid=()=>!disposed&&job===revision;
      try{
        for(const old of manager.loaded.values()){
          const entry=await prepareSteps(build(old.cell,next,true),valid);if(!entry)return false;
          replacements.push({cell:old.cell,entry});bytes+=entry.residentBytes;
          if(bytes>128*1024**2)throw Error('Replacement terrain exceeds the 128 MiB geometry budget. Reduce viewing distance.');
        }
        if(!valid())return false;
        beforeCommit();
        for(const {cell,entry} of replacements){if(entry.mesh)entry.mesh.visible=true;manager.storeEntry(cell,entry);}
        replacements.length=0;active=next;definition.representation=next;manager.center='';manager.queue.length=0;return true;
      }finally{for(const {entry} of replacements)release(entry);if(job===revision)pending=false;}
    }
  };
}
