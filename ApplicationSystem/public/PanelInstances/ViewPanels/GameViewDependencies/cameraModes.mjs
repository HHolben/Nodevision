// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/cameraModes.mjs
// This module manages canonical view transitions and frames a foot-aligned player avatar using the physical player height.

import { createPlayerAvatarVisual, STANDING_AVATAR_HEIGHT } from "./playerAvatarVisual.mjs";

export function createCameraModeController({ THREE, panel, scene, playerCamera, controls, movementState, crosshair }) {
  const followCamera = new THREE.PerspectiveCamera(
    playerCamera.fov,
    playerCamera.aspect,
    playerCamera.near,
    playerCamera.far
  );
  followCamera.position.copy(playerCamera.position);
  scene.add(followCamera);

  const avatarVisual=createPlayerAvatarVisual(THREE,scene);

  const modes = [
    { id: "first", label: "First Person" },
    { id: "second", label: "Second Person" },
    { id: "third", label: "Third Person" },
    { id: "topdown", label: "Top Down" },
    { id: "side", label: "Side Scroller" },
    { id: "text", label: "Text Console" }
  ];
  let modeIndex = 0;
  let appliedDefaultViewMode = null;
  let orbitPitch = 0;
  const minPitch = -1.0;
  const maxPitch = 0.9;
  const pitchSensitivity = 0.003;

  const forward = new THREE.Vector3();
  const side = new THREE.Vector3();
  const target = new THREE.Vector3();
  const cameraPos = new THREE.Vector3();

  function currentMode() {
    return modes[modeIndex] || modes[0];
  }

  function modeIndexForViewMode(viewMode) {
    const normalized = String(viewMode || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const aliases = { console: "text", textconsole: "text" };
    const modeId = aliases[normalized] || normalized;
    const match = modes.findIndex((mode) => mode.id === modeId);
    return match >= 0 ? match : 0;
  }

  function applyDefaultViewModeIfNeeded() {
    const defaultViewMode = String(movementState?.viewMode || "").toLowerCase();
    if (appliedDefaultViewMode === defaultViewMode && movementState?.cameraModeInitialized) return;
    modeIndex = modeIndexForViewMode(defaultViewMode);
    appliedDefaultViewMode = defaultViewMode;
    if (movementState) movementState.cameraModeInitialized = true;
    publishCameraMode();
    applyCrosshairVisibility();
  }

  function publishCameraMode() {
    if (movementState) movementState.cameraMode = currentMode().id;
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
    publishCameraMode();
    if (id === "side" && movementState?.worldMode === "2d") {
      const player = controls?.getObject?.();
      if (Number.isFinite(player?.position?.z)) movementState.planeZ = player.position.z;
    }
    applyCrosshairVisibility();
    console.log(`Camera view mode: ${currentMode().label}`);
  }

  function onMouseMove(event) {
    const mode = currentMode().id;
    if (!controls?.isLocked) return;
    if (mode !== "second" && mode !== "third") return;
    orbitPitch -= event.movementY * pitchSensitivity;
    if (orbitPitch < minPitch) orbitPitch = minPitch;
    if (orbitPitch > maxPitch) orbitPitch = maxPitch;
  }

  document.addEventListener("mousemove", onMouseMove);
  applyDefaultViewModeIfNeeded();

  function update() {
    applyDefaultViewModeIfNeeded();
    if (movementState?.requestCycleCamera) {
      movementState.requestCycleCamera = false;
      cycleMode();
    }

    const avatar = avatarVisual.root;
    const player = controls.getObject();
    controls.getDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    side.set(-forward.z, 0, forward.x).normalize();

    const headY = player.position.y;
    const height=movementState?.playerHeight || STANDING_AVATAR_HEIGHT;

    avatarVisual.update(player,height,Math.atan2(forward.x,forward.z));

    const mode = currentMode().id;
    publishCameraMode();
    if (mode === "first" || mode === "text") {
      avatar.visible = false;
      return;
    }

    avatar.visible = true;
    target.set(player.position.x, headY - height*.25, player.position.z);

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
      cameraPos.y = headY + height*.65 + vertical;
    } else if (mode === "topdown") {
      cameraPos.copy(player.position);
      cameraPos.y = headY + 16;
      target.y = headY - 1.2;
      target.z -= 0.001;
    } else {
      cameraPos.copy(player.position).addScaledVector(side, 9);
      cameraPos.y = headY + 2.5;
      if (movementState?.worldMode === "2d") {
        target.y = headY + 0.7;
      }
    }

    followCamera.position.copy(cameraPos);
    followCamera.lookAt(target);
  }

  function getActiveCamera() {
    const id = currentMode().id;
    return id === "first" || id === "text" ? playerCamera : followCamera;
  }

  function dispose() {
    document.removeEventListener("mousemove", onMouseMove);
    avatarVisual.dispose();
    scene.remove(followCamera);
  }

  return { update, getActiveCamera, dispose, followCamera, cycleMode, getAvatar:()=>avatarVisual.root };
}
