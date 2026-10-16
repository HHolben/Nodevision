// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelStartingBiome.mjs
// This module defines the shared starting-biome choices and biases the existing climate field near the placement center. Definitions without a choice retain the original seeded distribution, while Aegean continues to use its established coastal environment generator.
import { BIOMES, BIOME_PARAMETERS, biomeAt } from './VoxelBiomes.mjs';
import { noise } from './SeededVoxelNoise.mjs';
export const STARTING_BIOMES = Object.freeze([
  ['auto', 'Automatic (from seed)'],
  ['aegean', 'Aegean Greek Wilderness'],
  [BIOMES.temperate.id, BIOMES.temperate.name],
  [BIOMES.snowy.id, BIOMES.snowy.name]
]);
export function validateStartingBiome(def) {
  const id = def.startingBiome;
  if (id === undefined) return;
  if (!STARTING_BIOMES.some(([value]) => value === id)) throw Error('Unsupported starting biome: ' + id);
  if (id === 'aegean' && def.environment?.id !== 'aegean') throw Error('Aegean starting biome requires the Aegean environment.');
  if (['temperate','snowy-pine-forest'].includes(id) && def.environment) throw Error('The starting biome does not match the environment.');
}
export function createStartingBiomeSampler(def, dimensions) {
  const seed = def.generator.seed, id = def.startingBiome;
  if (!['temperate','snowy-pine-forest'].includes(id)) return (x,z) => biomeAt(x,z,seed);
  const centerX = dimensions[0]/2, centerZ = dimensions[2]/2;
  const radius = Math.max(1, Math.min(256, dimensions[0]/4, dimensions[2]/4));
  const target = id === 'temperate' ? 0 : 1;
  return (x,z) => {
    const distance = Math.hypot(x-centerX,z-centerZ);
    // A stable central region blends back into the unchanged climate field over
    // the next radius; no seed search or changes to terrain relief are needed.
    const t = Math.max(0,Math.min(1,(distance-radius)/radius));
    const blend = t*t*(3-2*t), p = BIOME_PARAMETERS;
    const original = noise(x/p.scale,z/p.scale,seed^p.seedSalt);
    return target*(1-blend)+original*blend > p.coldThreshold ? BIOMES.snowy : BIOMES.temperate;
  };
}
