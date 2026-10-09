// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBaseTerrain.mjs
// This module produces deterministic finite heightfield terrain without depending on rendering or scene state.

import { CHUNK_SIZE, chunkToVoxel, containsVoxel, voxelDimensions, voxelIndex } from "./VoxelCoordinates.mjs";
import { voxelMaterialId, WATER_VOXEL, MUD_VOXEL, MOSS_VOXEL } from "./VoxelMaterialIds.mjs";
import { TERRAIN_V1 as P } from "./VoxelTerrainParameters.mjs";
import { biomeAt } from "./VoxelBiomes.mjs";
import { surfaceMaterial } from "./VoxelSurfaceComposition.mjs";
import { mountainRelief, maximumTerrainHeight } from "./VoxelMountains.mjs";
import { mountainSurface, MOUNTAIN_SURFACE } from "./VoxelMountainSurface.mjs";
import { noise } from "./SeededVoxelNoise.mjs";
import { createWaterways } from './VoxelWaterways.mjs';
import { createLandforms } from './VoxelLandforms.mjs';
import { cavernColumn, sampleCavern } from './VoxelCaverns.mjs';
export function createBaseTerrain(def) {
  const dimensions = voxelDimensions(def.size), seed = def.generator.seed;
  const heights=new Array(4096);
  function rawHeight(x, z) {
    if (x < 0 || z < 0 || x >= dimensions[0] || z >= dimensions[2]) return 0;
    const key=(x&127)+((z&31)<<7),cached=heights[key];
    if(cached?.x===x&&cached.z===z)return cached.height;
    const height=Math.min(dimensions[1], Math.max(1, Math.floor(P.baseHeight + P.broadHeight * noise(x / P.broadScale, z / P.broadScale, seed) + P.detailHeight * noise(x / P.detailScale, z / P.detailScale, seed ^ P.detailSeedSalt)+mountainRelief(x,z,seed,dimensions[1]))));
    heights[key]={x,z,height};return height;
  }
  const landforms=createLandforms(rawHeight,dimensions,seed);
  const waterways=createWaterways(rawHeight,dimensions,seed);
  function getTerrainHeight(x,z){const raw=rawHeight(x,z);return raw?Math.max(1,Math.min(landforms.sample(x,z,raw).height,waterways.sample(x,z)?.bed??raw)):0;}
  function getWaterTop(x,z){return Math.min(dimensions[1],Math.max(P.waterLevelVoxelY+1,waterways.sample(x,z)?.top??0));}
  function getSlope(x,z){
    const sample=(dx,dz)=>getTerrainHeight(Math.max(0,Math.min(dimensions[0]-1,x+dx)),Math.max(0,Math.min(dimensions[2]-1,z+dz)));
    const hs=[sample(-2,0),sample(2,0),sample(0,-2),sample(0,2)];return (Math.max(...hs)-Math.min(...hs))/4;
  }
  const columns=new Array(4096);
  function materialColumn(x, z) {
    const key=(x&127)+((z&31)<<7),cached=columns[key];
    if(cached?.x===x&&cached.z===z)return cached;
    const field = noise(x / P.limestoneScale, z / P.limestoneScale, seed ^ P.limestoneSeedSalt);
    const column={ x,z,height:getTerrainHeight(x,z), limestone:field>P.limestoneThreshold,
      stratum:Math.floor(P.stratumBase+P.stratumAmplitude*field) };
    const context={x,z,height:column.height,waterTop:getWaterTop(x,z),limestone:column.limestone,biome:biomeAt(x,z,seed),seed};
    column.surface=mountainSurface({...context,slope:column.height>MOUNTAIN_SURFACE.rockElevation?getSlope(x,z):0})??surfaceMaterial(context);
    column.waterTop=context.waterTop;
    const landform=landforms.sample(x,z,rawHeight(x,z));
    column.cavern=cavernColumn(x,z,column.height,landform.region,seed);
    if(landform.exposed&&column.height>=column.waterTop)column.surface=column.limestone?4:3;
    const nearbyWater=waterways.sample(x,z);
    if(nearbyWater?.kind==='bank'&&column.height>=column.waterTop&&column.height<180&&column.surface!==12&&noise(x/12,z/12,seed^99871)>.64&&Math.abs(column.height-nearbyWater.bankTop)<8)column.surface=MOSS_VOXEL;
    columns[key]=column;return column;
  }
  function sampleColumn(y, column) {
    if (y < 0 || y >= dimensions[1] || !column.height) return 0;
    const cave=sampleCavern(column.cavern,y);if(cave!==null)return cave;
    if (y >= column.height) return y < column.waterTop ? WATER_VOXEL : 0;
    if (y === column.height - 1) return column.surface;
    if (y >= column.height - P.subsoilDepth) return column.height>MOUNTAIN_SURFACE.rockElevation?(column.limestone?4:3):2;
    return column.limestone && y >= column.stratum && y < column.stratum + P.stratumThickness ? 4 : 3;
  }
  function getVoxel(x, y, z) {
    return containsVoxel([x,y,z], dimensions) ? sampleColumn(y, materialColumn(x,z)) : 0;
  }
  function getVoxelMaterialId(x, y, z) { return voxelMaterialId(getVoxel(x,y,z)); }
  function generateChunk(cx, cy, cz) {
    const origin = chunkToVoxel([cx, cy, cz]), data = new Uint8Array(CHUNK_SIZE ** 3);
    for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const column = materialColumn(origin[0] + x, origin[2] + z);
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const gy = origin[1] + y;
        data[voxelIndex(x, y, z)] = sampleColumn(gy, column);
      }
    }
    return data;
  }
  function getSolidHeight(x,z,maxY=Infinity){
    const c=materialColumn(x,z),top=Math.max(0,c.height-(c.surface===MUD_VOXEL?1:0));
    if(!c.cavern)return top;
    if(maxY>=top&&top>c.cavern.ceiling)return top;
    const solid=y=>{const id=sampleColumn(y,c);return id!==0&&id!==WATER_VOXEL&&id!==MUD_VOXEL;};
    for(let y=Math.min(top,Math.floor(maxY));y>0;y--)if(solid(y-1)&&!solid(y))return y;
    return 0;
  }
  return { getCavern:(x,z)=>materialColumn(x,z).cavern, getLandform:(x,z)=>landforms.sample(x,z,rawHeight(x,z)), getWaterTop, getWaterway:(x,z)=>waterways.sample(x,z), getSlope, getSolidHeight, getBiome:(x,z)=>biomeAt(x,z,seed).id, clearColumns:()=>{columns.fill(undefined);heights.fill(undefined);waterways.clear();landforms.clear();}, dimensions, maxSolidHeight: maximumTerrainHeight(dimensions[1]), getTerrainHeight, getVoxel, getVoxelMaterialId, generateChunk };
}
