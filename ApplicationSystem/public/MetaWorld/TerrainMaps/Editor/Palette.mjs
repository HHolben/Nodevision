// Nodevision/ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Palette.mjs
// This module derives terrain-map biome labels and display colors from existing biome definitions. It provides a shared palette for editor controls and viewport rendering.
import {GEOGRAPHIC_BIOMES} from '../../Geographic/Biomes.mjs';
import {BIOMES} from '../../ProceduralVoxelWorld/VoxelBiomes.mjs';
import {AEGEAN_BIOMES} from '../../Aegean/Biomes.mjs';
const definitions=[...Object.values(BIOMES),...AEGEAN_BIOMES];
export const biomeOptions=GEOGRAPHIC_BIOMES.map(id=>[id,definitions.find(b=>b.id===id)?.name||id]);
