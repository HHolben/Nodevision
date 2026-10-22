// Nodevision/ApplicationSystem/public/Voxels/VoxelEmptyFill.mjs
// Empty-space flood fill with explicit finite bounds and leak rejection before any writes.
import { position,key,getVoxel } from './VoxelModel.mjs';
import { region } from './VoxelBuildGeometry.mjs';
export function enclosedRegion(layer,args){
 const {lo,hi}=region(args.min,args.max),start=position(args.at);if(start.some((v,i)=>v<lo[i]||v>hi[i]))throw Error('Fill seed is outside bounds');if(getVoxel(layer,start)[3])return[];const queue=[start],seen=new Set([key(start)]);
 for(let n=0;n<queue.length;n++){const p=queue[n];if(p.some((v,i)=>v===lo[i]||v===hi[i]))throw Error('Empty fill reaches its bounds; region is not enclosed');for(let i=0;i<3;i++)for(const delta of [-1,1]){const q=p.slice();q[i]+=delta;const k=key(q);if(!seen.has(k)&&!getVoxel(layer,q)[3]){seen.add(k);queue.push(q);}}}return queue;
}
