// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs
// This module composes base terrain and bounded procedural features into a deterministic final voxel field shared by rendering, collision, and future overrides.
import { createChunkLevelQuery } from './VoxelChunkLevels.mjs';
import { createBaseTerrain } from './VoxelBaseTerrain.mjs';
import { createFeatureField } from './Features/FeatureField.mjs';
import { createTreePlacement } from './Features/TreePlacement.mjs';
import { featureMaterialPriority, voxelMaterialId } from './VoxelMaterialIds.mjs';
import { chunkToVoxel, voxelIndex, containsVoxel } from './VoxelCoordinates.mjs';
import { createSunflowerPlacement } from './Features/SunflowerPlacement.mjs';
const priority=featureMaterialPriority;
export function createVoxelGenerator(def) {
  const base=createBaseTerrain(def),provider=createTreePlacement(base,def.generator.seed);
  const features=createFeatureField([provider,createSunflowerPlacement(base,def.generator.seed)],priority);
  const featureStats={lookupMs:0,samplingMs:0,candidates:0};
  function getFeatureVoxel(x,y,z,list) {
    if(!containsVoxel([x,y,z],base.dimensions)||base.getVoxel(x,y,z))return 0;
    return list?features.sample(list,x,y,z):features.at(x,y,z);
  }
  function getVoxel(x,y,z){
    if(!containsVoxel([x,y,z],base.dimensions))return 0;
    return base.getVoxel(x,y,z)||features.at(x,y,z);
  }
  function generateChunk(cx,cy,cz){
    const data=base.generateChunk(cx,cy,cz),min=chunkToVoxel([cx,cy,cz]),max=min.map(v=>v+32);
    const start=performance.now(),list=features.query(min,max),sampleStart=performance.now();
    featureStats.lookupMs+=sampleStart-start;featureStats.candidates+=list.length;
    // Only visit feature boxes intersecting this chunk, preserving terrain and structural priority.
    for(const f of list){
      const lo=min.map((v,a)=>Math.max(v,f.min[a])),hi=max.map((v,a)=>Math.min(v,f.max[a]));
      for(let z=lo[2];z<hi[2];z++)for(let x=lo[0];x<hi[0];x++)for(let y=lo[1];y<hi[1];y++){
        const index=voxelIndex(x-min[0],y-min[1],z-min[2]),old=data[index];
        if(old&&!priority(old))continue;
        const value=f.sample(x,y,z);
        if(priority(value)>priority(old))data[index]=value;
      }
    }
    featureStats.samplingMs+=performance.now()-sampleStart;
    return data;
  }
  return { ...base,getChunkLevels:createChunkLevelQuery(base,features),features,featureStats,getFeatureVoxel,getVoxel,generateChunk,
    maxSolidHeight:Math.min(base.dimensions[1],base.maxSolidHeight+provider.maxHeight),
    getVoxelMaterialId:(x,y,z)=>voxelMaterialId(getVoxel(x,y,z)) };
}
