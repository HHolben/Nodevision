// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Controller.mjs
// This inventory-owned tool coordinates transient targeting, cancellable source preparation, and safe player travel. It records one immutable request, revalidates before committing, and never calls authoring or document-history APIs.
import {worldAuthoringAllowed} from '/MetaWorld/WorldAuthoringPermissions.mjs';
import {acquireTarget} from './Target.mjs';
import {prepareDestination, resolveDestination, commitDestination} from './Destination.mjs';
import {createTeleporterVisuals} from './Visuals.mjs';
export const TELEPORTER_ID = 'raycasting-teleporter';

export function createRaycastingTeleporter(ctx, world) {
  const {THREE, movementState: state} = ctx, inventory = world.inventory;
  const ray = new THREE.Raycaster(), visual = createTeleporterVisuals(THREE, ctx.scene);
  const status = document.createElement('output');
  status.setAttribute('role', 'status');
  status.dataset.teleporterStatus = '';
  Object.assign(status.style, {position: 'absolute', left: '50%', top: '58%', transform: 'translateX(-50%)',
    pointerEvents: 'none', color: 'var(--nv-overlay-color, #fff)', background: 'var(--nv-overlay-background, #26333ddd)',
    padding: '4px 8px', borderRadius: '4px', zIndex: '25'});
  world.panel.append(status);
  status.hidden = true;
  let disposed = false, pending = null, aim = null, lastPressed = false, flashUntil = 0;
  let definition = world.currentWorldDefinition;
  const selected = () => inventory.getSelectedItem()?.id === TELEPORTER_ID;
  const allowed = () => !disposed && window.VRWorldContext === world && worldAuthoringAllowed(state)
    && ctx.api.playerMode() === 'creative' && ctx.api.canUseAbility('allowToolUse')
    && state.worldMode !== '2d' && !state.paused && !state.textEditing && !state.textWorldConsoleActive
    && !state.isMounted && !state.isGliding;
  const typing = () => document.activeElement?.closest?.('input,textarea,select,[contenteditable="true"],dialog');
  const camera = () => world.panel?._vrViewController?.getActiveCamera?.() || ctx.camera;

  function cancel(message = 'Teleport cancelled') {
    if (pending) {
      pending.abort.abort();
      clearTimeout(pending.timeout);
      pending = null;
    }
    status.textContent = message;
  }
  function updateAim() {
    const view = camera();
    view.updateWorldMatrix(true, false);
    ray.setFromCamera({x: 0, y: 0}, view);
    const range = Number(inventory.getSelectedItem()?.teleporterRange ?? 500);
    ray.far = Number.isFinite(range) ? Math.max(1, Math.min(2000, range)) : 500;
    ray.near = .05;
    aim = acquireTarget(THREE, ray, ctx.objects, ctx.colliders);
    return aim;
  }

  async function fire() {
    if (!allowed() || !selected() || inventory.isMenuOpen() || typing() || pending) return false;
    const hit = updateAim();
    if (!hit) { status.textContent = 'No solid target in range'; return false; }
    if (!hit.normal || hit.normal.y < .65) { status.textContent = 'Aim at a walkable surface'; return false; }
    const abort = new AbortController();
    const request = {hit, abort, definition: world.currentWorldDefinition,
      origin: ctx.controls.getObject().position.clone(), ray: ray.ray.clone()};
    pending = request;
    request.timeout = setTimeout(() => {
      if (pending === request) cancel('Destination preparation timed out');
    }, 10000);
    status.textContent = 'Preparing destination… Escape or right-click cancels';
    try {
      await prepareDestination(ctx, hit, abort.signal);
      abort.signal.throwIfAborted();
      if (pending !== request || !allowed() || !selected() || inventory.isMenuOpen() || typing()
        || world.currentWorldDefinition !== request.definition
        || ctx.controls.getObject().position.distanceTo(request.origin) > .05) {
        throw Error('Teleport cancelled: player or world changed');
      }
      // Recheck the recorded ray rather than following the player's new aim while waiting.
      ray.ray.copy(request.ray);
      const blocker = acquireTarget(THREE, ray, ctx.objects, ctx.colliders);
      if (!blocker || blocker.root !== hit.root || blocker.point.distanceTo(hit.point) > (hit.coarse ? 8 : .6)) {
        throw Error('Target changed during preparation');
      }
      const result = resolveDestination(ctx, hit);
      if (!result.valid) throw Error(result.reason);
      commitDestination(ctx, result);
      flashUntil = performance.now() + 250;
      status.textContent = 'Teleported';
      return true;
    } catch (error) {
      if (pending === request) status.textContent = error.name === 'AbortError' ? 'Teleport cancelled' : error.message;
      return false;
    } finally {
      clearTimeout(request.timeout);
      if (pending === request) pending = null;
    }
  }

  function update(input = {}) {
    if (definition !== world.currentWorldDefinition) { cancel(); definition = world.currentWorldDefinition; }
    if (!allowed() || !selected() || inventory.isMenuOpen() || typing() || input.cleanupOnly) {
      cancel();
      visual.hide();
      status.hidden = true;
      lastPressed = false;
      return false;
    }
    status.hidden = false;
    const pressed = !!(input.grab || input.use || input.attack), cancelPressed = !!input.rotate;
    if (cancelPressed) cancel();
    const hit = pending?.hit || updateAim(), result = hit ? resolveDestination(ctx, hit) : null;
    if (!pending && performance.now() >= flashUntil) {
      status.textContent = hit ? (result.valid ? 'Ready — click to teleport'
        : result.pending ? 'Click to prepare destination' : result.reason) : 'Aim at a solid surface';
    }
    const feedback = pending ? 'pending' : performance.now() < flashUntil ? 'fired' : result?.valid ? 'valid' : 'invalid';
    visual.update(camera(), hit, feedback, inventory.getActiveHand());
    if (pressed && !lastPressed && !cancelPressed) void fire();
    lastPressed = pressed;
    // Consume only this equipped tool's commands; ordinary movement remains available outside preparation.
    input.grab = false;
    input.use = false;
    input.attack = false;
    input.rotate = false;
    input.stretch = false;
    return !!pending;
  }

  // Inventory disposal and selection own helper lifetime even while the render loop is paused.
  const key = e => { if (e.key === 'Escape' && selected()) { cancel(); visual.hide(); } };
  document.addEventListener('keydown', key);
  // Pointer-locked browsers may consume Escape's keydown but still deliver its keyup.
  document.addEventListener('keyup', key);
  const unsubscribe = inventory.subscribeSelection(() => {
    if (!selected()) { cancel(); visual.hide(); status.hidden = true; lastPressed = false; }
  });
  const oldDispose = inventory.dispose;
  function dispose() {
    if (disposed) return;
    cancel();
    disposed = true;
    unsubscribe();
    document.removeEventListener('keydown', key);
    document.removeEventListener('keyup', key);
    visual.dispose();
    status.remove();
    if (inventory.dispose === inventoryDispose) inventory.dispose = oldDispose;
  }
  function inventoryDispose(...args) { dispose(); return oldDispose.apply(inventory, args); }
  inventory.dispose = inventoryDispose;
  return {update, fire, cancel, dispose, get pending() { return !!pending; }, get target() { return aim; }, visual, status};
}
