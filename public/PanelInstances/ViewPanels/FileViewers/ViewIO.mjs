// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewIO.mjs
// Bricklink Studio (.io) viewer using THREE.js + LDraw

import * as THREE from '/lib/three/three.module.js';
import { OrbitControls } from '/lib/three/OrbitControls.js';
import { LDrawLoader } from '/lib/three/LDrawLoader.js';
import * as JSZip from '/lib/jszip/jszip.min.js';


const zip = await JSZip.loadAsync(buffer);

const viewers = new WeakMap();

class IOViewer {
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
    this.camera.position.set(300, 300, 300);

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

    // === LDraw Loader ===
    this.ldraw = new LDrawLoader();
    this.ldraw.setPartsLibraryPath('/ldraw/'); // IMPORTANT
    this.ldraw.smoothNormals = true;

    // === Resize ===
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);

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
    const removable = this.scene.children.filter(ch => ch.userData?.isModel);
    removable.forEach(ch => this.scene.remove(ch));
  }

  async loadIO(filePath, serverBase) {
    this.clearModel();

    // === Load .io ===
    const res = await fetch(`${serverBase}/${encodeURIComponent(filePath)}`);
    const buffer = await res.arrayBuffer();

    const zip = await JSZip.loadAsync(buffer);
    const modelText = await zip.file('model.json').async('string');
    const model = JSON.parse(modelText);

    const group = new THREE.Group();
    group.userData.isModel = true;

    // === Brick instances ===
    for (const part of model.parts) {
      const partName = part.designID; // Bricklink part ID
      const color = part.materialID;
      const { x, y, z, m00, m01, m02, m10, m11, m12, m20, m21, m22 } = part;

      await new Promise(resolve => {
        this.ldraw.load(
          `${partName}.dat`,
          object => {
            object.traverse(ch => {
              if (ch.isMesh) {
                ch.material = ch.material.clone();
                ch.material.color = this.ldraw.getColor(color);
              }
            });

            // Transform
            const matrix = new THREE.Matrix4().set(
              m00, m01, m02, x,
              m10, m11, m12, y,
              m20, m21, m22, z,
              0,   0,   0,   1
            );
            object.applyMatrix4(matrix);

            group.add(object);
            resolve();
          },
          undefined,
          err => {
            console.warn('[ViewIO] Missing LDraw part:', partName);
            resolve();
          }
        );
      });
    }

    this.scene.add(group);

    // === Fit camera ===
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.sub(center);

    const fov = this.camera.fov * Math.PI / 180;
    const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;

    this.camera.position.set(dist, dist, dist);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}

export function renderIO(filePath, container, serverBase) {
  let viewer = viewers.get(container);
  if (!viewer) {
    viewer = new IOViewer(container);
    viewers.set(container, viewer);
  }
  viewer.loadIO(filePath, serverBase);
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    renderIO(filename, viewPanel, serverBase);
  } catch (err) {
    console.error('[ViewIO] Error:', err);
    viewPanel.innerHTML =
      `<p style="color:red;">Error loading .io file.</p>`;
  }
}
