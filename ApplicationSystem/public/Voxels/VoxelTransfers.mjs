// Nodevision/ApplicationSystem/public/Voxels/VoxelTransfers.mjs
// Collision-aware grid transforms shared by live previews and document transactions.
import { point,position,key,getVoxel } from './VoxelModel.mjs';
export function transformed(doc,action,args){
 const axis='xyz'.indexOf(args.axis||'y');if(axis<0)throw Error('Expected x, y or z axis');const offset=position(args.offset||[0,0,0]),points=[...doc.selection].map(point);let origin=args.origin||[0,0,0];
 if(points.length&&['center','bounds'].includes(args.pivot)){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i]);}origin=args.pivot==='bounds'?lo:lo.map((v,i)=>Math.floor((v+hi[i])/2));}position(origin);
 return points.map(p=>{const q=p.map((v,i)=>v-origin[i]);if(action==='rotate'){const a=(axis+1)%3,b=(axis+2)%3,t=q[a];q[a]=-q[b];q[b]=t;}if(action==='mirror')q[axis]=-q[axis];const next=['move','duplicate'].includes(action)?p.map((v,i)=>v+offset[i]):q.map((v,i)=>v+origin[i]);position(next);return{p,next,color:getVoxel(doc.active,p)};});
}
export function transferPlan(doc,items,destination,policy='merge',remove=false){
 if(!['replace','merge','cancel'].includes(policy))throw Error('Invalid collision policy');const sources=new Set(remove&&destination===doc.active?items.map(v=>key(v.p)):[]);
 const blocked=v=>getVoxel(destination,v.next)[3]&&!sources.has(key(v.next));if(policy==='cancel'&&items.some(blocked))throw Error('Destination collision; operation cancelled');
 let accepted=items;if(policy==='merge'){
  // A skipped source stays occupied, so recompute dependent collisions until stable.
  do{const prior=accepted.length;accepted=accepted.filter(v=>!blocked(v));sources.clear();if(remove&&destination===doc.active)for(const v of accepted)sources.add(key(v.p));if(accepted.length===prior)break;}while(accepted.length);
 }
 return accepted;
}
export function transfer(doc,items,destination,policy='merge',remove=false){
 const accepted=transferPlan(doc,items,destination,policy,remove);
 if(remove)for(const v of accepted)doc.write(v.p,[0,0,0,0]);doc.selection.clear();for(const v of accepted){doc.write(v.next,v.color,destination);doc.selection.add(key(v.next));}
}
