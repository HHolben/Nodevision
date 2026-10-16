// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CraftAbilities/VoxelWorldToolAbility.mjs
// This ability adapts the canonical procedural-world insertion bridge to existing inventory use and adjust actions. Its lightweight bounds preview is editor-only; terrain generation, history, and serialization remain owned by the world bridge.
import { setStatus } from '/StatusBar.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { voxelWorldToolAllowed, openVoxelWorldToolSettings } from '/MetaWorld/ProceduralVoxelWorld/VoxelWorldTool.mjs';
import { VOXEL_WORLD_TOOL_ID, voxelWorldPlacementDefinition } from '/MetaWorld/ProceduralVoxelWorld/VoxelWorldToolState.mjs';
import { installMovementApi } from '../movementContext.mjs';
export function installVoxelWorldToolAbility(ctx) {
  let preview = null, inventory = null, unsubscribe = null;
  const selected = () => window.VRWorldContext?.inventory?.getSelectedItem()?.id === VOXEL_WORLD_TOOL_ID;
  const allowed = () => window.VRWorldContext?.scene === ctx.scene && voxelWorldToolAllowed(ctx.movementState) && ctx.api.canUseAbility('allowPlace');
  function clearPreview() {
    if (!preview) return;
    preview.removeFromParent(); preview.geometry.dispose(); preview.material.dispose(); preview = null;
  }
  function synchronizeInventory() {
    const next = window.VRWorldContext?.inventory;
    if (inventory === next) return;
    unsubscribe?.(); clearPreview(); inventory = next;
    unsubscribe = inventory?.subscribeSelection?.(() => { clearPreview(); });
  }
  function updateVoxelWorldPreview({ snapToGrid = false, cleanupOnly = false } = {}) {
    synchronizeInventory();
    const bridge = getActiveMetaWorldLayerBridge();
    if (!selected() || !allowed() || !bridge?.addVoxelWorld || bridge.voxelWorldDialog || inventory?.isMenuOpen()) { clearPreview(); return; }
    if (cleanupOnly) return;
    const hit = ctx.api.getPlacementHit();
    if (!hit?.point) { clearPreview(); return; }
    const def = voxelWorldPlacementDefinition(bridge, hit.point, snapToGrid);
    if (!preview) {
      preview = new ctx.THREE.Box3Helper(new ctx.THREE.Box3(), 0x74d4ff);
      preview.name = 'Voxel World placement preview'; preview.userData.isEditorHelper = true;
      preview.raycast = () => {}; ctx.scene.add(preview);
    }
    const [x,y,z] = def.position, [width,height,length] = def.size;
    preview.box.min.set(x,y+def.heightLimits.min,z);
    preview.box.max.set(x+width,y+def.heightLimits.min+height,z+length);
    preview.updateMatrixWorld(true);
  }
  function useVoxelWorld({ snapToGrid = false } = {}) {
    if (!allowed()) return true;
    const bridge = getActiveMetaWorldLayerBridge();
    if (!bridge?.addVoxelWorld || bridge.voxelWorldDialog || window.VRWorldContext.inventory?.isMenuOpen()) return true;
    try {
      const def = voxelWorldPlacementDefinition(bridge, ctx.api.getPlacementHit()?.point, snapToGrid);
      const result = bridge.addVoxelWorld(def);
      if (result) { clearPreview(); window.VRWorldContext.inventory.equipItemToActiveHand(null); setStatus('Voxel World placed'); }
    } catch (error) { setStatus('Voxel World', error.message); }
    return true;
  }
  function adjustVoxelWorld() {
    if (allowed()) openVoxelWorldToolSettings();
    return true;
  }
  function cancelVoxelWorld() {
    clearPreview(); window.VRWorldContext?.inventory?.equipItemToActiveHand(null); return true;
  }
  ctx.api.registerSelectedItemAction(VOXEL_WORLD_TOOL_ID, {use:useVoxelWorld, adjust:adjustVoxelWorld, attack:cancelVoxelWorld});
  return installMovementApi(ctx, {updateVoxelWorldPreview, useVoxelWorld, adjustVoxelWorld, cancelVoxelWorld});
}
