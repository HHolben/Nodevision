// Nodevision/ApplicationSystem/public/MetaWorld/Weather/CloudRenderer.mjs
// This renderer streams bounded instanced cloud lobes with distance fading and ordinary lit materials, without lights, colliders or world objects.
import { cloudRegion, cloudOffset, CLOUD_REGION_SIZE as SIZE, CLOUD_REGION_RADIUS as RADIUS } from './CloudField.mjs';
export function createCloudRenderer(THREE, scene, state) {
  const root = new THREE.Group(); root.name = 'Nodevision weather clouds';
  root.userData.runtimeGenerated = true;
  scene.add(root);
  const geometry = new THREE.SphereGeometry(1, 8, 6), regions = new Map();
  const transform = new THREE.Object3D();
  function update(position, time) {
    const [ox, oz] = cloudOffset(state, time);
    const x = position.x - ox, z = position.z - oz;
    const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE), wanted = new Set();
    for (let rz = cz - RADIUS; rz <= cz + RADIUS; rz++) for (let rx = cx - RADIUS; rx <= cx + RADIUS; rx++) {
      const key = `${rx},${rz}`; wanted.add(key);
      if (!regions.has(key)) {
        const lobes = cloudRegion(rx, rz, state);
        const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0, depthWrite: false });
        const mesh = new THREE.InstancedMesh(geometry, material, lobes.length);
        lobes.forEach((lobe, index) => {
          transform.position.set(lobe.position[0] - rx * SIZE, lobe.position[1], lobe.position[2] - rz * SIZE);
          transform.scale.fromArray(lobe.scale); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.runtimeGenerated = true;
        mesh.raycast = () => {};
        root.add(mesh); regions.set(key, { mesh, rx, rz });
      }
    }
    for (const [key, entry] of regions) {
      if (!wanted.has(key)) {
        entry.mesh.dispose(); entry.mesh.material.dispose(); entry.mesh.removeFromParent(); regions.delete(key); continue;
      }
      entry.mesh.position.set(entry.rx * SIZE + ox, 0, entry.rz * SIZE + oz);
      const distance = Math.hypot((entry.rx + .5) * SIZE - x, (entry.rz + .5) * SIZE - z);
      const fade = Math.max(0, Math.min(1, (SIZE * 2.5 - distance) / SIZE));
      entry.mesh.material.opacity = .72 * fade * fade * (3 - 2 * fade);
      entry.mesh.visible = entry.mesh.count > 0 && fade > 0;
    }
  }
  return { root, regions, update, dispose() {
    for (const { mesh } of regions.values()) { mesh.dispose(); mesh.material.dispose(); }
    regions.clear(); geometry.dispose(); root.clear(); root.removeFromParent();
  } };
}
