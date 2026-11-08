// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Destination.mjs
// This module validates standing support and body clearance using the existing collision checker. Map preparation uses the shared terrain source APIs; detailed occupancy remains authoritative even when its visual mesh has not been installed.
import {createCollisionChecker} from '../collisionCheck.mjs';
import {surfaceHits, excluded} from './Target.mjs';
const PAD = .03;

// Stop waiting immediately on cancellation; shared terrain work retains its own lifetime.
function waitForSource(work, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, {once: true});
    Promise.resolve(work).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

export async function prepareDestination(ctx, hit, signal) {
  signal.throwIfAborted();
  const point = hit.point, radius = ctx.playerRadius;
  for (const root of ctx.objects) {
    const r = root.userData?.terrainRuntime;
    if (!r?.manager || !root.visible) continue;
    const x = point.x - root.position.x, z = point.z - root.position.z;
    if (x + radius < 0 || z + radius < 0 || x - radius > r.definition.size[0] || z - radius > r.definition.size[2]) continue;
    if (!await waitForSource(r.ready, signal)) throw Error('Terrain source is unavailable');
    signal.throwIfAborted();
    if (r.map) {
      const margin = radius + 1 + r.generator.pathFeatureReach * .25;
      await waitForSource(r.prepareMapRegion({minX: x - margin, maxX: x + margin, minZ: z - margin, maxZ: z + margin}), signal);
      signal.throwIfAborted();
    }
  }
}

export function resolveDestination(ctx, hit) {
  const {THREE, movementState: state, playerRadius: radius, colliders} = ctx;
  if (!hit || !hit.normal || hit.normal.y < .65) return {valid: false, reason: 'Aim at an upward-facing walkable surface'};
  if (!ctx.objects.includes(hit.root) || excluded(hit.root) || !colliders.includes(hit.collider)) {
    return {valid: false, reason: 'Target is no longer available'};
  }
  const height = state.playerHeight;
  if (!Number.isFinite(height) || height <= 0) return {valid: false, reason: 'Player dimensions unavailable'};
  const offsets = [[0,0], [radius,0], [-radius,0], [0,radius], [0,-radius],
    [radius*.7,radius*.7], [-radius*.7,-radius*.7], [radius*.7,-radius*.7], [-radius*.7,radius*.7]];
  const heights = [], maxChange = hit.coarse ? 8 : .55, ray = new THREE.Raycaster();
  ray.far = maxChange * 2 + 1;
  // Nine bounded footprint samples reject unsupported edges and unsuitable slopes.
  for (const [dx, dz] of offsets) {
    const x = hit.point.x + dx, z = hit.point.z + dz;
    let y;
    if (hit.terrain?.map && !hit.terrain.mapSampleReady([x, hit.point.y, z])) {
      return {valid: false, pending: true, reason: 'Preparing terrain data'};
    }
    if (typeof hit.collider.sampleGroundY === 'function') y = hit.collider.sampleGroundY(x, z, hit.point.y + maxChange);
    else {
      ray.set(new THREE.Vector3(x, hit.point.y + maxChange, z), new THREE.Vector3(0, -1, 0));
      const h = surfaceHits(THREE, ray, hit.root)[0];
      if (h) {
        const n = h.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld)).normalize();
        if (n?.y >= .65) y = h.point.y;
      }
    }
    if (!Number.isFinite(y) || Math.abs(y - hit.point.y) > maxChange) {
      return {valid: false, reason: 'No reliable nearby standing surface'};
    }
    heights.push(y);
  }
  if (Math.max(...heights) - Math.min(...heights) > Math.min(.5, ctx.stepHeight)) {
    return {valid: false, reason: 'Surface is too steep or too close to an edge'};
  }
  // Triangle colliders use a capsule whose rounded bottom extends below the nominal feet.
  const capsule = hit.collider.type === 'compound' && hit.collider.worldTriangles?.length;
  const planePadding = hit.collider.type === 'equation-plane' ? radius + Math.max(.02, Number(hit.collider.thickness) || .2) / 2 : 0;
  const padding = PAD + (capsule ? radius : planePadding);
  const groundY = Math.max(...heights), position = hit.point.clone();
  position.y = groundY + height + padding;
  // Do not inherit grounded step allowances, phasing, or an active terrain exemption during validation.
  const checkState = {playerHeight: height, isGrounded: false, phaseThroughObjects: false};
  for (const root of ctx.objects) {
    const r = root.userData?.terrainRuntime;
    if (!r?.map || !root.visible) continue;
    const x = position.x - root.position.x, z = position.z - root.position.z;
    if (x >= 0 && z >= 0 && x <= r.definition.size[0] && z <= r.definition.size[2] && !r.mapSampleReady(position.toArray())) {
      return {valid: false, pending: true, reason: 'Preparing collision data'};
    }
  }
  if (createCollisionChecker({colliders, movementState: checkState, playerRadius: radius})(position)) {
    return {valid: false, reason: 'Destination is obstructed or outside the world boundary'};
  }
  for (const y of [groundY + .05, position.y - height + .05, position.y - height * .5, position.y]) {
    if (ctx.api.getWaterVolumeAtPosition?.(new THREE.Vector3(position.x, y, position.z))) {
      return {valid: false, reason: 'Choose a dry standing surface'};
    }
  }
  return {valid: true, position, collider: hit.collider, groundY};
}

export function commitDestination(ctx, destination) {
  const player = ctx.controls.getObject();
  player.position.copy(destination.position);
  player.updateMatrixWorld(true);
  ctx.api.clearVectorGravityMotion?.();
  ctx.vectorGravityVelocity?.set(0, 0, 0);
  ctx.api.clearRunState?.();
  const colliderId = destination.collider.layerId || destination.collider.target?.uuid || null;
  Object.assign(ctx.movementState, {velocityY: 0, isGrounded: true, isFlying: false, isSwimming: false,
    walkInputBlockedByFall: false, pendingGroundCollider: destination.collider,
    activeExpressionTerrainColliderId: colliderId, pendingExpressionTerrainColliderId: colliderId});
  for (const root of ctx.objects) root.userData?.terrainRuntime?.update?.(destination.position);
}
