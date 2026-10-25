// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/Authoring.mjs
// Exposes per-instance representation editing through the existing history and dirty-document bridge, admitting only explicitly registered generated terrain definitions.
import {terrainRepresentation} from './Representation.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
export function installTerrainRepresentation(bridge,{layerEntries,changed}){
  const owned=e=>['procedural-voxel-world','terrain-surface'].includes(e.def.type)&&e.object3d?.userData?.terrainRuntime;
  bridge.getTerrainRepresentations=()=>layerEntries.filter(owned).map(e=>({id:e.id,name:e.def.name||e.id,representation:e.object3d.userData.terrainRuntime.representation}));
  bridge.setTerrainRepresentation=async(id,value)=>{
    if(!worldAuthoringAllowed(globalThis.window?.VRWorldContext?.movementState))throw Error('Terrain representation requires an editable world.');
    const mode=terrainRepresentation(value),entry=layerEntries.find(e=>e.id===id&&owned(e));if(!entry)throw Error('Select a generated terrain instance.');
    const runtime=entry.object3d.userData.terrainRuntime;
    const result=await runtime.setRepresentation(mode,()=>{
      if(!layerEntries.includes(entry)||entry.object3d.userData.terrainRuntime!==runtime||!worldAuthoringAllowed(globalThis.window?.VRWorldContext?.movementState))throw Error('The editable terrain changed during preparation.');
      bridge.recordHistory();
    });
    if(result){entry.def.representation=mode;if(entry.def.terrain)entry.def.terrain.representation=mode;changed(id);}
    return result;
  };
}
