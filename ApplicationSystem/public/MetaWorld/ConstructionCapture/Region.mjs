// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionCapture/Region.mjs
// Pure half-open region capture, independent of scene UI and persistence; sparse output with bounded cooperative sampling.
import {coordinate,voxel} from '../SessionVoxels/SessionLayer.mjs';
export const LIMITS=Object.freeze({cells:1048576,occupied:65536,materials:128,axis:512,bytes:67108864});
export function bounds(input){const min=coordinate(input?.min).slice(),max=coordinate(input?.max).slice(),size=max.map((n,i)=>n-min[i]);if(size.some(n=>n<1||n>LIMITS.axis))throw Error('Capture dimensions must be 1–512 voxels');const volume=size.reduce((a,b)=>a*b,1);if(volume>LIMITS.cells)throw Error('Capture exceeds 1,048,576 cells');return {min,max,size,volume};}
export const includes=(b,p)=>p.every((n,i)=>n>=b.min[i]&&n<b.max[i]);
export function materialOf(value){return {materialId:value.materialId,...(value.materialFile?{materialFile:value.materialFile}:{}),solid:value.solid!==false,matterState:value.matterState||'solid'};}
export const equivalent=(a,b)=>!a&&!b||!!a&&!!b&&a.materialId===b.materialId&&(a.solid!==false)===(b.solid!==false)&&a.rgba.every((n,i)=>n===b.rgba[i]);
export async function captureRegion({runtime,footprint,origin,sample=runtime?.session?.effective,contains=runtime?.contains,opinion=runtime?.session?.opinion,signal,progress=()=>{},yieldWork=()=>new Promise(r=>setTimeout(r,0))}){
 const box=bounds(footprint);if(!sample||!contains)throw Error('Capture needs an effective occupancy provider and bounds predicate');if(!Array.isArray(origin)||origin.length!==3||origin.some(n=>!Number.isFinite(n)))throw Error('Capture requires a finite world-grid origin');
 const cells=[],materials=[],indices=new Map();let visited=0,temporary=0;
 for(let cz=Math.floor(box.min[2]/32);cz<=Math.floor((box.max[2]-1)/32);cz++)for(let cy=Math.floor(box.min[1]/32);cy<=Math.floor((box.max[1]-1)/32);cy++)for(let cx=Math.floor(box.min[0]/32);cx<=Math.floor((box.max[0]-1)/32);cx++){
  for(let z=Math.max(box.min[2],cz*32);z<Math.min(box.max[2],(cz+1)*32);z++)for(let y=Math.max(box.min[1],cy*32);y<Math.min(box.max[1],(cy+1)*32);y++)for(let x=Math.max(box.min[0],cx*32);x<Math.min(box.max[0],(cx+1)*32);x++){
   signal?.throwIfAborted();const at=[x,y,z];if(!contains(at))throw Error('Capture extends outside aligned procedural terrain bounds');if(opinion?.(at)!==undefined)temporary++;const value=sample(at);
   if(value){voxel(value);if(value.solid===false||['liquid','gas'].includes(value.matterState))throw Error('Capture currently supports solid voxels only; liquids and non-solid cells cannot be promoted safely');const material=materialOf(value),key=JSON.stringify(material);let index=indices.get(key);if(index===undefined){index=materials.length;if(index>=LIMITS.materials)throw Error('Capture exceeds 128 material layers');indices.set(key,index);materials.push(material);}if(cells.length>=LIMITS.occupied)throw Error('Capture exceeds 65,536 occupied voxels');cells.push({at:at.map((n,i)=>n-box.min[i]),rgba:value.rgba.slice(),material:index});}
   if(++visited%2048===0){progress({visited,total:box.volume,occupied:cells.length,temporary});await yieldWork();}
  }
 }
 signal?.throwIfAborted();progress({visited,total:box.volume,occupied:cells.length,temporary});return {version:1,bounds:box,origin:origin.slice(),cells,materials,temporary,estimatedBytes:cells.length*32,limitations:['GOX preserves RGBA and material identity, but not procedural textures or terrain smoothing. Captured geometry remains voxel-based.']};
}
