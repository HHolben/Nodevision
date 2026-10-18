// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/SelectedItemActionAbility.mjs
// This file defines selected-item action dispatch for Game View abilities. It lets each tool register use, attack, or adjust handlers without hard-coding every ability inside the update loop.

import { installMovementApi } from "../movementContext.mjs";

export function installSelectedItemActionAbility(ctx) {
  function getSelectedInventoryItem() {
    return window.VRWorldContext?.inventory?.getSelectedItem?.() || null;
  }

  function getSelectedItemId(item = getSelectedInventoryItem()) {
    return String(item?.id || "").trim().toLowerCase();
  }

  function registerSelectedItemAction(itemId, handlers) {
    if (!itemId || !handlers || typeof handlers !== "object") return;
    ctx.selectedItemActions.set(String(itemId).trim().toLowerCase(), handlers);
  }

  function handleSelectedItemAction(actionName, context = {}) {
    const actionMap = ctx.selectedItemActions.get(getSelectedItemId());
    const handler = actionMap && actionMap[actionName];
    if (typeof handler !== "function") {
      // Held equipment is adjustable without taking over another active tool's
      // command. Prefer the active hand when both equipment items are held.
      const world = window.VRWorldContext;
      if (actionName === "adjust") {
        const held = world?.inventory?.getHeldItems?.() || [];
        const tools = {"flashlight":world?.flashlightTool,"hang-glider":world?.hangGliderTool};
        const selected = getSelectedItemId();
        const id = tools[selected] ? selected : held.find(({item}) => tools[item.id])?.item.id;
        if (id) return tools[id]?.openSettings?.() === true;
      }
      return false;
    }
    return handler(context) !== false;
  }

  function tryUseSelectedTool(context = {}) {
    if (ctx.movementState.worldMode === "2d") return false;
    if (!ctx.api.canUseAbility("allowToolUse")) return false;
    const selected = window.VRWorldContext?.inventory?.getSelectedItem?.();
    if (!selected?.id) return false;
    const selectedUseAction = ctx.selectedItemActions.get(String(selected.id).toLowerCase())?.use;
    if (typeof selectedUseAction !== "function") return false;
    return selectedUseAction(context) !== false;
  }

  return installMovementApi(ctx, {
    getSelectedInventoryItem,
    getSelectedItemId,
    registerSelectedItemAction,
    handleSelectedItemAction,
    tryUseSelectedTool
  });
}
