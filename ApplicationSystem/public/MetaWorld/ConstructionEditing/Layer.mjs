// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionEditing/Layer.mjs
// Construction geometry opinions and terrain volumes share focused history while remaining independent spatial sources.
import {createSessionLayer,strokePoints,voxel,coordinate,MAX_BATCH} from '../SessionVoxels/SessionLayer.mjs';
import {collectGeometry} from './Geometry.mjs';
import {validateVolume} from '../Constructions/Definition.mjs';
export function createConstructionEditLayer({baseline,terrainVolumes=[],changed=()=>{},volumesChanged=()=>{}}){
 const undo=[],redo=[];let saved=structuredClone(terrainVolumes),volumes=structuredClone(saved);
 const record=tx=>{undo.push(tx);if(undo.length>80)undo.shift();redo.length=0;};
 const layer=createSessionLayer({persistent:p=>baseline.get(p.join(','))||null,changed,record});
 function validate(value){voxel(value);if(!value||value.solid===false||['liquid','gas'].includes(value.matterState))throw Error('Construction editing supports solid voxels only');return value;}
 function setVolumes(next){volumes=structuredClone(next);volumesChanged(volumes);}
 const api={layer,baseline,contains:p=>{coordinate(p);return true;},
  get terrainVolumes(){return structuredClone(volumes);},get dirty(){return layer.count+Number(JSON.stringify(saved)!==JSON.stringify(volumes));},
  volumes(next){layer.finish();if(next.length>256)throw Error('At most 256 terrain volumes');next=next.map(validateVolume);if(new Set(next.map(v=>v.id)).size!==next.length)throw Error('Duplicate terrain volume identity');const before=volumes;setVolumes(next);record({undo:()=>setVolumes(before),redo:()=>setVolumes(next)});},
  edit(tool,points,value){if(!['add','brush','paint','erase','revert'].includes(tool))throw Error('Unknown voxel tool');if(!Array.isArray(points)||points.length>MAX_BATCH)throw Error('Construction operation exceeds '+MAX_BATCH+' cells');if(['add','brush','paint'].includes(tool))validate(value);const changes=[];for(const at of points){coordinate(at);const current=layer.effective(at);if((tool==='add'||tool==='brush')&&!current||tool==='paint'&&current)changes.push({at,value});else if(tool==='erase'&&current)changes.push({at,value:baseline.has(at.join(','))?null:undefined});else if(tool==='revert')changes.push({at,value:undefined});}return api.batch(changes);},
  batch(changes){if(!Array.isArray(changes)||changes.length>MAX_BATCH)throw Error('Construction transaction exceeds '+MAX_BATCH+' cells');for(const c of changes){coordinate(c.at);if(c.value)validate(c.value);}const opinions=new Map([...layer.entries()].map(c=>[c.at.join(','),c]));for(const c of changes){if(c.value===undefined)opinions.delete(c.at.join(','));else opinions.set(c.at.join(','),c);}collectGeometry(baseline,{entries:()=>opinions.values()});return layer.batch(changes);},
  stroke(tool,from,to,settings,value){return api.edit(tool,strokePoints(from,to,tool==='add'||tool==='pick'?{size:1,shape:'box'}:settings),value);},
  undo(){layer.finish();const tx=undo.pop();if(!tx)return false;tx.undo();redo.push(tx);return true;},
  redo(){layer.finish();const tx=redo.pop();if(!tx)return false;tx.redo();undo.push(tx);return true;},
  accept(){saved=structuredClone(volumes);api.reset();},
  reset(){layer.finish();layer.clear();setVolumes(saved);undo.length=redo.length=0;},
  dispose(){layer.dispose();undo.length=redo.length=0;}
 };return api;
}
