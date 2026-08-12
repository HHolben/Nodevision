// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/TemporalManipulatorAbility.mjs
// This file defines the Temporal Manipulator selected-item command for Game View. It opens the temporal panel with a latch so repeated use input does not flood the UI.

import { installMovementApi } from "../movementContext.mjs";

export function installTemporalManipulatorAbility(ctx) {
  const { movementState } = ctx;

  function useTemporalManipulator() {
    if (movementState.temporalToolLatch) return true;
    movementState.temporalToolLatch = true;
    window.VRWorldContext?.temporalManipulatorPanel?.open?.();
    return true;
  }

  ctx.api.registerSelectedItemAction("temporal-manipulator", { use: useTemporalManipulator });
  return installMovementApi(ctx, { useTemporalManipulator });
}
