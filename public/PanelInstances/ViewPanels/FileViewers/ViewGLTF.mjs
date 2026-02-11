// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewGLTF.mjs
// GLTF/GLB file viewer implementation (no shim).

import * as THREE from '/lib/three/three.module.js';
import { OrbitControls } from '/lib/three/OrbitControls.js';
import { GLTFLoader } from '/lib/three/examples/jsm/loaders/GLTFLoader.js';

const viewers = new WeakMap();

class GLTFViewer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = null;
    this.mixer = null;
    this.root = null;
    this.resizeHandler = null;
    this.init();
  }

  init() {
    const c = this.container;
    c.innerHTML = '';
    c.style.position = 'relative';
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.minHeight = '360px';
    c.style.background = '#1a1a1a';
    c.style.overflow = 'hidden';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    const width = Math.max(c.clientWidth, 1);
    const height = Math.max(c.clientHeight, 1);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
    this.camera.position.set(3, 2, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    c.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(5, 10, 7);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-5, 3, -7);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(20, 20, 0x666666, 0x333333);
    this.scene.add(grid);
    const axes = new THREE.AxesHelper(2);
    this.scene.add(axes);

    this.clock = new THREE.Clock();
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
    this.renderer.setAnimationLoop(() => this.animate());
  }

  animate() {
    const delta = this.clock.getDelta();
    if (this.mixer) {
      this.mixer.update(delta);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  clearModel() {
    if (!this.root) return;
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      if (obj.geometry?.dispose) obj.geometry.dispose();
      const material = obj.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m?.dispose && m.dispose());
      } else if (material?.dispose) {
        material.dispose();
      }
    });
    this.root = null;
    this.mixer = null;
  }

  frame(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    root.position.sub(center);

    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.8;
    this.camera.position.set(distance, distance * 0.7, distance);
    this.camera.near = Math.max(distance / 1000, 0.01);
    this.camera.far = Math.max(distance * 100, 1000);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  load(filePath, serverBase = '/Notebook') {
    this.clearModel();
    const loader = new GLTFLoader();
    const url = `${serverBase}/${encodeURIComponent(filePath)}`;

    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) {
          this.container.innerHTML = '<p style="color:red;">GLTF loaded, but scene is empty.</p>';
          return;
        }
        this.root = root;
        this.scene.add(root);
        this.frame(root);

        if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(root);
          gltf.animations.forEach((clip) => this.mixer.clipAction(clip).play());
        }
      },
      undefined,
      (err) => {
        console.error('[ViewGLTF] Load error:', err);
        this.container.innerHTML = '<p style="color:red;">Error loading GLTF/GLB file.</p>';
      }
    );
  }
}

export function renderGLTF(filePath, container, serverBase = '/Notebook') {
  let viewer = viewers.get(container);
  if (!viewer) {
    viewer = new GLTFViewer(container);
    viewers.set(container, viewer);
  }
  viewer.load(filePath, serverBase);
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    renderGLTF(filename, viewPanel, serverBase);
  } catch (err) {
    console.error('[ViewGLTF] Critical error:', err);
    viewPanel.innerHTML = `<p style="color:red;">Critical GLTF viewer error: ${err.message}</p>`;
  }
}
