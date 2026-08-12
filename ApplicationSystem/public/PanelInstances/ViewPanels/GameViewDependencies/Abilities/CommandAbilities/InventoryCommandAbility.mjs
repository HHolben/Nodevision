// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/InventoryCommandAbility.mjs
// This file defines inventory command handling for the Game View update frame. It handles menu toggles, hotbar selection, hand switching, and inventory-menu navigation latches.

import { installMovementApi } from "../movementContext.mjs";

export function installInventoryCommandAbility(ctx) {
  function handleInventoryToggles(inputState, inventory) {
    if (inputState.openInventory && !ctx.inventoryToggleLatch) {
      ctx.inventoryToggleLatch = true;
      inventory?.toggleMenu?.();
    } else if (!inputState.openInventory) ctx.inventoryToggleLatch = false;
    if (inputState.handSwitch && !ctx.inventoryHandSwitchLatch) {
      ctx.inventoryHandSwitchLatch = true;
      inventory?.switchHand?.();
    } else if (!inputState.handSwitch) ctx.inventoryHandSwitchLatch = false;
    if (Number.isInteger(inputState.hotbarSlot) && ctx.hotbarSlotLatch !== inputState.hotbarSlot) {
      ctx.hotbarSlotLatch = inputState.hotbarSlot;
      inventory?.selectDominantSlot?.(inputState.hotbarSlot);
    } else if (!Number.isInteger(inputState.hotbarSlot)) ctx.hotbarSlotLatch = null;
  }

  function handleInventoryMenu(inputState, inventory) {
    if (!inventory?.isMenuOpen?.()) {
      clearInventoryMenuLatches();
      return false;
    }
    handleMenuDirection("inventoryMenuUpLatch", inputState.inventoryMenuUp, () => inventory.moveSelection?.(0, -1));
    handleMenuDirection("inventoryMenuDownLatch", inputState.inventoryMenuDown, () => inventory.moveSelection?.(0, 1));
    handleMenuDirection("inventoryMenuLeftLatch", inputState.inventoryMenuLeft, () => inventory.moveSelection?.(-1, 0));
    handleMenuDirection("inventoryMenuRightLatch", inputState.inventoryMenuRight, () => inventory.moveSelection?.(1, 0));
    handleMenuDirection("inventoryMenuConfirmLatch", inputState.inventoryMenuConfirm, () => inventory.applySelection?.());
    return true;
  }

  function handleMenuDirection(latchName, active, run) {
    if (active && !ctx[latchName]) {
      ctx[latchName] = true;
      run();
    } else if (!active) ctx[latchName] = false;
  }

  function clearInventoryMenuLatches() {
    ctx.inventoryMenuUpLatch = false;
    ctx.inventoryMenuDownLatch = false;
    ctx.inventoryMenuLeftLatch = false;
    ctx.inventoryMenuRightLatch = false;
    ctx.inventoryMenuConfirmLatch = false;
  }

  return installMovementApi(ctx, {
    handleInventoryToggles,
    handleInventoryMenu,
    handleMenuDirection,
    clearInventoryMenuLatches
  });
}
