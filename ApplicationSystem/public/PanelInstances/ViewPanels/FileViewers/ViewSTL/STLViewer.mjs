// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSTL/STLViewer.mjs
// This file defines the STLViewer class used by the ViewSTL file viewer. It sets up a Three.js scene and loads STL geometry for interactive viewing.

import * as THREE from "/lib/three/three.module.js";
import { STLLoader } from "/lib/three/STLLoader.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";

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

    this.overlayScene = new THREE.Scene();
    this.overlayCamera = new THREE.PerspectiveCamera(50, 1, 1, 100);
    this.overlayCamera.position.set(50, 50, 50);
    this.overlayScene.add(new THREE.AxesHelper(20));

    this.overlayRenderer = new THREE.WebGLRenderer({ alpha: true });
    this.overlayRenderer.setSize(100, 100);
    this.overlayRenderer.domElement.title = "Drag to rotate view";
    this.overlayRenderer.domElement.style.cssText = "position:absolute;top:10px;right:10px;width:100px;height:100px;cursor:grab;border-radius:8px;background:rgba(255,255,255,0.72);box-shadow:0 1px 6px rgba(15,23,42,0.2);z-index:4;";
    container.appendChild(this.overlayRenderer.domElement);

    this.gizmoDragging = false;
    this.gizmoLastX = 0;
    this.gizmoLastY = 0;
    this.overlayRenderer.domElement.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.gizmoDragging = true;
      this.gizmoLastX = event.clientX;
      this.gizmoLastY = event.clientY;
      this.overlayRenderer.domElement.style.cursor = "grabbing";
      this.overlayRenderer.domElement.setPointerCapture?.(event.pointerId);
    });
    this.overlayRenderer.domElement.addEventListener("pointermove", (event) => {
      if (!this.gizmoDragging) return;
      event.preventDefault();
      event.stopPropagation();
      this.rotateCameraFromGizmo(event.clientX - this.gizmoLastX, event.clientY - this.gizmoLastY);
      this.gizmoLastX = event.clientX;
      this.gizmoLastY = event.clientY;
    });
    const endGizmoDrag = (event) => {
      if (!this.gizmoDragging) return;
      this.gizmoDragging = false;
      this.overlayRenderer.domElement.style.cursor = "grab";
      if (event?.pointerId !== undefined) this.overlayRenderer.domElement.releasePointerCapture?.(event.pointerId);
    };
    this.overlayRenderer.domElement.addEventListener("pointerup", endGizmoDrag);
    this.overlayRenderer.domElement.addEventListener("pointercancel", endGizmoDrag);

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

  rotateCameraFromGizmo(deltaX, deltaY) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= deltaX * 0.01;
    spherical.phi = Math.max(0.08, Math.min(Math.PI - 0.08, spherical.phi - deltaY * 0.01));
    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  syncViewGizmo() {
    const offset = this.camera.position.clone().sub(this.controls.target);
    if (offset.lengthSq() < 0.0001) offset.set(1, 1, 1);
    this.overlayCamera.position.copy(offset).setLength(50);
    this.overlayCamera.up.copy(this.camera.up);
    this.overlayCamera.lookAt(0, 0, 0);
  }

  animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.syncViewGizmo();
    this.overlayRenderer.render(this.overlayScene, this.overlayCamera);
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
