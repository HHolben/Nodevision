// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionEditing/Geometry.mjs
// Sparse construction serialization preserves material identity without allocating or scanning an enclosing excavation box.
import {coordinate,voxel} from '../SessionVoxels/SessionLayer.mjs';
import {materialOf,LIMITS} from '../ConstructionCapture/Region.mjs';
export function collectGeometry(baseline,layer,offset=[0,0,0]){
 const effective=new Map(baseline);for(const {at,value} of layer.entries()){if(value)effective.set(at.join(','),value);else effective.delete(at.join(','));}
 if(effective.size>LIMITS.occupied)throw Error('Construction exceeds 65,536 occupied voxels');
 const cells=[],materials=[],indices=new Map();for(const [key,value] of effective){const at=coordinate(key.split(',').map(Number));voxel(value);if(value.solid===false||['liquid','gas'].includes(value.matterState))throw Error('Construction requires solid voxels');const m=materialOf(value),k=JSON.stringify(m);let material=indices.get(k);if(material===undefined){material=materials.length;if(material>=LIMITS.materials)throw Error('Construction exceeds 128 material layers');materials.push(m);indices.set(k,material);}cells.push({at:at.map((n,i)=>n-offset[i]),rgba:value.rgba.slice(),material});}return {cells,materials};
}
export function geometryConflicts(region,offset,position,volumes,terrain){
 return region.cells.filter(c=>{const local=c.at.map((n,i)=>n+offset[i]);if(volumes.some(v=>v.active&&local.every((n,i)=>n>=v.position[i]&&n<v.position[i]+v.size[i])))return false;return terrain(local.map((n,i)=>position[i]+(n+.5)*.25));});
}
