// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/PineNeedleBed.mjs
// This module adds small irregular beds of dry pine needles that follow supported ground around pine roots without blocking movement or covering water.
import { hash } from '../SeededVoxelNoise.mjs';
import { PINE_NEEDLES, MOSS_VOXEL } from '../VoxelMaterialIds.mjs';
export function addPineNeedleBed(tree,base) {
  if(tree.species!=='Pine')return tree;
  const [cx,cy,cz]=tree.origin,radius=5+Math.floor(hash(7,31,tree.seed)*3),cells=new Map();
  const min=tree.min.slice(),max=tree.max.slice();
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
    if(Math.hypot(dx,dz)>radius*(.8+.2*hash(dx,dz,tree.seed)))continue;
    const x=cx+dx,z=cz+dz,y=base.getTerrainHeight(x,z);
    if(Math.abs(y-cy)>4||y>=base.dimensions[1]||y<(base.getWaterTop?.(x,z)??72))continue;
    if(![1,2,MOSS_VOXEL].includes(base.getVoxel(x,y-1,z)))continue;
    cells.set(`${x},${z}`,y);
    for(const [a,v] of [x,y,z].entries()){min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v+1);}
  }
  const sample=tree.sample;
  return {...tree,min,max,sample(x,y,z){return sample(x,y,z)||(cells.get(`${x},${z}`)===y?PINE_NEEDLES:0);}};
}
