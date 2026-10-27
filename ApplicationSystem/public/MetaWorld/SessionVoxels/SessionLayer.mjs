// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/SessionLayer.mjs
// Sparse transient opinions with atomic bounded transactions; undefined inherits and null explicitly empties a cell.
import {brushPoints,brushSettings} from '../../Voxels/VoxelBrush.mjs';
export const MAX_BATCH=16384,MAX_CELLS=131072;
const key=p=>p.join(','),tile=p=>p.map(n=>Math.floor(n/32)).join(','),index=p=>p.map(n=>((n%32)+32)%32).reduce((n,v,i)=>n+v*32**i,0);
export function coordinate(p){if(!Array.isArray(p)||p.length!==3||p.some(n=>!Number.isInteger(n)||Math.abs(n)>1000000))throw Error('Expected three integer world-grid coordinates within ±1000000');return p;}
export function voxel(value){if(value===null||value===undefined)return value;if(!value||typeof value.materialId!=='string'||!value.materialId||!Array.isArray(value.rgba)||value.rgba.length!==4||value.rgba.some(n=>!Number.isInteger(n)||n<0||n>255)||!value.rgba[3])throw Error('Occupied voxels require materialId and nonzero RGBA bytes');return Object.freeze({...structuredClone(value),rgba:Object.freeze(value.rgba.slice()),solid:value.solid!==false});}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createSessionLayer({persistent=()=>null,contains=()=>true,changed=()=>{},record=()=>{}}={}){
 const chunks=new Map(),columns=new Map();let count=0,disposed=false,stroke=null,revision=0;
 const opinion=p=>chunks.get(tile(p))?.get(index(p))?.value;
 function write(p,value){const t=tile(p),i=index(p);let chunk=chunks.get(t);const old=chunk?.has(i);if(value===undefined){if(old){chunk.delete(i);count--;if(!chunk.size){chunks.delete(t);const [x,,z]=t.split(','),col=columns.get(`${x},${z}`);col.delete(t);if(!col.size)columns.delete(`${x},${z}`);}}return;}
  if(!chunk){chunks.set(t,chunk=new Map());const [x,,z]=t.split(','),c=`${x},${z}`;if(!columns.has(c))columns.set(c,new Set());columns.get(c).add(t);}if(!old)count++;chunk.set(i,{at:p.slice(),value});}
 const apply=changes=>{revision++;for(const c of changes)write(c.at,c.value);changed(changes.map(c=>c.at));};
 function commit(changes){if(!changes.length)return false;const before=changes.map(c=>({at:c.at,value:opinion(c.at)}));apply(changes);if(stroke){for(let i=0;i<changes.length;i++){const k=key(changes[i].at);if(!stroke.has(k))stroke.set(k,before[i]);}return true;}record({kind:'session',undo:()=>apply(before),redo:()=>apply(changes)});return true;}
 const api={get revision(){return revision;},get count(){return count;},get disposed(){return disposed;},opinion,persistent:p=>persistent(coordinate(p)),effective(p){const v=opinion(coordinate(p));return v===undefined?persistent(p):v;},
  batch(input){if(disposed)throw Error('Voxel session is closed');if(!Array.isArray(input)||input.length>MAX_BATCH)throw Error('Voxel transaction exceeds '+MAX_BATCH+' cells');const unique=new Map();for(const c of input){const at=coordinate(c.at).slice();if(!contains(at))throw Error('Cell is outside the supported terrain bounds');unique.set(key(at),{at,value:voxel(c.value)});}
   const changes=[...unique.values()].filter(c=>!equal(opinion(c.at),c.value));let next=count;for(const c of changes)next+=(c.value!==undefined?1:0)-(opinion(c.at)!==undefined?1:0);if(next>MAX_CELLS)throw Error('Temporary voxel limit reached');if(stroke&&new Set([...stroke.keys(),...changes.map(c=>key(c.at))]).size>MAX_BATCH)throw Error('Stroke exceeds '+MAX_BATCH+' cells');return commit(changes);},
  edit(tool,points,value){if(disposed)throw Error('Voxel session is closed');if(!Array.isArray(points)||points.length>MAX_BATCH)throw Error('Voxel operation exceeds the transaction limit');const changes=[];for(const at of points){coordinate(at);if(!contains(at))throw Error('Cell is outside the supported terrain bounds');const current=api.effective(at);if(tool==='add'||tool==='brush'){if(!current)changes.push({at,value});}else if(tool==='erase'){if(current)changes.push({at,value:persistent(at)?null:undefined});}else if(tool==='paint'){if(current)changes.push({at,value});}else if(tool==='revert')changes.push({at,value:undefined});else throw Error('Unknown voxel tool');}return api.batch(changes);},
  begin(){if(stroke)throw Error('A voxel stroke is already active');stroke=new Map();},
  finish(){if(!stroke)return false;const before=[...stroke.values()],after=before.map(c=>({at:c.at,value:opinion(c.at)}));stroke=null;if(!before.length)return false;record({kind:'session',undo:()=>apply(before),redo:()=>apply(after)});return true;},
  cancel(){if(!stroke)return;const before=[...stroke.values()];stroke=null;apply(before);},
  clear(){api.finish();const all=[...chunks.values()].flatMap(c=>[...c.values()].map(v=>({at:v.at,value:undefined})));return commit(all);},
  promotion(bounds){api.finish();const before=[...api.entries()].filter(c=>c.at.every((n,i)=>n>=bounds.min[i]&&n<bounds.max[i])).map(c=>({at:c.at.slice(),value:c.value})),after=before.map(c=>({at:c.at,value:undefined}));return {undo:()=>apply(before),redo:()=>apply(after),count:before.length};},
  *entries(){for(const c of chunks.values())yield* c.values();},
  column(x,z){return [...(columns.get(`${x},${z}`)||[])].map(t=>Number(t.split(',')[1]));},
  dispose(){disposed=true;chunks.clear();columns.clear();count=0;stroke=null;}
 };return api;
}
export function strokePoints(from,to,settings){coordinate(to);from=from||to;coordinate(from);brushSettings(settings);const distance=Math.max(...to.map((v,i)=>Math.abs(v-from[i])));if(distance>1024)throw Error('Pointer stroke is too long');const points=new Map();for(let i=0;i<=distance;i++){const at=to.map((v,a)=>Math.round(from[a]+(v-from[a])*(distance?i/distance:0)));for(const p of brushPoints(at,settings)){points.set(key(p),p);if(points.size>MAX_BATCH)throw Error('Brush exceeds '+MAX_BATCH+' cells');}}return [...points.values()];}
