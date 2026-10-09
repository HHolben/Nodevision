// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/TreeVariants.mjs
// This module derives seeded standing dead trees and supported fallen trunks from the existing species while retaining canonical wood and bark identities.
import { hash } from '../SeededVoxelNoise.mjs';
import { treeMaterialIndices } from '../VoxelMaterialIds.mjs';

// Cardinal orientations keep quarter-metre trunk cores continuous across chunk boundaries.
export function fallenTree(tree,base) {
  const [wood,bark]=treeMaterialIndices(tree.species),[x,y,z]=tree.origin;
  const direction=Math.floor(hash(5,83,tree.seed)*4),[dx,dz]=[[1,0],[0,1],[-1,0],[0,-1]][direction];
  const length=Math.floor(tree.parameters.height*.8),radius=tree.parameters.trunkRadius;
  const heights=Array.from({length:length+1},(_,i)=>base.getTerrainHeight(x+dx*i,z+dz*i));
  const slope=(heights[length]-y)/length;
  const residual=heights.map((h,i)=>h-y-slope*i),lift=Math.max(...residual);
  // Reject unsupported logs over gullies and steep ground rather than leaving floating trunks.
  if(Math.abs(slope)>.35||lift-Math.min(...residual)>2)return null;
  for(let i=0;i<=length;i++)if(heights[i]<(base.getWaterTop?.(x+dx*i,z+dz*i)??72))return null;
  const padding=Math.ceil(radius+4),startY=y+radius+lift;
  const min=[Math.min(x,x+dx*length)-padding,Math.floor(Math.min(startY,startY+slope*length)-padding),Math.min(z,z+dz*length)-padding];
  const max=[Math.max(x,x+dx*length)+padding+1,Math.ceil(Math.max(startY,startY+slope*length)+padding+1),Math.max(z,z+dz*length)+padding+1];
  if(min.some(v=>v<0)||max.some((v,a)=>v>base.dimensions[a]))return null;
  return {...tree,variant:'fallen',min,max,length,direction,sample(vx,vy,vz){
    const along=(vx-x)*dx+(vz-z)*dz,across=-(vx-x)*dz+(vz-z)*dx;
    if(along<0||along>length)return 0;
    const up=vy-(startY+slope*along),r=radius*(1-.35*along/length),distance=Math.hypot(across,up);
    if(distance<=r)return along===0||along===length||distance<=r-1?wood:bark;
    // Short alternating bare branch stubs distinguish fallen trees from uniform cylinders.
    const sign=Math.floor(along/7)%2?1:-1;
    if(along>4&&along<length-2&&along%7===0&&Math.abs(up)<.8&&across*sign>0&&Math.abs(across)<r+3)return bark;
    return 0;
  }};
}

export function applyTreeVariant(tree,base) {
  const choice=hash(41,97,tree.seed);
  if(choice<.1){const fallen=fallenTree(tree,base);if(fallen)return fallen;}
  if(choice<.22){
    const [wood,bark]=treeMaterialIndices(tree.species),sample=tree.sample;
    return {...tree,variant:'dead',sample(x,y,z){const id=sample(x,y,z);return id===wood||id===bark?id:0;}};
  }
  return {...tree,variant:'living'};
}
