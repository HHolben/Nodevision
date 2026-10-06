// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/PineShape.mjs
// This module derives voxel-scale pine dimensions and samples tapered wood, bark, branches and evergreen tiers without renderer or catalog dependencies.
import { hash } from '../SeededVoxelNoise.mjs';
import { PINE_WOOD, PINE_BARK, PINE_FOLIAGE } from '../VoxelMaterialIds.mjs';
export const PINE_SHAPE = Object.freeze({ minHeight:28, maxHeight:44, maxRadius:12 });
export function pineParameters(seed) {
  const r=n=>hash(n,19,seed);
  const height=Math.min(PINE_SHAPE.maxHeight,PINE_SHAPE.minHeight+Math.floor(r(1)*(PINE_SHAPE.maxHeight-PINE_SHAPE.minHeight+1)));
  return { height, trunkRadius:1.6+r(2)*.7, crownStart:Math.floor(height*(.28+r(3)*.1)),
    crownRadius:7+r(4)*3, taper:.75+r(5)*.5, phase:r(6)*Math.PI*2, asymmetry:.3+r(7)*.5 };
}
export function samplePineVoxel(x,y,z,seed,p) {
  if(y<0||y>=p.height||Math.abs(x)>PINE_SHAPE.maxRadius||Math.abs(z)>PINE_SHAPE.maxRadius)return 0;
  const trunk=p.trunkRadius*(1-.65*y/p.height),distance=Math.hypot(x,z);
  if(distance<=trunk)return distance<=trunk-1?PINE_WOOD:PINE_BARK;
  if(y<p.crownStart)return 0;
  const t=(y-p.crownStart)/(p.height-p.crownStart),tier=(y-p.crownStart)%6;
  const radius=p.crownRadius*Math.pow(1-t,p.taper);
  // Four narrow branch spokes per tier are bark-only at this quarter-metre resolution.
  if(tier<2&&distance<radius*.85){
    const angle=p.phase+Math.floor((y-p.crownStart)/6)*.7;
    const a=x*Math.cos(angle)+z*Math.sin(angle),b=z*Math.cos(angle)-x*Math.sin(angle);
    if(Math.min(Math.abs(a),Math.abs(b))<.65)return PINE_BARK;
  }
  const dx=x-p.asymmetry*Math.sin(y*.21+p.phase),dz=z-p.asymmetry*Math.cos(y*.17+p.phase);
  const crownDistance=Math.hypot(dx,dz),edge=radius*(1-.32*tier/6);
  if(crownDistance>Math.max(.65,edge))return 0;
  if(crownDistance>edge*.65&&hash(x+y*13,z,seed)<.035)return 0;
  return PINE_FOLIAGE;
}
