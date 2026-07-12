// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewGLTF.mjs
// GLTF/GLB viewer with orientation widget and STL export.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { GLTFLoader } from "/lib/three/examples/jsm/loaders/GLTFLoader.js";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";
import { exportSceneToSTL } from "/ModelExport/STLExport.mjs";

const viewers = new WeakMap();

function viewerSize(element) {
  const rect = element.getBoundingClientRect?.();
  return {
    width: Math.max(1, rect?.width || element.clientWidth || 1),
    height: Math.max(1, rect?.height || element.clientHeight || 1),
  };
}

function modelUrl(filePath = "", serverBase = "/Notebook") {
  const base = String(serverBase || "/Notebook").replace(/\/+$/, "");
  const clean = String(filePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
  const encoded = clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

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
    this.resizeObserver = null;
    this.resizeHandler = null;
    this.orientationWidget = null;
    this.init();
  }

  init() {
    const c = this.container;
    c.innerHTML = "";
    c.style.position = "relative";
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.minWidth = "0";
    c.style.minHeight = "360px";
    c.style.background = "#1a1a1a";
    c.style.overflow = "hidden";

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    const size = viewerSize(c);
    this.camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.1, 100000);
    this.camera.position.set(3, 2, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(size.width, size.height, false);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
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

    this.scene.add(new THREE.GridHelper(20, 20, 0x666666, 0x333333));
    this.scene.add(new THREE.AxesHelper(2));

    this.orientationWidget = new ViewportOrientationWidget({
      container: c,
      THREE,
      camera: this.camera,
      controls: this.controls,
      viewAdapter: {
        getCamera: () => this.camera,
        getControls: () => this.controls,
        getViewportElement: () => this.container,
        requestRender: () => {
          this.renderer.render(this.scene, this.camera);
          return true;
        },
      },
    });
    this.orientationWidget.mount();

    this.clock = new THREE.Clock();
    this.resizeHandler = () => this.handleResize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(c);
    } else {
      window.addEventListener("resize", this.resizeHandler);
    }
    this.renderer.setAnimationLoop(() => this.animate());
  }

  animate() {
    const delta = this.clock.getDelta();
    if (this.mixer) this.mixer.update(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.orientationWidget?.sync?.();
  }

  handleResize() {
    const size = viewerSize(this.container);
    this.camera.aspect = size.width / size.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size.width, size.height, false);
  }

  clearModel() {
    if (!this.root) return;
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      obj.geometry?.dispose?.();
      const material = obj.material;
      if (Array.isArray(material)) material.forEach((m) => m?.dispose?.());
      else material?.dispose?.();
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
    this.orientationWidget?.sync?.();
  }

  load(filePath, serverBase = "/Notebook") {
    this.clearModel();
    const loader = new GLTFLoader();
    loader.load(
      modelUrl(filePath, serverBase),
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) {
          this.showError("GLTF loaded, but scene is empty.");
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
        console.error("[ViewGLTF] Load error:", err);
        this.showError("Error loading GLTF/GLB file.");
      },
    );
  }

  showError(message) {
    let el = this.container.querySelector(".nv-gltf-viewer-error");
    if (!el) {
      el = document.createElement("div");
      el.className = "nv-gltf-viewer-error";
      el.style.cssText = "position:absolute;left:10px;bottom:10px;max-width:80%;padding:8px 10px;background:rgba(176,0,32,0.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:4px;z-index:3;";
      this.container.appendChild(el);
    }
    el.textContent = message;
  }

  exportSTL(pathValue = "model.glb") {
    exportSceneToSTL(this.root || this.scene, pathValue);
  }

  destroy() {
    this.renderer?.setAnimationLoop?.(null);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    else window.removeEventListener("resize", this.resizeHandler);
    this.orientationWidget?.destroy?.();
    this.controls?.dispose?.();
    this.clearModel();
    this.renderer?.dispose?.();
  }
}

export function renderGLTF(filePath, container, serverBase = "/Notebook") {
  let viewer = viewers.get(container);
  if (!viewer) {
    viewer = new GLTFViewer(container);
    viewers.set(container, viewer);
  }
  viewer.load(filePath, serverBase);

  const exportToken = Symbol("nv-gltf-viewer-export-context");
  window.NodevisionModelExportContext = {
    token: exportToken,
    kind: "gltf-viewer",
    filePath,
    exportSTL: () => viewer.exportSTL(filePath),
  };
  window.__nvGltfViewerApi = viewer;
  updateToolbarState({ currentMode: "GLBviewing", activePanelType: "ViewPanel", selectedFile: filePath, modelCanExportSTL: true });
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    renderGLTF(filename, viewPanel, serverBase);
  } catch (err) {
    console.error("[ViewGLTF] Critical error:", err);
    viewPanel.innerHTML = `<p style="color:red;">Critical GLTF viewer error: ${err.message}</p>`;
    return false;
  }
  return true;
}
