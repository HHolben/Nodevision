// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewSTL.mjs
// This module populates an STL viewer panel.

import * as THREE from '/lib/three/three.module.js';
import { STLLoader } from '/lib/three/STLLoader.js';
import { OrbitControls } from '/lib/three/OrbitControls.js';

const viewers = new WeakMap(); // one viewer per container

class STLViewer {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    const container = this.container;

    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '400px';
    container.style.border = '1px solid #ccc';
    container.style.background = '#fff';

    // ==== Scene ====
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    // ==== Camera ====
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      50000
    );
    this.camera.position.set(200, 200, 200);

    // ==== Renderer ====
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // ==== Controls ====
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // ==== Lighting ====
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
    container.appendChild(this.overlayRenderer.domElement);

    // === Resize Handling ===
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);

    // === Start animation ===
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
      ch => ch.userData?.isModel || ch.userData?.isEdge || ch.userData?.isVertex
    );
    removable.forEach(ch => this.scene.remove(ch));
  }

  loadSTL(filePath, serverBase) {
    this.clearModel();

    const loader = new STLLoader();
    loader.load(`${serverBase}/${encodeURIComponent(filePath)}`, geometry => {
      geometry.computeBoundingBox();

      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);

      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      // Mesh
      const material = new THREE.MeshPhongMaterial({
        color: 0xadd8e6,
        transparent: true,
        opacity: 0.9
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.sub(center);
      mesh.userData.isModel = true;
      this.scene.add(mesh);

      // Camera placement
      const fov = this.camera.fov * (Math.PI / 180);
      const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
      this.camera.position.set(dist, dist, dist);
      this.controls.target.set(0, 0, 0);
      this.controls.update();

      // Edges
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeLines = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x008800 })
      );
      edgeLines.position.sub(center);
      edgeLines.userData.isEdge = true;
      this.scene.add(edgeLines);

      // Vertex cloud instead of thousands of spheres
      const verticesMaterial = new THREE.PointsMaterial({
        size: maxDim * 0.01,
        color: 0xffcc00
      });
      const pointCloud = new THREE.Points(geometry, verticesMaterial);
      pointCloud.position.sub(center);
      pointCloud.userData.isVertex = true;
      this.scene.add(pointCloud);
    });
  }
}

export function renderSTL(filePath, container, serverBase) {
  let viewer = viewers.get(container);

  if (!viewer) {
    viewer = new STLViewer(container);
    viewers.set(container, viewer);
  }

  viewer.loadSTL(filePath, serverBase);
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    renderSTL(filename, viewPanel, serverBase);
  } catch (err) {
    console.error('[ViewSTL] Error:', err);
    viewPanel.innerHTML = `<p style="color:red;">Error loading STL file.</p>`;
  }
}
