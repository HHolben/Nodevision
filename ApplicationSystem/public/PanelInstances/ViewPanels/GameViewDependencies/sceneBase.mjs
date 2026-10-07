// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/sceneBase.mjs
// This file creates the Three.js scene, renderer, camera, and default ground without inventing illumination.

import { createWorldRenderer } from "./createWorldRenderer.mjs";

export function createSceneBase({ THREE, panel, canvas }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ffffff");
  const renderer = createWorldRenderer({ THREE, canvas });
  panel._vrRenderer = renderer;
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(panel.clientWidth, panel.clientHeight, false);

  const camera = new THREE.PerspectiveCamera(
    75,
    panel.clientWidth / panel.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.75, 10);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0xd8dee4 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  return { scene, renderer, camera, objects: [], colliders: [], lights: [], ground };
}
