// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewSTL.mjs
// Purpose: Uses Three.js to render STL models inside a view panel.

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { STLLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let renderer, scene, camera, controls;
let overlayRenderer, overlayScene, overlayCamera;

/**
 * Initializes a Three.js viewer inside the provided container.
 * @param {HTMLElement} container - The DOM container element to render into.
 */
function initViewer(container) {
  console.log('[ViewSTL] Initializing STL viewer...');

  // Prepare container
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '400px';
  container.style.border = '1px solid #ccc';
  container.style.background = '#fff';

  // Basic scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
  camera.position.set(200, 200, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x606060);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);

  // Overlay axes helper
  overlayScene = new THREE.Scene();
  overlayCamera = new THREE.PerspectiveCamera(50, 1, 1, 100);
  overlayCamera.position.set(50, 50, 50);
  overlayScene.add(new THREE.AxesHelper(20));

  overlayRenderer = new THREE.WebGLRenderer({ alpha: true });
  overlayRenderer.setSize(100, 100);
  overlayRenderer.domElement.style.position = 'absolute';
  overlayRenderer.domElement.style.top = '10px';
  overlayRenderer.domElement.style.right = '10px';
  container.appendChild(overlayRenderer.domElement);

  animate();
}

/**
 * Animation loop
 */
function animate() {
  requestAnimationFrame(animate);
  controls?.update();
  renderer?.render(scene, camera);
  overlayRenderer?.render(overlayScene, overlayCamera);
}

/**
 * Renders an STL file inside the given container.
 * @param {string} filePath - Path to the STL file (relative to /Notebook)
 * @param {HTMLElement} container - The panel container element
 * @param {string} serverBase - Server base URL
 */
export function renderSTL(filePath, container, serverBase) {
  console.log(`[ViewSTL] Rendering STL: ${filePath}`);

  // Initialize viewer if not already set up
  if (!renderer || !scene || !camera) {
    initViewer(container);
  } else {
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
  }

  // Remove old meshes
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if (obj.type === 'Mesh' || obj.userData.isVertex) scene.remove(obj);
  }

  const loader = new STLLoader();
  loader.load(`${serverBase}/${encodeURIComponent(filePath)}`, geometry => {
    const material = new THREE.MeshPhongMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geometry, material);

    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    mesh.position.sub(center);

    // Position camera dynamically
    const fov = camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    camera.position.set(center.x, center.y, cameraZ);

    controls.target.copy(center);
    controls.update();

    scene.add(mesh);

    // Add edges overlay
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
    edgeLines.position.sub(center);
    scene.add(edgeLines);

    // Add small vertex spheres
    const vertexMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00 });
    const vertexGeom = new THREE.SphereGeometry(0.1, 8, 8);
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      const sphere = new THREE.Mesh(vertexGeom, vertexMaterial);
      sphere.position.copy(vertex.sub(center));
      sphere.userData.isVertex = true;
      scene.add(sphere);
    }
  });
}
