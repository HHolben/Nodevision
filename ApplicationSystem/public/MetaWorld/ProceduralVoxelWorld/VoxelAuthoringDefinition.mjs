// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs
// This module translates user-facing terrain dimensions and seeds into the existing compact V1 procedural definition. It validates authoring extensions before runtime allocation while leaving older Sandbox definitions unchanged.
import { AEGEAN_DEFAULTS, validateAegean } from '../Aegean/AegeanDefinition.mjs';
export function terrainSeed(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length > 256) throw Error('Seed must contain 1–256 characters.');
  if (/^[+-]?\d+$/.test(text)) {
    const n = Number(text);
    if (!Number.isSafeInteger(n)) throw Error('Numeric seed must be a safe integer.');
    return n | 0;
  }
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash | 0;
}
export function validateAuthoringTerrain(def) {
  validateAegean(def);
  if (def.heightLimits !== undefined) {
    const { min, max } = def.heightLimits || {};
    if (![min,max].every(n => Number.isFinite(n) && Math.abs(n) <= 256 && Number.isInteger(n * 4)) || max <= min || max-min > 256)
      throw Error('Height limits must be quarter-meter values between -256 and 256, with a positive span up to 256 m.');
    if (def.size?.[1] !== max-min) throw Error('Terrain height span must match its local size.');
  }
  if (def.boundaryMode !== undefined && !['open','closed'].includes(def.boundaryMode)) throw Error('Unsupported terrain boundary mode.');
  if (def.generation !== undefined) {
    for (const [key,value] of Object.entries(def.generation)) {
      if (!['vegetation','water','caves'].includes(key) || typeof value !== 'boolean') throw Error('Unsupported terrain generation setting: ' + key);
    }
  }
  if (def.materialPalette !== undefined && def.materialPalette !== 'nodevision-canonical-v1') throw Error('Unsupported terrain material palette.');
  if (def.biomeSource !== undefined && def.biomeSource !== 'nodevision-biomes-v1') throw Error('Unsupported terrain biome source.');
}
export function voxelWorldForm(def = null) {
  return { environmentPreset:def?.environment?.id || 'legacy', ...AEGEAN_DEFAULTS, ...def?.environment, name: def?.name || 'Voxel World', seed: def ? String(def.generator.seed) : String(crypto.getRandomValues(new Int32Array(1))[0]),
    sizeX: def?.size[0] ?? 256, sizeZ: def?.size[2] ?? 256,
    minHeight: def ? (def.heightLimits?.min ?? 0) : -16, maxHeight: def?.heightLimits?.max ?? def?.size[1] ?? 64,
    voxelSize: .25, chunkSize: 32, vegetation: def?.generation?.vegetation !== false,
    water: def?.generation?.water !== false, caves: def?.generation?.caves !== false };
}
export function definitionFromVoxelForm(values, previous = null) {
  const number = key => {
    if (String(values[key] ?? '').trim() === '') throw Error(key + ' is required.');
    const n = Number(values[key]);
    if (!Number.isFinite(n)) throw Error(key + ' must be a finite number.');
    return n;
  };
  const name = String(values.name || '').trim();
  if (!name || name.length > 120) throw Error('World Name must contain 1–120 characters.');
  const sizeX=number('sizeX'), sizeZ=number('sizeZ'), min=number('minHeight'), max=number('maxHeight');
  if (![sizeX,sizeZ].every(n => n >= 1 && n <= 4096 && Number.isInteger(n*4))) throw Error('Dimensions must be quarter-meter values from 1 to 4096 m.');
  if (number('voxelSize') !== .25 || number('chunkSize') !== 32) throw Error('This generator requires 0.25 m voxels and 32-voxel chunks.');
  const def = { ...previous, id: previous?.id || 'voxel-world', name, type:'procedural-voxel-world',
    position: previous?.position?.slice() || [-sizeX/2,0,-sizeZ/2], size:[sizeX,max-min,sizeZ], heightLimits:{min,max},
    voxelSize:.25, generator:{id:'nodevision-terrain-v1',version:1,seed:terrainSeed(values.seed)},
    chunks:previous?.chunks || {voxelsPerAxis:32,loadRadius:2}, boundaryMode:previous?.boundaryMode || 'open',
    generation:{vegetation:values.vegetation === true,water:values.water === true,caves:values.caves === true},
    materialPalette:'nodevision-canonical-v1', biomeSource:'nodevision-biomes-v1' };
  if(values.environmentPreset==='aegean')def.environment={...AEGEAN_DEFAULTS,...previous?.environment,landform:values.landform,geology:values.geology,season:values.season,seasonMode:values.seasonMode??previous?.environment?.seasonMode??'manual',seaLevel:number('seaLevel'),vegetationDensity:number('vegetationDensity'),uplandOak:values.uplandOak===true,mountains:values.mountains===true};
  else delete def.environment;
  validateAuthoringTerrain(def);
  return def;
}
