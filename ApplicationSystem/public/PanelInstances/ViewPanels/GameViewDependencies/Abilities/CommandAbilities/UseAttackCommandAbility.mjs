// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/UseAttackCommandAbility.mjs
// This file handles the use and attack command phases for Game View movement. It routes use actions through vehicles, selected tools, terrain, target triggers, consoles, placement, break attacks, and portal travel.

import { installMovementApi } from "../movementContext.mjs";

export function installUseAttackCommandAbility(ctx) {
  const { controls, movementState } = ctx;

  function handleInspectAndCollision({ inspecting, nowMs }) {
    if (inspecting && !movementState.inspectLatch) {
      movementState.inspectLatch = true;
      movementState.lastInspectMs = nowMs;
      if (ctx.api.handleInspectAction()) return true;
    }
    const actionHit = inspecting ? null : ctx.api.findCollisionActionHit(controls.getObject().position, performance.now());
    if (!actionHit) return false;
    for (const action of actionHit.actions) ctx.api.applyCollisionAction(action);
    return true;
  }

  function handleUsePhase({ inputState, using, nowMs }) {
    const lastUseActionMs = Number(movementState.lastUseActionMs || 0);
    const canRepeatUse = movementState.useLatch && (nowMs - lastUseActionMs >= ctx.useRepeatMs);
    if (!using || (movementState.useLatch && !canRepeatUse)) return false;
    if (ctx.grabbedState) return true;
    movementState.useLatch = true;
    movementState.lastUseActionMs = nowMs;
    movementState.attackLatch = true;
    movementState.suppressAttackUntilMs = nowMs + 180;
    if (ctx.api.tryUseFlyingCarpet()) return suppress(nowMs, 220);
    if (ctx.api.handleSelectedItemAction("use", { snapToGrid: !!inputState.snapPlace, nowMs })) return suppress(nowMs, 220);
    if (ctx.api.tryPaintTerrain()) return suppress(nowMs, 220);
    const useHit = ctx.api.findUseTarget(controls.getObject().position, performance.now());
    if (useHit) {
      for (const action of useHit.actions) ctx.api.applyCollisionAction(action);
      return true;
    }
    if (ctx.api.tryUseConsoleTarget()) return suppress(nowMs, 220);
    if (ctx.api.tryUseSelectedTool({ snapToGrid: !!inputState.snapPlace, nowMs })) return suppress(nowMs, 220);
    if (ctx.api.tryPlaceSelectedInventoryItem({ snapToGrid: !!inputState.snapPlace })) return suppress(nowMs, 260);
    return false;
  }

  function handleAttackPhase({ attacking, nowMs }) {
    if (!(attacking && !movementState.attackLatch && nowMs >= (movementState.suppressAttackUntilMs || 0))) return false;
    movementState.attackLatch = true;
    if (ctx.api.handleSelectedItemAction("attack", { nowMs })) return true;
    return ctx.api.tryBreakTargetBlock();
  }

  function handlePassivePortalTravel(inspecting) {
    if (inspecting) return false;
    const portalHit = ctx.api.findPortalHit(controls.getObject().position, performance.now());
    return portalHit ? ctx.api.applyPortalTravel(portalHit) : false;
  }

  function suppress(nowMs, ms) {
    movementState.suppressAttackUntilMs = nowMs + ms;
    return true;
  }

  return installMovementApi(ctx, {
    handleInspectAndCollision,
    handleUsePhase,
    handleAttackPhase,
    handlePassivePortalTravel,
    suppress
  });
}
