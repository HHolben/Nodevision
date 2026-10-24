// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Terrain.mjs
// This heightfield adapter supplies imported elevation and deterministic mapped surfaces to the existing chunk engine while retaining path grading and feature placement interfaces.
import { AEGEAN_SPECIES_DATA } from '../Aegean/SpeciesData.mjs';
import { geographicPoint, insideCrop } from './Definition.mjs';
import { sampleRaster, inPolygon } from './Coordinates.mjs';
import { biomeSurface } from './Biomes.mjs';
import { VOXEL_MATERIAL_IDS, voxelMaterialId } from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
import { voxelDimensions, containsVoxel, voxelIndex } from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import { noise } from '../ProceduralVoxelWorld/SeededVoxelNoise.mjs';
export function createGeographicTerrain(def) {
  const g=def.geographic,dimensions=voxelDimensions(def.size),cache=new Map();
  function column(x,z) {
    const key=x+','+z;if(cache.has(key))return cache.get(key);
    const p=geographicPoint(g,x,z),inside=x>=0&&z>=0&&x<dimensions[0]&&z<dimensions[2]&&insideCrop(g,p);
    const elevation=inside?sampleRaster(g.elevation,...p):null;
    if(g.version===2&&inside&&elevation===null)throw Error('Saved geographic snapshot is missing interpolation support. Reimport the selected crop.');
    let biome=g.defaultBiome,category=null;
    if(g.landcover&&inside){category=sampleRaster(g.landcover,...p,true);biome=g.mapping[category]??biome;}
    for(const region of g.regions)if(region.biome&&inPolygon(p,region)){biome=region.biome;category=null;}
    const height=elevation===null?0:Math.floor((elevation*g.verticalExaggeration+g.verticalOffset+(g.detail?.25*noise(x/40,z/40,def.generator.seed):0))*4);
    const surface=VOXEL_MATERIAL_IDS.indexOf(biomeSurface(biome));
    const value={height,biome,surface,category};
    if(cache.size>=8192)cache.delete(cache.keys().next().value);cache.set(key,value);return value;
  }
  const getTerrainHeight=(x,z)=>column(x,z).height;
  function getVoxel(x,y,z) {if(!containsVoxel([x,y,z],dimensions))return 0;const c=column(x,z);return y>=c.height?0:y===c.height-1?c.surface:y>=c.height-4?2:3;}
  function generateChunk(cx,cy,cz) {
    const data=new Uint8Array(32**3);
    for(let z=0;z<32;z++)for(let x=0;x<32;x++)for(let y=0;y<32;y++)data[voxelIndex(x,y,z)]=getVoxel(cx*32+x,cy*32+y,cz*32+z);
    return data;
  }
  function allowsFeature(f) {
    if(!f)return true;
    const tree=AEGEAN_SPECIES_DATA.find(s=>s.id===f.species)?.category==='tree'||['Pine','Oak','Maple','Magnolia','Apple','Pear','Cherry'].includes(f.species);
    const permitted=c=>c.height&&(c.category===null||(tree?[10,95]:[10,20,30,95,100]).includes(c.category));
    // Check the entire footprint, including holes and concave crop boundaries.
    for(let z=f.min[2];z<f.max[2];z++)for(let x=f.min[0];x<f.max[0];x++)if(!permitted(column(x,z)))return false;
    return true;
  }
  return {cacheStats:()=>({columns:cache.size}),dimensions,maxSolidHeight:dimensions[1],getTerrainHeight,getSolidHeight:getTerrainHeight,getWaterTop:()=>0,getCavern:()=>null,getWaterway:()=>null,getLandform:()=>null,
    getBiome:(x,z)=>column(x,z).biome,getSlope:(x,z)=>Math.max(Math.abs(getTerrainHeight(x+1,z)-getTerrainHeight(x-1,z)),Math.abs(getTerrainHeight(x,z+1)-getTerrainHeight(x,z-1)))/2,
    allowsFeature,getVoxel,getVoxelMaterialId:(x,y,z)=>voxelMaterialId(getVoxel(x,y,z)),generateChunk,clearColumns:()=>cache.clear()};
}
