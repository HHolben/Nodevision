// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertVoxelWorld.mjs
// This command equips the canonical Voxel World inventory tool and opens its shared generation settings. The existing use action places the configured terrain through the world authoring bridge.
import { activateVoxelWorldTool } from '../../MetaWorld/ProceduralVoxelWorld/VoxelWorldTool.mjs';
export default function insertVoxelWorld() {
  if(!['Virtual World Editing','VR World Editing'].includes(window.NodevisionState?.currentMode))return false;
  return activateVoxelWorldTool();
}
