// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/sceneBase.mjs
// This file creates the Three.js scene, renderer, camera, and static ground lighting.

export function createSceneBase({ THREE, panel, canvas }) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(panel.clientWidth, panel.clientHeight);

  const camera = new THREE.PerspectiveCamera(
    75,
    panel.clientWidth / panel.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.75, 10);

  const baseLight = new THREE.DirectionalLight(0xffffff, 1);
  baseLight.position.set(5, 10, 7);
  scene.add(baseLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x444444 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  return { scene, renderer, camera, objects: [], colliders: [], lights: [] };
}
