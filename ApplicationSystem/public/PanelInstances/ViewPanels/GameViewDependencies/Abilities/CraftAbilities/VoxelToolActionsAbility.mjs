// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CraftAbilities/VoxelToolActionsAbility.mjs
// This file registers Voxel Placer and Voxel Extruder selected-item actions for Game View. It keeps craft tool wiring close to voxel abilities and out of the main movement updater.

import { setStatus } from "/StatusBar.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installVoxelToolActionsAbility(ctx) {
  function adjustVoxelPlacer() {
    return ctx.api.openVoxelPlacerDialog();
  }

  function useVoxelPlacer({ snapToGrid = false } = {}) {
    return ctx.api.tryPlaceVoxel({ snapToGrid });
  }

  function attackVoxelPlacer() {
    return ctx.api.tryDeleteVoxel();
  }

  function useVoxelExtruder({ snapToGrid = false } = {}) {
    return ctx.api.tryExtrudeVoxel({ snapToGrid });
  }

  function attackVoxelExtruder() {
    setStatus("Voxel Extruder only clones voxels with use.");
    return true;
  }

  function adjustVoxelExtruder() {
    setStatus("Voxel Extruder copies the targeted voxel onto the viewed face.");
    return true;
  }

  ctx.api.registerSelectedItemAction(ctx.VOXEL_PLACER_TOOL_ID, {
    adjust: adjustVoxelPlacer,
    use: useVoxelPlacer,
    attack: attackVoxelPlacer
  });
  ctx.api.registerSelectedItemAction(ctx.VOXEL_EXTRUDER_TOOL_ID, {
    use: useVoxelExtruder,
    attack: attackVoxelExtruder,
    adjust: adjustVoxelExtruder
  });

  return installMovementApi(ctx, {
    adjustVoxelPlacer,
    useVoxelPlacer,
    attackVoxelPlacer,
    useVoxelExtruder,
    attackVoxelExtruder,
    adjustVoxelExtruder
  });
}
