// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMaterialIds.mjs
// This module translates compact runtime palette indices into canonical Nodevision material IDs without loading rendering or catalog code.
import { AEGEAN_MATERIAL_IDS } from '../Aegean/MaterialIds.mjs';
export const VOXEL_MATERIAL_IDS = Object.freeze(['air', 'grass', 'soil', 'stone', 'limestone', 'water', 'PineWood', 'PineBark', 'PineFoliage', 'sand', 'mud', 'LimestoneGravel', 'snow', 'MapleWood', 'MapleBark', 'MapleFoliage', 'OakWood', 'OakBark', 'OakFoliage', 'MagnoliaWood', 'MagnoliaBark', 'MagnoliaFoliage', 'MagnoliaBlossom', 'SunflowerStem', 'SunflowerPetal', 'SunflowerSeed', 'moss', 'PineNeedles', 'AppleWood', 'AppleBark', 'AppleFoliage', 'PearWood', 'PearBark', 'PearFoliage', 'CherryWood', 'CherryBark', 'CherryFoliage', ...AEGEAN_MATERIAL_IDS]);
export const LEGACY_VOXEL_MATERIAL_COUNT = 37;
export const voxelMaterialId = index => VOXEL_MATERIAL_IDS[index] ?? null;
export const PINE_NEEDLES = VOXEL_MATERIAL_IDS.indexOf('PineNeedles');
export const MOSS_VOXEL = VOXEL_MATERIAL_IDS.indexOf('moss');
export const WATER_VOXEL = VOXEL_MATERIAL_IDS.indexOf('water');
export const PINE_WOOD = VOXEL_MATERIAL_IDS.indexOf('PineWood');
export const PINE_BARK = VOXEL_MATERIAL_IDS.indexOf('PineBark');
export const PINE_FOLIAGE = VOXEL_MATERIAL_IDS.indexOf('PineFoliage');
export const SAND_VOXEL = VOXEL_MATERIAL_IDS.indexOf('sand');
export const MUD_VOXEL = VOXEL_MATERIAL_IDS.indexOf('mud');
export const GRAVEL_VOXEL = VOXEL_MATERIAL_IDS.indexOf('LimestoneGravel');
export const SNOW_VOXEL = VOXEL_MATERIAL_IDS.indexOf('snow');
const waters=new Set([WATER_VOXEL,...AEGEAN_MATERIAL_IDS.filter(id=>id.endsWith('Water')).map(id=>VOXEL_MATERIAL_IDS.indexOf(id))]);
export const isWaterVoxel = id => waters.has(id);
export const isLiquidVoxel = id => isWaterVoxel(id) || id === MUD_VOXEL;
export const treeMaterialIndices = species => ['Wood','Bark','Foliage'].map(part=>VOXEL_MATERIAL_IDS.indexOf(species+part));
const structure=new Set(['Pine','Maple','Oak','Magnolia','Apple','Pear','Cherry'].flatMap(s=>treeMaterialIndices(s).slice(0,2)));
const foliage=new Set(['Pine','Maple','Oak','Magnolia','Apple','Pear','Cherry'].map(s=>treeMaterialIndices(s)[2]).concat(['MagnoliaBlossom','SunflowerStem','SunflowerPetal','SunflowerSeed'].map(id=>VOXEL_MATERIAL_IDS.indexOf(id))));
for(const id of AEGEAN_MATERIAL_IDS) {
  const index=VOXEL_MATERIAL_IDS.indexOf(id);
  if(id.endsWith('Wood')||id.endsWith('Bark'))structure.add(index);
  if(id.endsWith('Foliage'))foliage.add(index);
}
const priorities=new Float32Array(256);
for(let id=0;id<priorities.length;id++)priorities[id]=structure.has(id)?2:foliage.has(id)?1:id===PINE_NEEDLES?.5:0;
export const featureMaterialPriority = id => priorities[id]??0;
