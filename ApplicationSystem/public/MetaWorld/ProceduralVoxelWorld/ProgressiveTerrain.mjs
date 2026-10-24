// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs
// This module exposes cooperative iterations of the existing terrain and feature composition operations so geographic streaming can yield between bounded work units.
import { chunkToVoxel,voxelIndex } from './VoxelCoordinates.mjs';
import { featureMaterialPriority as priority } from './VoxelMaterialIds.mjs';
export const drainSteps=iterator=>{let next;do{next=iterator.next();}while(!next.done);return next.value;};
export function* terrainChunkSteps(base,features,cx,cy,cz) {
  const min=chunkToVoxel([cx,cy,cz]),max=min.map(v=>v+32),data=new Uint8Array(32**3);
  for(let z=0;z<32;z++)for(let x=0;x<32;x++){
    for(let y=0;y<32;y++)data[voxelIndex(x,y,z)]=base.getVoxel(min[0]+x,min[1]+y,min[2]+z);yield;
  }
  const list=yield* features.querySteps(min,max);
  for(const f of list){
    const lo=min.map((v,a)=>Math.max(v,f.min[a])),hi=max.map((v,a)=>Math.min(v,f.max[a]));
    for(let z=lo[2];z<hi[2];z++)for(let x=lo[0];x<hi[0];x++){
      for(let y=lo[1];y<hi[1];y++){
        const index=voxelIndex(x-min[0],y-min[1],z-min[2]),old=data[index];if(old&&!priority(old))continue;
        const value=f.sample(x,y,z);if(priority(value)>priority(old))data[index]=value;
      }yield;
    }
  }
  return data;
}
export function* timedSteps(iterator) {
  let cpuMs=0;
  while(true){const start=performance.now(),next=iterator.next();cpuMs+=performance.now()-start;if(next.done)return {value:next.value,cpuMs};yield;}
}
