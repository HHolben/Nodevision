// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/CachedChunkBuilder.mjs
// This cooperative builder reuses completed polygonal CPU buffers while leaving GPU installation and scene ownership with the existing chunk manager. Cache stamps prevent work started before an edit from publishing stale buffers.
import {surfaceNetSteps} from './SurfaceNets.mjs';
import {naturalGroundNormals} from './GroundNormals.mjs';
import {meshVoxelChunkSteps} from '../ProceduralVoxelWorld/VoxelChunkMesher.mjs';
import {timedSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
export function cachedChunkBuilder(generator,cache,finish,getMode,getStyle=()=> 'standard') {
 return function* build(cell,mode=getMode(),hidden=false,cached=null,style=getStyle()) {
  const stamp=cache.revision,key=style==='standard'?mode:mode+':'+style,reused=mode==='polygonal'?cache.get(cell,key):null;
  if(reused)return {...finish(cell,reused.result,0,0,hidden),data:reused.data,residentBytes:reused.bytes};
  const generated=cached?{value:cached,cpuMs:0}:yield* timedSteps(generator.generateChunkSteps(...cell));
  const meshed=yield* timedSteps(mode==='polygonal'?surfaceNetSteps(generated.value,cell,generator.getRenderVoxel,style==='smooth-natural'?naturalGroundNormals(generator,cell):null):meshVoxelChunkSteps(generated.value,cell,generator.getRenderVoxel));
  if(mode==='polygonal')cache.put(cell,key,generated.value,meshed.value,stamp);
  const entry=finish(cell,meshed.value,generated.cpuMs,meshed.cpuMs,hidden);
  return {...entry,data:generated.value,residentBytes:entry.residentBytes+generated.value.byteLength};
 };
}
