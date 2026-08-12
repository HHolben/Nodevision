// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/TerrainPaintAbility.mjs
// This file defines the Terrain Generator selected-item ability for Game View. It paints active terrain-tool brushes at the current surface hit or opens the terrain panel when no paint action is active.

import { installMovementApi } from "../movementContext.mjs";

export function installTerrainPaintAbility(ctx) {
  const { movementState, terrainToolController } = ctx;

  function tryPaintTerrain() {
    if (movementState.worldMode === "2d") return false;
    if (!ctx.api.canUseAbility("allowToolUse")) return false;
    const terrainTool = terrainToolController || window.VRWorldContext?.terrainToolController;
    if (!terrainTool?.isPaintModeActive?.()) return false;
    const hit = ctx.api.getTerrainPaintHit();
    if (!hit?.point) {
      terrainTool?.notifyPaintMiss?.();
      return true;
    }
    terrainTool.paintAtPoint?.(hit.point);
    return true;
  }

  function useTerrainGenerator() {
    if (tryPaintTerrain()) return true;
    if (movementState.terrainToolLatch) return true;
    movementState.terrainToolLatch = true;
    const terrainTool = terrainToolController || window.VRWorldContext?.terrainToolController;
    terrainTool?.openPanel?.();
    return true;
  }

  ctx.api.registerSelectedItemAction("terrain-generator", { use: useTerrainGenerator });
  return installMovementApi(ctx, { tryPaintTerrain, useTerrainGenerator });
}
