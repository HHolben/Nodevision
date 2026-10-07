// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/SunflowerPlacement.mjs
// This provider grows bounded sunflower patches on dry gentle temperate ground using canonical non-solid plant materials.
import { hash, noise } from '../SeededVoxelNoise.mjs';
import { VOXEL_MATERIAL_IDS } from '../VoxelMaterialIds.mjs';
const [stem,petal,seedHead]=['SunflowerStem','SunflowerPetal','SunflowerSeed'].map(id=>VOXEL_MATERIAL_IDS.indexOf(id));
export function createSunflowerPlacement(base,seed){
  return {cellSize:12,reach:3,maxHeight:12,candidate(rx,rz){
    const x=rx*12+6,z=rz*12+6,y=base.getTerrainHeight(x,z);
    if(x<3||z<3||x+4>=base.dimensions[0]||z+4>=base.dimensions[2]||y+12>base.dimensions[1])return null;
    if(base.getBiome(x,z)!=='temperate'||y<base.getWaterTop(x,z)||y>140||base.getSlope(x,z)>.5)return null;
    if(base.getVoxel(x,y-1,z)!==1||noise(x/96,z/96,seed^44117)<.65||hash(rx,rz,seed^3727)<.55)return null;
    const height=7+Math.floor(hash(rx,rz,seed)*3),axis=hash(rx,rz,seed^17)>.5;
    return {id:`sunflower:${rx},${rz}`,species:'Sunflower',origin:[x,y,z],min:[x-3,y,z-3],max:[x+4,y+height+3,z+4],sample(vx,vy,vz){
      const dx=vx-x,dz=vz-z,dy=vy-y,u=axis?dx:dz,v=axis?dz:dx;
      if(v===0&&Math.abs(u)<=2&&Math.abs(dy-height)<=2){
        const r=u*u+(dy-height)**2;if(r<=1)return seedHead;if(r<=5)return petal;
      }
      if(dx===0&&dz===0&&dy>=0&&dy<height)return stem;
      return dy===3&&Math.abs(dx)<=1&&Math.abs(dz)<=1?stem:0;
    }};
  }};
}
