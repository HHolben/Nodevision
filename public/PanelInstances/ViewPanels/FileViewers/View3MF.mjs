// Nodevision/public/PanelInstances/ViewPanels/FileViewers/View3MF.mjs
// This module renders 3MF (3D Manufacturing Format) files in an interactive Three.js viewer.

// Imports using bare specifiers (defined in your HTML Import Map)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { ThreeMFLoader } from 'three/addons/3MFLoader.js';



const viewers = new WeakMap(); // one viewer per container

class ThreeMFViewer {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    const c = this.container;

    c.innerHTML = '';
    c.style.position = 'relative';
    c.style.width = '100%';
    c.style.height = '400px';
    c.style.border = '1px solid #ccc';
    c.style.background = '#fff';

    // === Scene ===
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    // === Camera ===
    this.camera = new THREE.PerspectiveCamera(
      45,
      c.clientWidth / c.clientHeight,
      1,
      50000
    );
    this.camera.position.set(200, 200, 200);

    // === Renderer ===
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(c.clientWidth, c.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    c.appendChild(this.renderer.domElement);

    // === Controls ===
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // === Lighting ===
    this.scene.add(new THREE.AmbientLight(0x606060));
    const d = new THREE.DirectionalLight(0xffffff, 1.0);
    d.position.set(1, 1, 1).normalize();
    this.scene.add(d);

    // === Overlay Axes ===
    this.overlayScene = new THREE.Scene();
    this.overlayCamera = new THREE.PerspectiveCamera(50, 1, 1, 100);
    this.overlayCamera.position.set(50, 50, 50);
    this.overlayScene.add(new THREE.AxesHelper(20));

    this.overlayRenderer = new THREE.WebGLRenderer({ alpha: true });
    this.overlayRenderer.setSize(100, 100);
    this.overlayRenderer.domElement.style.position = 'absolute';
    this.overlayRenderer.domElement.style.top = '10px';
    this.overlayRenderer.domElement.style.right = '10px';
    c.appendChild(this.overlayRenderer.domElement);

    // === Resize Handling ===
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);

    // === Animation ===
    this.renderer.setAnimationLoop(() => this.animate());
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    this.renderer.dispose();
    this.overlayRenderer.dispose();
  }

  handleResize() {
    const c = this.container;
    const w = c.clientWidth;
    const h = c.clientHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.overlayRenderer.render(this.overlayScene, this.overlayCamera);
  }

  clearModel() {
    const removable = this.scene.children.filter(
      ch => ch.userData?.isModel || ch.userData?.isEdge
    );
    removable.forEach(ch => this.scene.remove(ch));
  }

  load3MF(filePath, serverBase) {
    this.clearModel();

    const loader = new ThreeMFLoader();
    loader.load(`${serverBase}/${encodeURIComponent(filePath)}`, group => {
      const box = new THREE.Box3().setFromObject(group);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      // Normalize position
      group.position.sub(center);
      group.userData.isModel = true;
      this.scene.add(group);

      // Optional edge overlay per mesh
      group.traverse(obj => {
        if (obj.isMesh && obj.geometry) {
          const edges = new THREE.EdgesGeometry(obj.geometry);
          const edgeLines = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x008800 })
          );
          edgeLines.position.copy(obj.position);
          edgeLines.rotation.copy(obj.rotation);
          edgeLines.scale.copy(obj.scale);
          edgeLines.userData.isEdge = true;
          this.scene.add(edgeLines);
        }
      });

      // Camera placement
      const fov = this.camera.fov * (Math.PI / 180);
      const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
      this.camera.position.set(dist, dist, dist);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    });
  }
}

function render3MF(filePath, container, serverBase) {
  let viewer = viewers.get(container);

  if (!viewer) {
    viewer = new ThreeMFViewer(container);
    viewers.set(container, viewer);
  }

  viewer.load3MF(filePath, serverBase);
}

export async function renderFile(filePath, viewPanel, iframe, serverBase) {
  try {
    render3MF(filePath, viewPanel, serverBase);
  } catch (err) {
    console.error('[View3MF] Error:', err);
    viewPanel.innerHTML = `<p style="color:red;">Error loading 3MF file.</p>`;
  }
}
