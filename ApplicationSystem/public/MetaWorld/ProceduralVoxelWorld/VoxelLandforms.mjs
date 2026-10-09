// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelLandforms.mjs
// This module places bounded erosion regions among unchanged rolling hills and mountains and defines their ravines, canyons, cliffs and connected cavern entrances.
import { hash } from './SeededVoxelNoise.mjs';
export const LANDFORM_REGION = 512;
export function createLandforms(rawHeight, dimensions, seed) {
  const regions = new Map();
  function region(rx, rz) {
    const key = `${rx},${rz}`;
    if (regions.has(key)) return regions.get(key);
    const x = rx * 512 + 256, z = rz * 512 + 256, height = rawHeight(x,z);
    let result = null;
    if (x > 180 && z > 180 && x + 180 < dimensions[0] && z + 180 < dimensions[2] && height > 110 && hash(rx,rz,seed^55271) > .25) {
      const choice = hash(rx,rz,seed^91139), kind = choice < .34 ? 'ravine' : choice < .7 ? 'canyon' : 'cliff';
      const depth = kind === 'ravine' ? 48 : kind === 'canyon' ? 80 : 56;
      const width=kind==='ravine'?10:kind==='canyon'?46:70;
      const left=rawHeight(x-width-58,z),right=rawHeight(x+width+58,z),side=right>=left?1:-1;
      const floor=kind==='cliff'?height-depth:Math.min(height-depth,Math.max(left,right)-48);
      result = { x,z,kind, floor:Math.max(76,floor), width,side };
    }
    if (regions.size >= 128) regions.delete(regions.keys().next().value);
    regions.set(key,result); return result;
  }
  function sample(x,z,raw) {
    const r = region(Math.floor(x/512),Math.floor(z/512));
    if (!r) return { height:raw, region:null };
    const dz = z-r.z, bend = Math.sin(dz/55)*8, dx = x-r.x-bend;
    const along = Math.max(0,Math.min(1,(170-Math.abs(dz))/45));
    let across;
    if (r.kind==='cliff') across = dx>=0 ? Math.max(0,Math.min(1,(130-dx)/40)) : Math.max(0,1+dx/3);
    else across = Math.max(0,Math.min(1,(r.width-Math.abs(dx))/(r.kind==='ravine'?3:8)));
    const weight=along*across;
    return { height:Math.max(1,Math.floor(raw-Math.max(0,raw-r.floor)*weight)),region:r, exposed:weight>0 };
  }
  return { sample,region,clear:()=>regions.clear() };
}
