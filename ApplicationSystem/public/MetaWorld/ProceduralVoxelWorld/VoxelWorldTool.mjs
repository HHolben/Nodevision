// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldTool.mjs
// This adapter shares activation and settings between the Insert menu and inventory without owning another active-tool flag. The equipped inventory item is authoritative, and the existing voxel dialog edits the shared authoring configuration.
import { getActiveMetaWorldLayerBridge } from '../MetaWorldLayerState.mjs';
import { worldAuthoringAllowed } from '../WorldAuthoringPermissions.mjs';
import { openVoxelWorldDialog } from './VoxelWorldDialog.mjs';
import { VOXEL_WORLD_TOOL_ID, getVoxelWorldToolSettings, setVoxelWorldToolSettings } from './VoxelWorldToolState.mjs';
export function voxelWorldToolAllowed(state = window.VRWorldContext?.movementState) {
  return state?.playerMode === 'creative' && state.worldMode !== '2d' && worldAuthoringAllowed(state);
}
export function openVoxelWorldToolSettings(bridge = getActiveMetaWorldLayerBridge()) {
  const context = window.VRWorldContext;
  if (!bridge?.addVoxelWorld || !voxelWorldToolAllowed() || context?.inventory?.getSelectedItem()?.id !== VOXEL_WORLD_TOOL_ID) return false;
  context.controls?.unlock?.();
  context.movementState.selectedItemAdjustLatch = true;
  return openVoxelWorldDialog(bridge, null, {
    values: getVoxelWorldToolSettings(bridge),
    onConfigure(values) {
      if (!voxelWorldToolAllowed() || context.inventory.getSelectedItem()?.id !== VOXEL_WORLD_TOOL_ID) throw Error('Select Voxel World in Build mode to configure placement.');
      setVoxelWorldToolSettings(bridge, values);
      context.movementState.skipClickFrame = true;
    }
  });
}
export function activateVoxelWorldTool({ settings = true } = {}) {
  const context = window.VRWorldContext;
  if (!voxelWorldToolAllowed() || !getActiveMetaWorldLayerBridge()?.addVoxelWorld || !context?.inventory?.equipItemToActiveHand) return false;
  context.inventory.equipItemToActiveHand(VOXEL_WORLD_TOOL_ID);
  context.inventory.setMenuOpen(false);
  return settings ? openVoxelWorldToolSettings() : true;
}
