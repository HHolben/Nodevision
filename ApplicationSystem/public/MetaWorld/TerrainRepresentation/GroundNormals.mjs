// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/GroundNormals.mjs
// Precompute globally aligned, filtered height gradients for unchanged natural top surfaces only. Binary Surface Nets normals remain authoritative for liquid, features, edits, cuts, caves, cliffs and unsupported source neighborhoods; geometry and material ownership never change.
import {isLiquidVoxel} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
export const GROUND_NORMAL_HALO=9;
const corners=[[0,0,0,0],[1,0,0,1],[0,1,0,34],[1,1,0,35],[0,0,1,1156],[1,0,1,1157],[0,1,1,1190],[1,1,1,1191]];
export function naturalGroundNormals(generator,cell=null){
 const source=generator.base;if(!source?.getTerrainHeight||!source.getVoxel)return null;
 // These maps belong to a single chunk build, not the runtime or world extent.
 const columns=cell?new Array(52**2):new Map(),gradients=new Map(),minX=cell?cell[0]*32-9:0,minZ=cell?cell[2]*32-9:0;
 let sourceSamples=null,knownSamples=null;
 function column(x,z){
  const key=cell?x-minX+52*(z-minZ):x+','+z,cached=cell?columns[key]:columns.get(key);if(cached)return cached;
  const h=source.getTerrainHeight(x,z),safe=h>0&&!source.getCavern?.(x,z)&&!(source.getWaterTop?.(x,z)>=h-1);
  const value={h,safe};if(cell)columns[key]=value;else columns.set(key,value);return value;
 }
 function gradient(x,z){
  const key=x+','+z;if(gradients.has(key))return gradients.get(key);
  let dx=0,dz=0,safe=true;
  for(let k=-1;k<=1;k++){
   const w=k===0?2:1,a=column(x-4,z+k*4),b=column(x+4,z+k*4),c=column(x+k*4,z-4),d=column(x+k*4,z+4);
   safe&&=a.safe&&b.safe&&c.safe&&d.safe;dx+=(b.h-a.h)*w;dz+=(d.h-c.h)*w;
  }
  // Keep hard height discontinuities out of the smoothing support, including narrow cliffs between metre-grid samples.
  for(let k=-4;k<4&&safe;k++)for(const axis of [0,1]){
   const a=column(x+(axis===0?k:0),z+(axis===1?k:0)),b=column(x+(axis===0?k+1:0),z+(axis===1?k+1:0));
   if(!a.safe||!b.safe||Math.abs(a.h-b.h)>2)safe=false;
  }
  const value=safe?[dx/32,dz/32]:null;gradients.set(key,value);return value;
 }
 return (x,y,z,pattern,occupancy,index)=>{
  const original=pattern.normal;if(original[1]<.5)return original;
  let low=Infinity,high=-Infinity;
  for(const dx of [0,1])for(const dz of [0,1]){
   const c=column(x+dx,z+dz);if(!c.safe)return original;low=Math.min(low,c.h);high=Math.max(high,c.h);
  }
  const height=y+.5+pattern.fraction[1];if(high-low>2||height<low-.5||height>high+.5)return original;
  sourceSamples||=new Uint16Array(34**3);knownSamples||=new Uint8Array(34**3);
  for(const [dx,dy,dz,offset] of corners){
   const at=index+offset,value=occupancy[at];if(isLiquidVoxel(value))return original;
   if(!knownSamples[at]){sourceSamples[at]=source.getVoxel(x+dx,y+dy,z+dz);knownSamples[at]=1;}
   if(value!==sourceSamples[at])return original;
  }
  const px=(x+pattern.fraction[0])/4,pz=(z+pattern.fraction[2])/4,gx=Math.floor(px),gz=Math.floor(pz),tx=px-gx,tz=pz-gz;
  let dx=0,dz=0;
  for(let b=0;b<2;b++)for(let a=0;a<2;a++){
   const g=gradient((gx+a)*4,(gz+b)*4);if(!g)return original;
   const w=(a?tx:1-tx)*(b?tz:1-tz);dx+=g[0]*w;dz+=g[1]*w;
  }
  const length=Math.hypot(dx,1,dz);return [dx===0?0:-dx/length,1/length,dz===0?0:-dz/length];
 };
}
