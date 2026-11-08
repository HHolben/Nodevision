// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Visuals.mjs
// This lightweight procedural emitter and destination ring are transient scene helpers with explicit resource ownership. Their colors communicate validity and preparation without external assets or persistent world objects.
export function createTeleporterVisuals(THREE, scene) {
  const gun = new THREE.Group(), marker = new THREE.Group(), materials = [];
  gun.name = 'Raycasting Teleporter';
  marker.name = 'Teleporter destination';
  const material = color => {
    const m = new THREE.MeshBasicMaterial({color});
    materials.push(m);
    return m;
  };
  const body = material(0x284b63), emitter = material(0x36e6dc), grip = material(0x30343b);
  const part = (size, position, m) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), m);
    mesh.position.set(...position);
    gun.add(mesh);
  };
  part([.16,.12,.24], [0,0,0], body);
  part([.07,.07,.2], [0,.015,-.2], emitter);
  part([.07,.16,.08], [0,-.12,.045], grip);
  part([.025,.025,.025], [0,.08,-.02], emitter);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.4, .025, 6, 32), material(0x44eeaa));
  ring.rotation.x = -Math.PI / 2;
  marker.add(ring);
  // Scene-only helpers never enter world objects, collision arrays, history, or serialization.
  for (const helper of [gun, marker]) {
    helper.userData.isEditorHelper = true;
    helper.userData.teleporterHelper = true;
    helper.visible = false;
    helper.traverse(o => { o.raycast = () => {}; });
    scene.add(helper);
  }
  const rotation = new THREE.Quaternion();
  return {gun, marker,
    update(camera, hit, state, hand = 'dominant') {
      camera.updateWorldMatrix(true, false);
      camera.getWorldQuaternion(rotation);
      camera.getWorldPosition(gun.position);
      gun.position.add(new THREE.Vector3(hand === 'off' ? -.25 : .25, -.2, -.45).applyQuaternion(rotation));
      gun.quaternion.copy(rotation);
      gun.visible = true;
      marker.visible = !!hit;
      if (hit) {
        marker.position.copy(hit.point);
        marker.position.y += .04;
        ring.material.color.set(state === 'pending' ? 0xffcc44 : state === 'valid' ? 0x44eeaa : 0xff5544);
      }
      emitter.color.set(state === 'fired' ? 0xffffff : 0x36e6dc);
    },
    hide() { gun.visible = false; marker.visible = false; },
    dispose() {
      for (const helper of [gun, marker]) {
        helper.traverse(o => o.geometry?.dispose());
        helper.removeFromParent();
      }
      materials.forEach(m => m.dispose());
    }
  };
}
