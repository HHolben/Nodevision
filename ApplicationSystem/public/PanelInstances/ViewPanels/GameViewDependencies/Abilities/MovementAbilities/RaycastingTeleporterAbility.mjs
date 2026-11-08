// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/RaycastingTeleporterAbility.mjs
// This adapter registers the teleporter with the existing inventory and selected-item action dispatcher. The movement loop supplies the same mouse and controller input used by other tools, while inventory disposal owns cleanup.
import {worldAuthoringAllowed} from '/MetaWorld/WorldAuthoringPermissions.mjs';
import {installMovementApi} from '../movementContext.mjs';
import {createRaycastingTeleporter, TELEPORTER_ID} from '../../RaycastingTeleporter/Controller.mjs';

export function installRaycastingTeleporterAbility(ctx) {
  const world = window.VRWorldContext;
  if (world?.scene !== ctx.scene || !world.inventory || !worldAuthoringAllowed(ctx.movementState)) return;
  if (!world.inventory.items.some(item => item.id === TELEPORTER_ID)) {
    world.inventory.addItem(TELEPORTER_ID, 1, 'Raycasting Teleporter', {
      category: 'tools', tool: true, autoAssign: false, teleporterRange: 500
    });
  }
  const tool = createRaycastingTeleporter(ctx, world);
  world.raycastingTeleporter = tool;
  // Existing use/controller dispatch remains available alongside primary mouse input.
  const activate = () => { void tool.fire(); return true; };
  ctx.api.registerSelectedItemAction(TELEPORTER_ID, {
    use: activate, attack: activate,
    adjust: () => {
      tool.status.textContent = 'Range: ' + (world.inventory.getSelectedItem()?.teleporterRange ?? 500) + ' metres';
      return true;
    }
  });
  return installMovementApi(ctx, {updateRaycastingTeleporter: tool.update, raycastingTeleportPending: () => tool.pending});
}
