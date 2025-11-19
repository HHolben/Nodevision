// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewSTL.mjs
// Purpose: Uses Three.js to render STL models inside a view panel.
import * as THREE from 'https://esm.sh/three@0.160.0';
import { STLLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let renderer, scene, camera, controls;
let overlayRenderer, overlayScene, overlayCamera;

/**
 * Initializes a Three.js viewer inside the provided container.
 * @param {HTMLElement} container - The DOM container element to render into.
 */
function initViewer(container) {
  console.log('[ViewSTL] Initializing STL viewer...');

  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '400px';
  container.style.border = '1px solid #ccc';
  container.style.background = '#fff';

  // === Base Scene ===
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    1,
    50000
  );
  camera.position.set(200, 200, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // === Controls ===
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // === Lighting ===
  scene.add(new THREE.AmbientLight(0x606060));
  const d = new THREE.DirectionalLight(0xffffff, 1.0);
  d.position.set(1, 1, 1).normalize();
  scene.add(d);

  // === Overlay Axes ===
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

  // === Resize Handling ===
  window.addEventListener('resize', () => handleResize(container));

  animate();
}

function handleResize(container) {
  if (!renderer || !camera) return;

  const w = container.clientWidth;
  const h = container.clientHeight;

  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
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
 * Removes all STL-related meshes, edges, and vertex markers.
 */
function clearModel() {
  const toRemove = [];

  for (const child of scene.children) {
    if (child.userData?.isVertex || child.userData?.isModel || child.userData?.isEdge) {
      toRemove.push(child);
    }
  }

  toRemove.forEach(obj => scene.remove(obj));
}

/**
 * Renders an STL file inside the given container.
 * @param {string} filePath - Path to the STL file (relative to /Notebook)
 * @param {HTMLElement} container - The panel container element
 * @param {string} serverBase - Server base URL
 */
export function renderSTL(filePath, container, serverBase) {
  console.log(`[ViewSTL] Rendering STL: ${filePath}`);

  // Initialize viewer if not already present
  if (!renderer || !scene || !camera) {
    initViewer(container);
  } else {
    // Reattach DOM element into this panel
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    container.appendChild(overlayRenderer.domElement);
  }

  clearModel();

  const loader = new STLLoader();
  loader.load(`${serverBase}/${encodeURIComponent(filePath)}`, geometry => {
    geometry.computeBoundingBox();

    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);

    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Create Mesh
    const material = new THREE.MeshPhongMaterial({
      color: 0xadd8e6,
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.sub(center);
    mesh.userData.isModel = true;
    scene.add(mesh);

    // Camera positioning
    const fov = camera.fov * (Math.PI / 180);
    const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
    camera.position.set(dist, dist, dist);
    controls.target.set(0, 0, 0);
    controls.update();

    // Edges overlay
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x008800 })
    );
    edgeLines.position.sub(center);
    edgeLines.userData.isEdge = true;
    scene.add(edgeLines);

    // Vertex markers
    const posAttr = geometry.getAttribute('position');
    const vertexGeom = new THREE.SphereGeometry(maxDim * 0.003, 8, 8);
    const vertexMat = new THREE.MeshPhongMaterial({ color: 0xffcc00 });

    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i).sub(center);
      const sphere = new THREE.Mesh(vertexGeom, vertexMat);
      sphere.position.copy(v);
      sphere.userData.isVertex = true;
      scene.add(sphere);
    }
  });
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    renderSTL(filename, viewPanel, serverBase);
  } catch (err) {
    console.error('[ViewSTL] Error:', err);
    viewPanel.innerHTML =
      `<p style="color:red;">Error loading STL file.</p>`;
  }
}