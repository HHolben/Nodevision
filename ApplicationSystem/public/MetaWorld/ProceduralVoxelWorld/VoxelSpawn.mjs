// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelSpawn.mjs
// This module finds a nearby dry, gentle, feature-free standing position using bounded deterministic samples of the same terrain and collision field.
import { featureMaterialPriority } from './VoxelMaterialIds.mjs';
export function findVoxelSpawn(generator,x,z,playerHeight){
  const [width,,depth]=generator.dimensions;
  function inspect(cx,cz){
    const mx=width<8?1:3,mz=depth<8?1:3;
    cx=Math.max(mx,Math.min(width-1-mx,Math.floor(cx)));cz=Math.max(mz,Math.min(depth-1-mz,Math.floor(cz)));
    const y=generator.getSolidHeight(cx,cz);
    if(y<generator.getWaterTop(cx,cz)||generator.getSlope(cx,cz)>.5)return null;
    for(let py=y;py<y+Math.ceil(playerHeight/.25);py++)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(featureMaterialPriority(generator.getFeatureVoxel(cx+dx,py,cz+dz))===2)return null;
    }
    return [cx,y,cz];
  }
  let found=inspect(x,z);if(found)return found;
  for(let radius=16;radius<=512;radius+=16)for(let i=0;i<16;i++){
    found=inspect(x+Math.cos(i*Math.PI/8)*radius,z+Math.sin(i*Math.PI/8)*radius);if(found)return found;
  }
  throw Error('No dry, gentle player spawn was found within 128 metres of the requested position.');
}
