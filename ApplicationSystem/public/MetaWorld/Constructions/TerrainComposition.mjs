// Nodevision/ApplicationSystem/public/MetaWorld/Constructions/TerrainComposition.mjs
// Applies bounded rectangular replacement after existing paths/features without per-voxel deletion records.
import {isLiquidVoxel} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
import {inside,intersects,SIZE} from './Definition.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
export function composeConstructions(base,definition){
 let entries=[],tiles=new Map(),material=v=>3;const origin=()=>definition.position.map((v,i)=>v+(i===1?(definition.heightLimits?.min||0):0));
 const world=(x,y,z)=>[x,y,z].map((n,i)=>origin()[i]+(n+.5)*SIZE);
 function candidates(x,z){const key=`${Math.floor(x/32)},${Math.floor(z/32)}`;if(!tiles.has(key)){if(tiles.size>=512)tiles.clear();const o=origin(),min=[o[0]+Math.floor(x/32)*8-SIZE,-Infinity,o[2]+Math.floor(z/32)*8-SIZE],box={min,max:[min[0]+8+SIZE*2,Infinity,min[2]+8+SIZE*2]};tiles.set(key,entries.filter(e=>intersects(e.extent||e.bounds,box)).map(e=>({...e,cuts:e.cuts.filter(b=>intersects(b,box))})));}return tiles.get(key);}

 const hit=(x,y,z)=>{if(!entries.length)return null;const p=world(x,y,z);return candidates(x,z).find(e=>e.cuts.some(b=>inside(b,p)));};
 const renderVoxel=(x,y,z)=>hit(x,y,z)?0:base.getVoxel(x,y,z);
 const getVoxel=(x,y,z)=>{if(!entries.length)return base.getVoxel(x,y,z);const p=world(x,y,z),list=candidates(x,z);for(const e of list)if(e.sample(p)?.[3])return e.sampleVoxel?material(e.sampleVoxel(p)):3;return list.some(e=>e.cuts.some(b=>inside(b,p)))?0:base.getVoxel(x,y,z);};
 function suppress(data,cx,cy,cz){const o=origin(),min=[cx,cy,cz].map((n,i)=>o[i]+n*32*SIZE),box={min,max:min.map(n=>n+8)};
  for(const e of candidates(cx*32,cz*32))for(const cut of e.cuts){if(!intersects(cut,box))continue;const lo=cut.min.map((n,i)=>Math.max(0,Math.ceil((n-min[i])/SIZE))),hi=cut.max.map((n,i)=>Math.min(32,Math.ceil((n-min[i])/SIZE)));
   for(let y=lo[1];y<hi[1];y++)for(let z=lo[2];z<hi[2];z++)for(let x=lo[0];x<hi[0];x++)data[voxelIndex(x,y,z)]=0;
  }return data;
 }
 const additionalLevels=(levels,cx,cz)=>{const set=new Set(levels),o=origin();for(const e of candidates(cx*32,cz*32)){const low=Math.max(0,Math.floor((e.bounds.min[1]-o[1])/8)-1),high=Math.min(Math.ceil(base.dimensions[1]/32)-1,Math.floor((e.bounds.max[1]-o[1])/8));for(let y=low;y<=high;y++)set.add(y);}return [...set].sort((a,b)=>a-b);};
 return {...base,get season(){return base.season;},getVoxel,getRenderVoxel:renderVoxel,get hasConstructions(){return entries.length>0;},
  getFeatureVoxel:(x,y,z,list)=>hit(x,y,z)||entries.length&&candidates(x,z).some(e=>e.sample(world(x,y,z))?.[3])?0:base.getFeatureVoxel(x,y,z,list),
  getVoxelMaterialId:(x,y,z)=>{if(!entries.length)return base.getVoxelMaterialId(x,y,z);const p=world(x,y,z);const e=candidates(x,z).find(e=>e.sample(p)?.[3]);return e?(e.sampleVoxel?.(p)?.materialId||'stone'):hit(x,y,z)?'air':base.getVoxelMaterialId(x,y,z);},
  getSolidHeight(x,z,max=Infinity){if(!entries.length||!candidates(x,z).length)return base.getSolidHeight(x,z,max);for(let y=Math.min(base.dimensions[1],Math.floor(max));y>0;y--){const v=getVoxel(x,y-1,z),above=getVoxel(x,y,z);if(v&&!isLiquidVoxel(v)&&(!above||isLiquidVoxel(above)))return y;}return 0;},
  generateChunk:(...cell)=>suppress(base.generateChunk(...cell),...cell),
  *generateChunkSteps(...cell){const data=yield*base.generateChunkSteps(...cell);yield;return suppress(data,...cell);},
  getChunkLevels:(x,z)=>additionalLevels(base.getChunkLevels(x,z),x,z),
  *getChunkLevelsSteps(x,z){return additionalLevels(yield*base.getChunkLevelsSteps(x,z),x,z);},
  pathSupport(path,x,z){const height=path.heightAt(x,z);if(Number.isFinite(height)&&entries.some(e=>e.cuts.some(b=>inside(b,[x,height-1e-6,z]))))return {height,suppressed:true};return base.pathSupport?.(path,x,z);},
  getTerrainVoxel:(x,y,z)=>base.getVoxel(x,y,z),
  setConstructionMaterialResolver(resolve){material=resolve;},
  setConstructions(next){entries=next;tiles.clear();},
  setConstructionOrigin(position){definition.position=position.slice();tiles.clear();}
 };
}
