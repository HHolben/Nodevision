// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertVoxelWorld.mjs
// This command opens procedural terrain configuration for the active editable Virtual World without changing its objects until Generate is submitted.
import { activateVoxelWorldTool } from '../../MetaWorld/ProceduralVoxelWorld/VoxelWorldTool.mjs';
export default function insertVoxelWorld() {
  if(!['Virtual World Editing','VR World Editing'].includes(window.NodevisionState?.currentMode))return false;
  return activateVoxelWorldTool();
}
