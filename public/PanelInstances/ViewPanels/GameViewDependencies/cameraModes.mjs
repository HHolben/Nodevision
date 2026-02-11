// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/cameraModes.mjs
// Manages view modes, player avatar visibility, and camera switching.

export function createCameraModeController({ THREE, panel, scene, playerCamera, controls, movementState, crosshair }) {
  const followCamera = new THREE.PerspectiveCamera(
    playerCamera.fov,
    playerCamera.aspect,
    playerCamera.near,
    playerCamera.far
  );
  followCamera.position.copy(playerCamera.position);
  scene.add(followCamera);

  const avatar = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.75, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x2e6da4, roughness: 0.65, metalness: 0.1 })
  );
  body.position.y = 0.85;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.7, metalness: 0.05 })
  );
  head.position.y = 1.55;
  avatar.add(body);
  avatar.add(head);
  avatar.visible = false;
  scene.add(avatar);

  const modes = [
    { id: "first", label: "First Person" },
    { id: "second", label: "Second Person" },
    { id: "third", label: "Third Person" },
    { id: "topdown", label: "Top Down" },
    { id: "side", label: "Side Scroller" }
  ];
  let modeIndex = 0;
  let orbitPitch = 0;
  const minPitch = -1.0;
  const maxPitch = 0.9;
  const pitchSensitivity = 0.003;

  const forward = new THREE.Vector3();
  const side = new THREE.Vector3();
  const target = new THREE.Vector3();
  const cameraPos = new THREE.Vector3();

  function currentMode() {
    return modes[modeIndex];
  }

  function applyCrosshairVisibility() {
    if (!crosshair) return;
    crosshair.style.display = currentMode().id === "first" ? "block" : "none";
  }

  function cycleMode() {
    modeIndex = (modeIndex + 1) % modes.length;
    const id = currentMode().id;
    if (id !== "second" && id !== "third") {
      orbitPitch = 0;
    }
    applyCrosshairVisibility();
    console.log(`Camera view mode: ${currentMode().label}`);
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    if (event.key && event.key.toLowerCase() === "y") {
      cycleMode();
    }
  }

  function onMouseMove(event) {
    const mode = currentMode().id;
    if (!controls?.isLocked) return;
    if (mode !== "second" && mode !== "third") return;
    orbitPitch -= event.movementY * pitchSensitivity;
    if (orbitPitch < minPitch) orbitPitch = minPitch;
    if (orbitPitch > maxPitch) orbitPitch = maxPitch;
  }

  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("mousemove", onMouseMove);
  applyCrosshairVisibility();

  function update() {
    const player = controls.getObject();
    controls.getDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    side.set(-forward.z, 0, forward.x).normalize();

    const headY = player.position.y;
    const bodyY = headY - Math.max((movementState?.playerHeight || 1.75) * 0.5, 0.6);

    avatar.position.set(player.position.x, bodyY, player.position.z);
    avatar.rotation.y = Math.atan2(forward.x, forward.z);

    const mode = currentMode().id;
    if (mode === "first") {
      avatar.visible = false;
      return;
    }

    avatar.visible = true;
    target.set(player.position.x, headY - 0.1, player.position.z);

    if (mode === "second") {
      const distance = 2.4;
      const horizontal = Math.cos(orbitPitch) * distance;
      const vertical = Math.sin(orbitPitch) * distance;
      cameraPos.copy(player.position).addScaledVector(forward, horizontal);
      cameraPos.y = headY + vertical;
    } else if (mode === "third") {
      const distance = 4.5;
      const horizontal = Math.cos(orbitPitch) * distance;
      const vertical = Math.sin(orbitPitch) * distance;
      cameraPos.copy(player.position).addScaledVector(forward, -horizontal);
      cameraPos.y = headY + 1.2 + vertical;
    } else if (mode === "topdown") {
      cameraPos.copy(player.position);
      cameraPos.y = headY + 16;
      target.y = headY - 1.2;
      target.z -= 0.001;
    } else {
      cameraPos.copy(player.position).addScaledVector(side, 9);
      cameraPos.y = headY + 2.5;
    }

    followCamera.position.copy(cameraPos);
    followCamera.lookAt(target);
  }

  function getActiveCamera() {
    return currentMode().id === "first" ? playerCamera : followCamera;
  }

  function dispose() {
    window.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("mousemove", onMouseMove);
    scene.remove(avatar);
    scene.remove(followCamera);
  }

  return { update, getActiveCamera, dispose, followCamera };
}
