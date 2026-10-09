// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelFeatureCollision.mjs
// This adapter tests nearby terrain and feature voxels against the player body using canonical solidity without allocating persistent voxel or tree colliders.
import { VOXEL_SIZE as S } from './VoxelCoordinates.mjs';
export function createFeatureCollision(root,generator,entries,isDisposed) {
  return (point,radius,minY,maxY,stepAllowance=0)=>{
    if(isDisposed()||!root.visible)return false;
    const origin=root.position;
    const min=[point.x-radius-origin.x,minY-origin.y,point.z-radius-origin.z].map(v=>Math.floor(v/S));
    const max=[point.x+radius-origin.x,maxY-origin.y,point.z+radius-origin.z].map(v=>Math.floor(v/S));
    const list=generator.features.query(min,max.map(v=>v+1));

    for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++)for(let x=min[0];x<=max[0];x++){
      const baseMaterial=generator.getVoxel(x,y,z);
      const featureMaterial=generator.getFeatureVoxel(x,y,z,list),isFeature=featureMaterial!==0;
      const material=isFeature?featureMaterial:baseMaterial;
      // Terrain steps may be climbed, but overhead rock and tall walls always block the body.
      if(!isFeature&&origin.y+(y+1)*S<=minY+stepAllowance+.001)continue;
      if(entries[material]?.collider?.solid!==true)continue;
      const dx=Math.max(origin.x+x*S-point.x,0,point.x-(origin.x+(x+1)*S));
      const dz=Math.max(origin.z+z*S-point.z,0,point.z-(origin.z+(z+1)*S));
      if(dx*dx+dz*dz<radius*radius&&origin.y+(y+1)*S>minY+.001&&origin.y+y*S<maxY)return true;
    }
    return false;
  };
}
