// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMaterialIds.mjs
// This module translates compact runtime palette indices into canonical Nodevision material IDs without loading rendering or catalog code.
export const VOXEL_MATERIAL_IDS = Object.freeze(['air', 'grass', 'soil', 'stone', 'limestone', 'water', 'PineWood', 'PineBark', 'PineFoliage', 'sand', 'mud', 'LimestoneGravel', 'snow']);
export const voxelMaterialId = index => VOXEL_MATERIAL_IDS[index] ?? null;
export const WATER_VOXEL = VOXEL_MATERIAL_IDS.indexOf('water');
export const PINE_WOOD = VOXEL_MATERIAL_IDS.indexOf('PineWood');
export const PINE_BARK = VOXEL_MATERIAL_IDS.indexOf('PineBark');
export const PINE_FOLIAGE = VOXEL_MATERIAL_IDS.indexOf('PineFoliage');
export const SAND_VOXEL = VOXEL_MATERIAL_IDS.indexOf('sand');
export const MUD_VOXEL = VOXEL_MATERIAL_IDS.indexOf('mud');
export const GRAVEL_VOXEL = VOXEL_MATERIAL_IDS.indexOf('LimestoneGravel');
export const SNOW_VOXEL = VOXEL_MATERIAL_IDS.indexOf('snow');
export const isLiquidVoxel = id => id === WATER_VOXEL || id === MUD_VOXEL;
