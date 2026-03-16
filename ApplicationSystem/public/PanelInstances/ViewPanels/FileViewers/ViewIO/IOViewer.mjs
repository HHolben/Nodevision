// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewIO/IOViewer.mjs
// This file defines the IOViewer class used by the ViewIO file viewer. It sets up a Three.js scene and loads BrickLink Studio .io models from zip archives.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { LDrawLoader } from "/lib/three/LDrawLoader.js";
import * as JSZip from "/lib/jszip/jszip.min.js";

export class IOViewer {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    const c = this.container;

    c.innerHTML = "";
    c.style.position = "relative";
    c.style.width = "100%";
    c.style.height = "400px";
    c.style.border = "1px solid #ccc";
    c.style.background = "#fff";

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(45, c.clientWidth / c.clientHeight, 1, 50000);
    this.camera.position.set(300, 300, 300);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(c.clientWidth, c.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    c.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    this.scene.add(new THREE.AmbientLight(0x606060));
    const d = new THREE.DirectionalLight(0xffffff, 1.0);
    d.position.set(1, 1, 1).normalize();
    this.scene.add(d);

    this.overlayScene = new THREE.Scene();
    this.overlayCamera = new THREE.PerspectiveCamera(50, 1, 1, 100);
    this.overlayCamera.position.set(50, 50, 50);
    this.overlayScene.add(new THREE.AxesHelper(20));

    this.overlayRenderer = new THREE.WebGLRenderer({ alpha: true });
    this.overlayRenderer.setSize(100, 100);
    this.overlayRenderer.domElement.style.position = "absolute";
    this.overlayRenderer.domElement.style.top = "10px";
    this.overlayRenderer.domElement.style.right = "10px";
    c.appendChild(this.overlayRenderer.domElement);

    this.ldraw = new LDrawLoader();
    this.ldraw.setPartsLibraryPath("/ldraw/");
    this.ldraw.smoothNormals = true;

    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);

    this.renderer.setAnimationLoop(() => this.animate());
  }

  destroy() {
    window.removeEventListener("resize", this.resizeHandler);
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
    const removable = this.scene.children.filter((ch) => ch.userData?.isModel);
    removable.forEach((ch) => this.scene.remove(ch));
  }

  async loadIO(filePath, serverBase) {
    this.clearModel();

    const res = await fetch(`${serverBase}/${encodeURIComponent(filePath)}`);
    const buffer = await res.arrayBuffer();

    const zip = await JSZip.loadAsync(buffer);
    const modelText = await zip.file("model.json").async("string");
    const model = JSON.parse(modelText);

    const group = new THREE.Group();
    group.userData.isModel = true;

    for (const part of model.parts) {
      const partName = part.designID;
      const color = part.materialID;
      const { x, y, z, m00, m01, m02, m10, m11, m12, m20, m21, m22 } = part;

      await new Promise((resolve) => {
        this.ldraw.load(
          `${partName}.dat`,
          (object) => {
            object.traverse((ch) => {
              if (ch.isMesh) {
                ch.material = ch.material.clone();
                ch.material.color = this.ldraw.getColor(color);
              }
            });

            const matrix = new THREE.Matrix4().set(
              m00, m01, m02, x,
              m10, m11, m12, y,
              m20, m21, m22, z,
              0, 0, 0, 1,
            );
            object.applyMatrix4(matrix);

            group.add(object);
            resolve();
          },
          undefined,
          () => {
            console.warn("[ViewIO] Missing LDraw part:", partName);
            resolve();
          },
        );
      });
    }

    this.scene.add(group);

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.sub(center);

    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;

    this.camera.position.set(dist, dist, dist);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}

