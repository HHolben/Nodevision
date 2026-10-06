// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainParameters.mjs
// This module centralizes deterministic parameters for the development-stage V1 heightfield and coherent limestone strata.
export const TERRAIN_V1 = Object.freeze({ waterLevelVoxelY: 71, baseHeight: 48, broadHeight: 48, detailHeight: 12,
  broadScale: 256, detailScale: 64, detailSeedSalt: 7919, subsoilDepth: 5,
  limestoneScale: 192, limestoneSeedSalt: 104729, limestoneThreshold: .57,
  stratumBase: 18, stratumAmplitude: 14, stratumThickness: 10 });
