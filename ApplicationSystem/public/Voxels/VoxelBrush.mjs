// Nodevision/ApplicationSystem/public/Voxels/VoxelBrush.mjs
// Validates grid-aligned brush settings and expands cubic or spherical stamps with axis symmetry.
import { position,key } from './VoxelModel.mjs';
export const defaultBrush=()=>({size:1,shape:'box',symmetry:[],axis:'free',plane:0});
export function brushSettings(input,current=defaultBrush()){
 const result={...current,...input};if(!Number.isInteger(result.size)||result.size<1||result.size>16)throw Error('Brush size must be an integer from 1 to 16');if(!['box','sphere'].includes(result.shape))throw Error('Brush shape must be box or sphere');if(!Array.isArray(result.symmetry)||result.symmetry.some(a=>!['x','y','z'].includes(a)))throw Error('Symmetry axes must be x, y or z');if(!['free','x','y','z'].includes(result.axis)||!Number.isInteger(result.plane)||Math.abs(result.plane)>1000000)throw Error('Invalid axis constraint');return result;
}
export function brushPoints(at,settings){
 position(at);const s=brushSettings(settings),center=at.slice(),axis=['x','y','z'].indexOf(s.axis);if(axis>=0)center[axis]=s.plane;const lo=-Math.floor((s.size-1)/2),hi=lo+s.size-1,points=new Map();
 for(let z=lo;z<=hi;z++)for(let y=lo;y<=hi;y++)for(let x=lo;x<=hi;x++){
  if(s.shape==='sphere'&&[x,y,z].reduce((n,v)=>n+(v-(lo+hi)/2)**2,0)>(s.size/2)**2)continue;let variants=[[center[0]+x,center[1]+y,center[2]+z]];for(const name of new Set(s.symmetry)){const i=['x','y','z'].indexOf(name);variants=variants.concat(variants.map(p=>p.map((v,j)=>j===i?-v:v)));}for(const p of variants){position(p);points.set(key(p),p);}
 }return [...points.values()];
}
