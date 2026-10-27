// Nodevision/ApplicationSystem/public/MetaWorld/Constructions/Definition.mjs
// Versioned Nodevision construction definitions, stable prim paths and Notebook-relative references; not USD serialization.
export const SIZE=.25;
const vector=(v,label,positive=false)=>{if(!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isSafeInteger(n)||Math.abs(n)>4000000||(positive&&n<1)))throw Error(label+' requires three bounded integer voxel values');return v.slice();};
const identity=(s,label)=>{if(typeof s!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(s))throw Error(label+' requires a stable alphanumeric identity');return s;};
export function validateConstruction(input){
 if(input?.schema!=='nodevision-construction'||input.version!==2)throw Error('Unsupported construction schema/version');
 const id=identity(input.id,'Construction'),position=vector(input.position||[0,0,0],'Position');
 if(input.voxelSize!==SIZE)throw Error('Construction version 2 requires 0.25-meter voxels');
 if('footprint' in input)throw Error('Obsolete footprint schema');
 if(input.rotation?.some(n=>n!==0)||input.scale?.some(n=>n!==1))throw Error('Terrain volumes must remain axis aligned and unscaled');
 if(!Array.isArray(input.terrainVolumes)||input.terrainVolumes.length>256)throw Error('Expected at most 256 terrain volumes');
 const terrainVolumes=input.terrainVolumes.map(validateVolume);if(new Set(terrainVolumes.map(v=>v.id)).size!==terrainVolumes.length)throw Error('Duplicate terrain volume identity');
 const gridOrigin=input.gridOrigin||[0,0,0];if(!Array.isArray(gridOrigin)||gridOrigin.length!==3||gridOrigin.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6))throw Error('Invalid grid origin');
 if(input.metadata!==undefined&&(!input.metadata||typeof input.metadata!=='object'||Array.isArray(input.metadata)))throw Error('Construction metadata must be a JSON object');
 const geometry=input.geometry==null?null:{...input.geometry,source:reference(input.geometry.source,'.gox'),position:vector(input.geometry.position||[0,0,0],'Geometry position')};
 return {...structuredClone(input),schema:'nodevision-construction',version:2,id,name:String(input.name||'Construction'),voxelSize:SIZE,gridOrigin:gridOrigin.slice(),position,
  terrainVolumes,geometry};
}
export function reference(value,extension){if(typeof value!=='string'||!value||value.includes('\\')||/[?#%\u0000-\u001f]/.test(value)||value.startsWith('//')||/^[a-z]+:/i.test(value)||!value.toLowerCase().endsWith(extension))throw Error('Expected a Notebook '+extension+' reference');return value;}
export function resolveReference(owner,ref){
 const clean=String(owner).replace(/^\/?Notebook\//,'').replace(/^\//,'');
 if(!clean||clean.split('/').some(p=>p==='..'))throw Error('Save the world in Notebook before linking a construction');
 const url=new URL(ref.startsWith('/Notebook/')?ref:ref.startsWith('/')?'/Notebook'+ref:ref,'https://nodevision.local/Notebook/'+clean);
 if(url.origin!=='https://nodevision.local'||!url.pathname.startsWith('/Notebook/'))throw Error('Asset reference escapes Notebook');return decodeURIComponent(url.pathname.slice(10));
}
export function validateVolume(v){
 if(v?.type!=='TerrainCut'||v.shape!=='box'||v.operation!=='subtract'||typeof v.active!=='boolean')throw Error('Expected an active boolean, subtractive TerrainCut box');
 const position=vector(v.position,'Volume position'),size=vector(v.size,'Volume size',true);vector(position.map((n,i)=>n+size[i]),'Volume boundary');
 return {...structuredClone(v),id:identity(v.id,'Terrain volume'),position,size};
}
export function volumeBounds(def,v){const min=def.position.map((n,i)=>def.gridOrigin[i]+(n+v.position[i])*SIZE);return {min,max:min.map((n,i)=>n+v.size[i]*SIZE)};}
export const terrainBounds=def=>def.terrainVolumes.filter(v=>v.active).map(v=>volumeBounds(def,v));
export function unionBounds(boxes,fallback=[0,0,0]){return boxes.length?{min:[0,1,2].map(i=>Math.min(...boxes.map(b=>b.min[i]))),max:[0,1,2].map(i=>Math.max(...boxes.map(b=>b.max[i])))}:{min:fallback.slice(),max:fallback.slice()};}
export function constructionBounds(def){return unionBounds(def.terrainVolumes.map(v=>volumeBounds(def,v)),def.position.map((n,i)=>def.gridOrigin[i]+n*SIZE));}
export const volumesOverlap=(a,b)=>terrainBounds(a).some(x=>terrainBounds(b).some(y=>intersects(x,y)));
export const intersects=(a,b)=>a.min.every((v,i)=>v<b.max[i]&&a.max[i]>b.min[i]);
export const inside=(box,p)=>p.every((v,i)=>v>=box.min[i]&&v<box.max[i]);
export function scenePrimitives(instance,def){
 const path='/World/Constructions/c_'+identity(instance.id,'Instance'),transform={translation:def.position.map((n,i)=>def.gridOrigin[i]+n*SIZE),rotation:[0,0,0],scale:[1,1,1]};
 return [{id:instance.id,path,parent:'/World/Constructions',type:'Construction',name:def.name,transform,active:instance.active!==false,visible:instance.visible!==false,source:instance.constructionFile,attributes:{voxelSize:SIZE},metadata:def.metadata||{}},
 {id:instance.id+':volumes',path:path+'/TerrainVolumes',parent:path,type:'Scope'},
 ...def.terrainVolumes.map(v=>({id:instance.id+':'+v.id,path:path+'/TerrainVolumes/cut_'+v.id,parent:path+'/TerrainVolumes',type:'TerrainCut',owner:instance.id,active:v.active,transform:{translation:v.position.map(n=>n*SIZE)},attributes:structuredClone(v)})),
 ...(def.geometry?[{id:instance.id+':geometry',path:path+'/Geometry',parent:path,type:'VoxelAsset',source:def.geometry.source,attributes:{position:def.geometry.position.slice(),axisMapping:'GOX Z-up to world Y-up'}}]:[])];
}
