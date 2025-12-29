// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewUSD.mjs
// Multi-instance USD (Universal Scene Description) Viewer.

import * as THREE from '../../../lib/three/three.module.js';
import { OrbitControls } from '/lib/three/OrbitControls.js'; 
// --- LOADER CHANGE: Importing USDLoader.js ---
import { USDLoader } from '../../../lib/three/USDLoader.js'; 




const viewers = new WeakMap(); // one viewer instance per container element

/**
 * Encapsulates the Three.js scene, camera, and render loop for 
 * viewing USD models within a specific container.
 */
class USDViewer {
  constructor(container) {
    this.container = container;
    this.init();
  }

  // --- Core Setup ---

  init() {
    const container = this.container;

    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '400px';
    container.style.border = '1px solid #ccc';
    container.style.background = '#111';

    // ==== Scene & Lighting ====
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x333333); 
    
    this.scene.add(new THREE.AmbientLight(0x555555));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.0);
    d1.position.set(100, 200, 100).normalize();
    this.scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.5);
    d2.position.set(-100, -200, -100).normalize();
    this.scene.add(d2);

    // ==== Camera ====
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      500000
    );
    this.camera.position.set(100, 100, 100);

    // ==== Renderer ====
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    
    // USD rendering settings:
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; 
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;


    // ==== Controls ====
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); 
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // === Overlay Axes (Same as STL) ===
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

  // --- Lifecycle and Animation (unchanged) ---

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    this.renderer.dispose();
    this.overlayRenderer.dispose();
    this.renderer.setAnimationLoop(null);
    this.scene.clear();
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
    this.overlayCamera.rotation.copy(this.camera.rotation); 
    this.renderer.render(this.scene, this.camera);
    this.overlayRenderer.render(this.overlayScene, this.overlayCamera);
  }

  clearModel() {
    const removable = this.scene.children.filter(
      ch => ch.userData?.isLoadedModel
    );
    removable.forEach(ch => this.scene.remove(ch));
  }

  // --- Model Loading Logic (Now uses USDLoader) ---

  loadUSD(filePath, serverBase) {
    this.clearModel();
    
    const loader = new USDLoader(); // <-- USDLoader instantiated
    const url = `${serverBase}/${encodeURIComponent(filePath)}`;
    
    console.log(`[ViewUSD] Loading USD/A/C file: ${url}`);
    
    loader.load(url, (root) => {
        
        // 1. Calculate Bounding Box and Center
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // 2. Center Model in the Scene
        root.position.sub(center);
        root.userData.isLoadedModel = true;
        this.scene.add(root);

        // 3. Auto-fit Camera
        const fov = this.camera.fov * (Math.PI / 180);
        const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
        
        this.camera.position.set(dist, dist, dist);
        
        // Point controls target at the now-centered model
        this.controls.target.set(0, 0, 0); 
        this.controls.update();
        
    }, undefined, (error) => {
        // Error callback
        console.error('[ViewUSD] Error loading USD/USDZ:', error);
        this.container.innerHTML = `<p style="color:red;">Error loading USD file. Check console for details.</p>`;
    });
  }
}

// --- Public API (unchanged) ---

export function renderUSD(filePath, container, serverBase) {
  let viewer = viewers.get(container);

  if (!viewer) {
    viewer = new USDViewer(container);
    viewers.set(container, viewer);
  }

  viewer.loadUSD(filePath, serverBase);
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    renderUSD(filename, viewPanel, serverBase);
  } catch (err) {
    console.error('[ViewUSD] Critical Error:', err);
    viewPanel.innerHTML = `<p style="color:red;">Critical error initializing USD viewer: ${err.message}</p>`;
  }
}