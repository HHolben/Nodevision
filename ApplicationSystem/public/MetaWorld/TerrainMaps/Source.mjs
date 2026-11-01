// Nodevision/ApplicationSystem/public/MetaWorld/TerrainMaps/Source.mjs
// This module adapts terrain-map data to the shared terrain-source sampling interface. It preserves the voxel generator as the owner of volume composition and material selection.
// Common metre-space terrain source; the voxel generator retains ownership of volume/material composition.
import {noise} from '../ProceduralVoxelWorld/SeededVoxelNoise.mjs';
import {GEOGRAPHIC_BIOMES} from '../Geographic/Biomes.mjs';
import {VOXEL_MATERIAL_IDS} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
import {reference,resolveReference} from '../Constructions/Definition.mjs';
export const usesMap=def=>['map','hybrid'].includes(def.terrainSource);
export function validateMapSource(def){
  if(!usesMap(def))return;
  const m=def.terrainMap;if(!m||m.version!==1)throw Error('Terrain map configuration requires version 1');reference(m.path,'.nvmap');
  if(!Number.isFinite(m.detailStrength??0)||(m.detailStrength??0)<0||!Number.isFinite(m.detailScale??16)||(m.detailScale??16)<=0)throw Error('Map detail strength must be nonnegative and scale positive (meters)');
  if(m.outside!==undefined&&!['empty','procedural'].includes(m.outside))throw Error('Map outside mode must be empty or procedural');
  if(def.environment||def.startingBiome&&def.startingBiome!=='auto')throw Error('Map terrain obtains biomes from the map; select Automatic starting biome');
}
export function mapReference(worldPath,path){return resolveReference(worldPath,reference(path,'.nvmap'));}
export function proceduralSource(sample,bounds=null){const covers=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&(!bounds||x>=bounds.minX&&z>=bounds.minZ&&x<bounds.maxX&&z<bounds.maxZ);return {kind:'procedural',bounds,resolution:null,covers,sample:(x,z)=>covers(x,z)?{covered:true,material:null,...sample(x,z)}:{covered:false,elevation:null,biome:null,material:null}};}
export function mapSource(reader,{mode='map',seed=0,detailStrength=0,detailScale=16}={}){
  if(!['map','hybrid'].includes(mode))throw Error('Unsupported map sampling mode');
  const warnings=[],biomes=new Set(GEOGRAPHIC_BIOMES),materials=new Set(VOXEL_MATERIAL_IDS);
  for(const b of reader.manifest.biomes)if(!biomes.has(b))warnings.push(`Unknown biome "${b}"; using temperate`);
  for(const m of reader.manifest.materials)if(m!==null&&!materials.has(m))warnings.push(`Unknown material "${m}"; using biome surface`);
  const o=reader.manifest.origin;
  return {kind:mode,warnings,resolution:reader.manifest.grid.spacing.slice(),bounds:{minX:o[0],minZ:o[2],maxX:o[0]+reader.manifest.size[0],maxZ:o[2]+reader.manifest.size[1]},covers:reader.covers,readyAt:reader.readyAt,prepare:reader.prepare,
    sample(x,z){const s=reader.sample(x,z);if(!s.covered)return s;return {...s,biome:biomes.has(s.biome)?s.biome:'temperate',material:materials.has(s.material)?s.material:null,elevation:s.elevation+(mode==='hybrid'&&detailStrength?(noise(x/detailScale,z/detailScale,seed^0x4e564d50)*2-1)*detailStrength:0)};}};
}
