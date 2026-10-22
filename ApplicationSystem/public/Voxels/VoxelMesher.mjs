// Nodevision/ApplicationSystem/public/Voxels/VoxelMesher.mjs
// Builds visible faces per sparse chunk with separate opaque and translucent geometry batches.
import { point, getVoxel } from './VoxelModel.mjs';
const linear = n => (n/=255)<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
export function meshChunk(layer,name) {
  const origin=point(name),data=layer.chunks.get(name),batches=[{position:[],normal:[],color:[]},{position:[],normal:[],color:[]}];if(!data)return batches;
  for(let i=0;i<4096;i++) {
    const alpha=data[i*4+3];if(!alpha)continue;const pos=[origin[0]+i%16,origin[1]+Math.floor(i/16)%16,origin[2]+Math.floor(i/256)],c=[...data.subarray(i*4,i*4+3)].map(linear).concat(alpha/255),out=batches[alpha===255?0:1];
    for(let axis=0;axis<3;axis++)for(const sign of [-1,1]) {
      const neighbor=pos.slice();neighbor[axis]+=sign;const n=getVoxel(layer,neighbor);if(n[3]===255||(alpha<255&&n.every((v,k)=>v===data[i*4+k])))continue;
      const a=(axis+1)%3,b=(axis+2)%3,normal=[0,0,0];normal[axis]=sign;
      const corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{const p=pos.slice();p[axis]+=sign>0?1:0;p[a]+=u;p[b]+=v;return p;});
      for(const index of sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]){out.position.push(...corners[index]);out.normal.push(...normal);out.color.push(...c);}
    }
  }return batches;
}
export function affectedChunks(name) { const p=point(name),names=[name];for(let a=0;a<3;a++)for(const d of [-16,16]){const n=p.slice();n[a]+=d;names.push(n.join(','));}return names; }
