// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Target.mjs
// This module acquires the nearest visible collision-owned surface, including explicitly owned coarse terrain. It excludes helpers and procedural vegetation proxies without turning decorative assets into colliders.
export function excluded(object) {
  for (let p = object; p; p = p.parent) {
    const d = p.userData || {};
    if (!p.visible || d.isEditorHelper || d.vegetationProxy || d.isPlayerAvatar || d.teleporterHelper
      || d.noninteractive || d.interactive === false || d.excludeFromRaycast || d.ignoreRaycast) return true;
  }
  return false;
}

export function objectCollider(root, colliders) {
  return colliders.find(c => c === root.userData?.colliderRef || c.target === root || c.object3d === root) || null;
}

export function surfaceHits(THREE, ray, root) {
  const hits = [];
  root.updateWorldMatrix(true, true);
  // Use actual mesh triangles, not editor bounds-picking or construction selection outlines.
  root.traverse(object => {
    if (!object.isMesh || excluded(object)) return;
    if (object.isInstancedMesh) object.raycast(ray, hits);
    else THREE.Mesh.prototype.raycast.call(object, ray, hits);
  });
  return hits.filter(h => !excluded(h.object)).sort((a, b) => a.distance - b.distance);
}

export function acquireTarget(THREE, ray, objects, colliders) {
  const hits = [];
  for (const root of objects) {
    if (excluded(root)) continue;
    const collider = objectCollider(root, colliders);
    if (!collider) continue;
    const terrain = root.userData?.terrainRuntime;
    if (terrain?.manager) {
      const local = [];
      root.updateWorldMatrix(true, true);
      root.raycast(ray, local);
      for (const h of local) hits.push({...h, root, collider, terrain, coarse: false});
      // Coarse tiles are candidates only; destination validation supplies authoritative collision.
      const coarse = root.getObjectByName('Terrain distance detail');
      if (coarse?.visible) {
        for (const h of surfaceHits(THREE, ray, coarse)) hits.push({...h, root, collider, terrain, coarse: true});
      }
    } else {
      for (const h of surfaceHits(THREE, ray, root)) hits.push({...h, root, collider, terrain, coarse: false});
    }
  }
  const hit = hits.filter(h => !excluded(h.object) && h.distance <= ray.far && h.distance >= ray.near)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!hit) return null;
  const normal = hit.face?.normal?.clone()
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  return {...hit, normal, point: hit.point.clone()};
}
