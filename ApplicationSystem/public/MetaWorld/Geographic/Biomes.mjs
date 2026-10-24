// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Biomes.mjs
// This module maps coarse land-cover categories onto existing terrain families while making surface fallbacks explicit and separating generic forest cover from inferred species.
import { AEGEAN_BIOMES } from '../Aegean/Biomes.mjs';
export const GEOGRAPHIC_BIOMES = ['temperate','snowy-pine-forest',...AEGEAN_BIOMES.map(b=>b.id)];
export const DEFAULT_MAPPING = {10:'temperate',20:'phrygana',30:'temperate',40:'temperate',50:'rocky-mountain',60:'rocky-mountain',70:'snowy-pine-forest',80:'stream-valley',90:'stream-valley',95:'temperate',100:'phrygana'};
export const MAPPING_NOTE = 'Tree cover uses approximate procedural forest. Grassland/cropland use grass; built-up/bare land use rock (no buildings). Water/wetland use dry streambed gravel; no inferred water level. Mangroves use generic forest, moss/lichen use scrub. Unknown/NoData use the default biome.';
export function biomeSurface(id) {
  if(id==='temperate')return 'grass';
  if(id==='snowy-pine-forest')return 'snow';
  return AEGEAN_BIOMES.find(b=>b.id===id)?.ground || 'grass';
}
