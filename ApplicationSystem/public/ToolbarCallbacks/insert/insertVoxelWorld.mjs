// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertVoxelWorld.mjs
// This command opens procedural terrain configuration for the active editable Virtual World without changing its objects until Generate is submitted.
import { openVoxelWorldDialog } from '../../MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs';
export default function insertVoxelWorld() {
  if(!['Virtual World Editing','VR World Editing'].includes(window.NodevisionState?.currentMode))return false;
  return openVoxelWorldDialog();
}
