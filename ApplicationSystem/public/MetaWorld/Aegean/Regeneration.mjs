// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/Regeneration.mjs
// This module records bounded vegetation revision scopes so regeneration changes local plant seeds without modifying terrain, protected ground or authored objects.
import { AEGEAN_BIOMES } from './Biomes.mjs';
export function validateVegetationRevisions(def) {
  if(def.vegetationRevisions===undefined)return;
  if(!def.environment||!Array.isArray(def.vegetationRevisions)||def.vegetationRevisions.length>64)throw Error('At most 64 Aegean vegetation regeneration scopes are supported.');
  for(const r of def.vegetationRevisions){
    if(!Number.isInteger(r.seed)||r.seed< -2147483648||r.seed>2147483647)throw Error('Invalid vegetation revision seed.');
    if(!Array.isArray(r.bounds)||r.bounds.length!==4||!r.bounds.every(Number.isFinite)||r.bounds[0]<0||r.bounds[1]<0||r.bounds[2]>def.size[0]*4||r.bounds[3]>def.size[2]*4||r.bounds[0]>=r.bounds[2]||r.bounds[1]>=r.bounds[3])throw Error('Invalid vegetation regeneration bounds.');
    if(r.biome!==null&&!AEGEAN_BIOMES.some(b=>b.id===r.biome))throw Error('Invalid vegetation biome scope.');
  }
}
export function vegetationSeed(def,x,z,biome) {
  let seed=def.generator.seed;
  for(const r of def.vegetationRevisions||[]){const [x0,z0,x1,z1]=r.bounds;if(x>=x0&&z>=z0&&x<x1&&z<z1&&(!r.biome||r.biome===biome))seed=r.seed;}
  return seed;
}
export function regenerateVegetationDefinition(def,{bounds=[0,0,def.size[0]*4,def.size[2]*4],biome=null}={}) {
  const next=structuredClone(def),revisions=next.vegetationRevisions||[];
  const seed=(Math.imul(def.generator.seed^revisions.length^0x5bd1e995,1664525)+1013904223)|0;
  next.vegetationRevisions=[...revisions,{seed,bounds,biome}];validateVegetationRevisions(next);return next;
}
