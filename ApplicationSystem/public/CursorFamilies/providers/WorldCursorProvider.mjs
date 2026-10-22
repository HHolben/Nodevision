// Nodevision/ApplicationSystem/public/CursorFamilies/providers/WorldCursorProvider.mjs
// This provider reflects inventory-owned world tools without making pointer lock, hover, or crosshair presentation a separate active-tool state.
import { VOXEL_WORLD_TOOL_ID } from '../../MetaWorld/ProceduralVoxelWorld/VoxelWorldToolState.mjs';
export function createCursorFamilyProvider() {
  return {id:'world-cursor-tools',withContext(context){return {...this,context};},
    getTools(){return [{id:'gameplay',label:'World Interaction',glyph:'⊕',kind:'interaction',readOnly:true},
      {id:'path',label:'Path',glyph:'〰',kind:'interaction',readOnly:true},
      {id:VOXEL_WORLD_TOOL_ID,label:'Voxel World',glyph:'▦',kind:'interaction',readOnly:true}];},
    getActiveToolId(){if(window.VRWorldContext?.pathDrawing||window.VRWorldContext?.inventory?.getSelectedItem()?.id==='path')return 'path';return window.VRWorldContext?.inventory?.getSelectedItem()?.id === VOXEL_WORLD_TOOL_ID ? VOXEL_WORLD_TOOL_ID : 'gameplay';},
    getFallbackToolId(){return 'gameplay';}};
}
