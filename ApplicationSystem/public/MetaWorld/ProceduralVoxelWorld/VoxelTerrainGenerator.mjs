// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs
// This module composes base terrain and bounded procedural features into a deterministic final voxel field shared by rendering, collision, and future overrides.
import { terrainChunkSteps } from './ProgressiveTerrain.mjs';
import { geographicVegetation } from '../Geographic/Vegetation.mjs';
import { excludesProtectedFeature } from '../Aegean/ProtectedRegions.mjs';
import { createAegeanPlacement } from '../Aegean/PlantPlacement.mjs';
import { createChunkLevelQuery } from './VoxelChunkLevels.mjs';
import { createBaseTerrain } from './VoxelBaseTerrain.mjs';
import { createPathTerrainField } from '../Paths/PathTerrainField.mjs';
import { createFeatureField } from './Features/FeatureField.mjs';
import { createTreePlacement } from './Features/TreePlacement.mjs';
import { featureMaterialPriority, voxelMaterialId } from './VoxelMaterialIds.mjs';
import { chunkToVoxel, voxelIndex, containsVoxel } from './VoxelCoordinates.mjs';
const priority=featureMaterialPriority;
export function createVoxelGenerator(source) {
  const def={...source,environment:source.environment?{...source.environment}:undefined};
  const original=createBaseTerrain(def),base=createPathTerrainField(original,def),providers=def.terrainSource==='geographic'?geographicVegetation(original,def):[def.environment?.id==='aegean'?createAegeanPlacement(original,def):createTreePlacement(original,def.generator.seed)];
  const provider={reach:Math.max(...providers.map(p=>p.reach)),maxHeight:Math.max(...providers.map(p=>p.maxHeight))};
  const filtered=providers.map(provider=>({...provider,candidate(x,z){const f=provider.candidate(x,z);return (base.allowsFeature&&!base.allowsFeature(f))||base.excludesFeature(f)||excludesProtectedFeature(def,f)?null:f;}}));
  const features=createFeatureField(def.generation?.vegetation === false ? [] : filtered,priority);
  let levels=createChunkLevelQuery(base,features);
  const featureStats={lookupMs:0,samplingMs:0,candidates:0};
  function getFeatureVoxel(x,y,z,list) {
    if(!containsVoxel([x,y,z],base.dimensions)||base.getVoxel(x,y,z))return 0;
    return base.applyExcavation(x,y,z,list?features.sample(list,x,y,z):features.at(x,y,z));
  }
  function getVoxel(x,y,z){
    if(!containsVoxel([x,y,z],base.dimensions))return 0;
    return base.applyExcavation(x,y,z,base.getVoxel(x,y,z)||features.at(x,y,z));
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
    if(base.hasExcavation)for(let z=0;z<32;z++)for(let x=0;x<32;x++)for(let y=0;y<32;y++){const i=voxelIndex(x,y,z);data[i]=base.applyExcavation(min[0]+x,min[1]+y,min[2]+z,data[i]);}
    featureStats.samplingMs+=performance.now()-sampleStart;
    return data;
  }
  return { ...base,generateChunkSteps:(...cell)=>terrainChunkSteps(base,features,...cell),getChunkLevelsSteps:(x,z)=>levels.steps(x,z),cacheStats:()=>({...base.cacheStats?.(),...features.cacheStats(),levels:levels.cacheSize()}),getChunkLevels:(x,z)=>levels(x,z),features,featureStats,getFeatureVoxel,getVoxel,generateChunk,
    get season(){return def.environment?.season;},
    setSeason(season){
      if(def.environment?.id!=='aegean'||def.environment.season===season)return false;
      if(!['spring','summer','autumn','winter'].includes(season))throw Error('Unsupported season.');
      def.environment.season=season;base.clearColumns();features.clear();levels=createChunkLevelQuery(base,features);return true;
    },
    pathFeatureReach:provider.reach*2,
    setPathConstraints(paths){base.setPathConstraints(paths);features.clear();levels=createChunkLevelQuery(base,features);},
    maxSolidHeight:Math.min(base.dimensions[1],base.maxSolidHeight+provider.maxHeight),
    getVoxelMaterialId:(x,y,z)=>voxelMaterialId(getVoxel(x,y,z)) };
}
