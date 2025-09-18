// Nodevision/public/InfoSTL.js
// Uses 3JS to provide the html and javascript needed to render STL models in the info panel
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let renderer, scene, camera, controls;
let overlayRenderer, overlayScene, overlayCamera;

function initViewer() {
  const containerId = "stl-viewer-container";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.width = "100%";
    container.style.height = "400px";
    container.style.border = "1px solid #ccc";
    document.getElementById("content-frame-container").appendChild(container);
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
  camera.position.set(200, 200, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  const ambientLight = new THREE.AmbientLight(0x606060);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);

  // Overlay axes
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

function animate() {
  requestAnimationFrame(animate);
  controls?.update();
  renderer?.render(scene, camera);
  overlayRenderer?.render(overlayScene, overlayCamera);
}

function renderSTL(filePath) {
  // clear meshes
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if (obj.type === "Mesh" || obj.userData.isVertex) scene.remove(obj);
  }

  const loader = new STLLoader();
  loader.load(`/Notebook/${encodeURIComponent(filePath)}`, geometry => {
    const material = new THREE.MeshPhongMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geometry, material);

    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    mesh.position.sub(center);

    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    camera.position.set(center.x, center.y, cameraZ);

    controls.target.copy(center);
    controls.update();

    scene.add(mesh);

    const edges = new THREE.EdgesGeometry(geometry);
    const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
    edgeLines.position.sub(center);
    scene.add(edgeLines);

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

initViewer();

// Export instead of window
export { renderSTL };
