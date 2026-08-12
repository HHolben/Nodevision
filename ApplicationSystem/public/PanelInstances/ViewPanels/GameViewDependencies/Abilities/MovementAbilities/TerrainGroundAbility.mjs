// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/TerrainGroundAbility.mjs
// This file defines expression-terrain ground sampling for Game View movement. It keeps terrain collider probing separate from the main player movement frame while preserving active-surface state.

import { installMovementApi } from "../movementContext.mjs";

export function installTerrainGroundAbility(ctx) {
  const { colliders, movementState } = ctx;

  function sampleExpressionTerrainGroundLevel(position, fallbackGroundLevel = ctx.groundLevel) {
    let best = fallbackGroundLevel;
    let bestColliderId = null;
    let bestCollider = null;
    if (!Array.isArray(colliders) || !position) {
      movementState.pendingExpressionTerrainColliderId = null;
      movementState.pendingGroundCollider = null;
      return best;
    }
    const footY = position.y - movementState.playerHeight;
    const snapDistance = Number.isFinite(movementState.groundSnapDistance) ? movementState.groundSnapDistance : 0.55;
    const maxStepUp = Math.max(ctx.stepHeight, snapDistance) + 0.05;
    const activeColliderId = movementState.isGrounded === true ? movementState.activeExpressionTerrainColliderId : null;
    const offsets = [[0, 0], [ctx.playerRadius * 0.65, 0], [-ctx.playerRadius * 0.65, 0], [0, ctx.playerRadius * 0.65], [0, -ctx.playerRadius * 0.65]];
    for (const collider of colliders) {
      if (collider?.type !== "expression-heightfield" || typeof collider.sampleGroundY !== "function") continue;
      const colliderId = collider.layerId || collider.target?.uuid || "expression-heightfield";
      const isActiveSurface = activeColliderId && activeColliderId === colliderId;
      for (const [dx, dz] of offsets) {
        const y = collider.sampleGroundY(position.x + dx, position.z + dz);
        const canStepOnto = Number.isFinite(y) && y <= footY + maxStepUp;
        if ((canStepOnto || isActiveSurface) && Number.isFinite(y) && y > best) {
          best = y;
          bestColliderId = colliderId;
          bestCollider = collider;
        }
      }
    }
    movementState.pendingExpressionTerrainColliderId = bestColliderId;
    movementState.pendingGroundCollider = bestCollider;
    return best;
  }

  return installMovementApi(ctx, { sampleExpressionTerrainGroundLevel });
}
