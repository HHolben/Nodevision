// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/Command.mjs
// Routes keyboard-accessible toolbar and terminal actions through the same active world authoring bridge without reloading the scene.
import {getActiveMetaWorldLayerBridge} from '../MetaWorldLayerState.mjs';
export async function terrainRepresentationCommand([mode='list',id='']=[]){
  const bridge=getActiveMetaWorldLayerBridge();if(!bridge?.getTerrainRepresentations)throw Error('Open an editable Virtual World first.');
  const terrains=bridge.getTerrainRepresentations();if(mode==='list')return terrains;
  if(!id&&terrains.length===1)id=terrains[0].id;
  if(!id)throw Error('Specify a terrain instance ID; use terrain.representation list to list terrains.');
  return bridge.setTerrainRepresentation(id,mode);
}
