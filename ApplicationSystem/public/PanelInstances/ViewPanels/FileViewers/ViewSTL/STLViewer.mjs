// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSTL/STLViewer.mjs
// This file defines the STLViewer class used by the ViewSTL file viewer. It sets up a Three.js scene and loads STL geometry for interactive viewing.

import * as THREE from "/lib/three/three.module.js";
import { STLLoader } from "/lib/three/STLLoader.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";

function isEmptySTLBuffer(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) return true;
  try {
    const preview = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, Math.min(arrayBuffer.byteLength, 2048))));
    const text = preview.trim().toLowerCase();
    return text.startsWith("solid") && text.includes("endsolid") && !text.includes("facet");
  } catch {
    return false;
  }
}

export class STLViewer {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    const container = this.container;

    container.innerHTML = "";
    container.style.position = "relative";
    container.style.width = "100%";
    container.style.height = "400px";
    container.style.border = "1px solid #ccc";
    container.style.background = "#fff";

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      50000,
    );
    this.camera.position.set(200, 200, 200);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    const canvas = this.renderer.domElement;
    canvas.tabIndex = -1;
    canvas.setAttribute("role", "application");
    canvas.addEventListener("pointerdown", () => canvas.focus(), { passive: true });
    canvas.addEventListener("mousedown", () => canvas.focus(), { passive: true });

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    this.scene.add(new THREE.AmbientLight(0x606060));
    const d = new THREE.DirectionalLight(0xffffff, 1.0);
    d.position.set(1, 1, 1).normalize();
    this.scene.add(d);

    this.floorGridVisible = true;
    this.floorGrid = this.createFloorGrid(400, 40);
    this.scene.add(this.floorGrid);

    this.orientationWidget = new ViewportOrientationWidget({
      container,
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

    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);

    this.renderer.setAnimationLoop(() => this.animate());
  }

  createFloorGrid(size = 400, divisions = 40, zPosition = 0) {
    const grid = new THREE.GridHelper(size, divisions, 0xb7b7b7, 0xd8d8d8);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = Number.isFinite(zPosition) ? zPosition : 0;
    grid.userData.isFloorGrid = true;
    grid.visible = this.floorGridVisible !== false;
    const material = grid.material;
    if (material) {
      material.transparent = true;
      material.opacity = 0.62;
      material.depthWrite = false;
    }
    return grid;
  }

  updateFloorGridForModelSize(maxDim = 200, zPosition = 0) {
    const normalizedDim = Math.max(100, Number(maxDim) || 100);
    const gridSize = Math.max(200, normalizedDim * 2.5);
    const divisions = Math.max(20, Math.min(120, Math.round(gridSize / Math.max(5, normalizedDim / 16))));
    const visible = this.getFloorGridVisible();
    if (this.floorGrid) {
      this.scene.remove(this.floorGrid);
      this.floorGrid.geometry?.dispose?.();
      if (Array.isArray(this.floorGrid.material)) this.floorGrid.material.forEach((mat) => mat.dispose?.());
      else this.floorGrid.material?.dispose?.();
    }
    this.floorGrid = this.createFloorGrid(gridSize, divisions, zPosition);
    this.floorGrid.visible = visible;
    this.scene.add(this.floorGrid);
  }

  setFloorGridVisible(visible) {
    this.floorGridVisible = Boolean(visible);
    if (this.floorGrid) this.floorGrid.visible = this.floorGridVisible;
    window.dispatchEvent(new CustomEvent("nv-stl-viewer-grid-changed", { detail: { visible: this.floorGridVisible } }));
    return this.floorGridVisible;
  }

  getFloorGridVisible() {
    return this.floorGridVisible !== false;
  }

  destroy() {
    window.removeEventListener("resize", this.resizeHandler);
    if (this.floorGrid) {
      this.floorGrid.geometry?.dispose?.();
      if (Array.isArray(this.floorGrid.material)) this.floorGrid.material.forEach((mat) => mat.dispose?.());
      else this.floorGrid.material?.dispose?.();
    }
    this.renderer.dispose();
    this.orientationWidget?.destroy?.();
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
    this.orientationWidget?.sync?.();
  }

  clearModel() {
    const removable = this.scene.children.filter(
      (ch) => ch.userData?.isModel || ch.userData?.isEdge || ch.userData?.isVertex,
    );
    removable.forEach((ch) => this.scene.remove(ch));
  }

  showError(message) {
    const existing = this.container.querySelector(".stl-viewer-error");
    if (existing) existing.remove();
    const errorEl = document.createElement("div");
    errorEl.className = "stl-viewer-error";
    errorEl.style.position = "absolute";
    errorEl.style.left = "10px";
    errorEl.style.bottom = "10px";
    errorEl.style.maxWidth = "80%";
    errorEl.style.padding = "8px 10px";
    errorEl.style.background = "rgba(176,0,32,0.92)";
    errorEl.style.color = "#fff";
    errorEl.style.fontFamily = "sans-serif";
    errorEl.style.fontSize = "12px";
    errorEl.style.borderRadius = "4px";
    errorEl.textContent = message;
    this.container.appendChild(errorEl);
  }

  showNotice(message) {
    const existing = this.container.querySelector(".stl-viewer-error");
    if (existing) existing.remove();
    const noticeEl = document.createElement("div");
    noticeEl.className = "stl-viewer-error";
    noticeEl.style.position = "absolute";
    noticeEl.style.left = "10px";
    noticeEl.style.bottom = "10px";
    noticeEl.style.maxWidth = "80%";
    noticeEl.style.padding = "8px 10px";
    noticeEl.style.background = "rgba(15,23,42,0.78)";
    noticeEl.style.color = "#fff";
    noticeEl.style.fontFamily = "sans-serif";
    noticeEl.style.fontSize = "12px";
    noticeEl.style.borderRadius = "4px";
    noticeEl.textContent = message;
    this.container.appendChild(noticeEl);
  }

  async loadSTL(filePath, serverBase = "") {
    this.clearModel();
    const oldError = this.container.querySelector(".stl-viewer-error");
    if (oldError) oldError.remove();

    let base = String(serverBase || "");
    while (base.endsWith("/")) base = base.slice(0, -1);
    const path = String(filePath || "")
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    const url = (base ? base : "") + "/" + path;

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status) + " " + String(response.statusText || "STL load failed"));
      const arrayBuffer = await response.arrayBuffer();
      if (isEmptySTLBuffer(arrayBuffer)) {
        this.camera.position.set(200, 200, 200);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        this.showNotice("Empty STL file. Open the graphical STL editor to add vertices and faces.");
        return;
      }

      const loader = new STLLoader();
      const geometry = loader.parse(arrayBuffer);
      const position = geometry.getAttribute("position");
      if (!position || position.count === 0) {
        this.showNotice("Empty STL file. Open the graphical STL editor to add vertices and faces.");
        return;
      }
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      this.updateFloorGridForModelSize(maxDim, -center.z);
      const material = new THREE.MeshPhongMaterial({
        color: 0xadd8e6,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.sub(center);
      mesh.userData.isModel = true;
      this.scene.add(mesh);
      const fov = this.camera.fov * (Math.PI / 180);
      const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
      this.camera.position.set(dist, dist, dist);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x008800 }));
      edgeLines.position.sub(center);
      edgeLines.userData.isEdge = true;
      this.scene.add(edgeLines);
      const verticesMaterial = new THREE.PointsMaterial({
        size: Math.max(0.4, maxDim * 0.05),
        color: 0xffcc00,
      });
      const pointCloud = new THREE.Points(geometry, verticesMaterial);
      pointCloud.position.sub(center);
      pointCloud.userData.isVertex = true;
      this.scene.add(pointCloud);
    } catch (err) {
      console.error("[ViewSTL] Failed to load STL:", err);
      const message = err?.message || "Unknown STL load error.";
      this.showError("Failed to load STL model: " + message);
    }
  }
}
