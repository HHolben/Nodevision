// Nodevision/ApplicationSystem/public/Widgets/ViewportOrientationWidget.mjs
// Shared XYZ viewport orientation widget for Three.js-based Nodevision editors/viewers.

const WIDGET_ID = "ViewportOrientationWidget";
const STYLE_ID = "nv-widget-viewport-orientation-styles";
const GIZMO_SIZE = 100;
const AXIS_LENGTH = 23;
const ROTATION_STEP = Math.PI / 8;
const AXIS_TIPS = [
  { id: "+X", title: "View from +X", vector: [1, 0, 0], axis: "x" },
  { id: "-X", title: "View from -X", vector: [-1, 0, 0], axis: "x" },
  { id: "+Y", title: "View from +Y", vector: [0, 1, 0], axis: "y" },
  { id: "-Y", title: "View from -Y", vector: [0, -1, 0], axis: "y" },
  { id: "+Z", title: "View from +Z", vector: [0, 0, 1], axis: "z" },
  { id: "-Z", title: "View from -Z", vector: [0, 0, -1], axis: "z" },
];
const ROTATION_ARCS = [
  { id: "rot-x-pos", title: "Rotate around X", axis: [1, 0, 0], direction: 1, from: "+Y", to: "+Z", tone: "x" },
  { id: "rot-x-neg", title: "Rotate around X reverse", axis: [1, 0, 0], direction: -1, from: "-Y", to: "-Z", tone: "x" },
  { id: "rot-y-pos", title: "Rotate around Y", axis: [0, 1, 0], direction: 1, from: "+Z", to: "+X", tone: "y" },
  { id: "rot-y-neg", title: "Rotate around Y reverse", axis: [0, 1, 0], direction: -1, from: "-Z", to: "-X", tone: "y" },
  { id: "rot-z-pos", title: "Rotate around Z", axis: [0, 0, 1], direction: 1, from: "+X", to: "+Y", tone: "z" },
  { id: "rot-z-neg", title: "Rotate around Z reverse", axis: [0, 0, 1], direction: -1, from: "-X", to: "-Y", tone: "z" },
];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = [
    ".nv-widget{box-sizing:border-box;font-family:system-ui,sans-serif;}",
    ".nv-widget *,.nv-widget *::before,.nv-widget *::after{box-sizing:inherit;}",
    ".nv-widget-viewport-orientation{position:absolute;top:10px;right:10px;width:100px;height:100px;z-index:4;pointer-events:auto;user-select:none;}",
    ".nv-orientation-gizmo{position:relative;width:100px;height:100px;border-radius:8px;background:rgba(255,255,255,0.72);box-shadow:0 1px 6px rgba(15,23,42,0.2);overflow:hidden;cursor:grab;}",
    ".nv-orientation-gizmo canvas{display:block;width:100%;height:100%;}",
    ".nv-orientation-gizmo.is-dragging{cursor:grabbing;}",
    ".nv-orientation-controls{position:absolute;inset:0;pointer-events:none;}",
    ".nv-orientation-tip-button{position:absolute;min-width:19px;height:17px;transform:translate(-50%,-50%);border:1px solid rgba(148,163,184,0.78);border-radius:999px;background:rgba(255,255,255,0.9);padding:0 3px;font:700 9px/1 system-ui,sans-serif;cursor:pointer;pointer-events:auto;box-shadow:0 1px 3px rgba(15,23,42,0.18);}",
    ".nv-orientation-tip-button:hover,.nv-orientation-tip-button:focus-visible{border-color:#f59e0b;background:#fff7e6;outline:none;}",
    ".nv-orientation-arc-layer{position:absolute;inset:0;width:100px;height:100px;pointer-events:auto;}",
    ".nv-orientation-arc-hit{fill:none;stroke:transparent;stroke-width:12;pointer-events:stroke;cursor:pointer;}",
    ".nv-orientation-arc{fill:none;stroke-width:2.2;stroke-linecap:round;opacity:0.78;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(15,23,42,0.18));}",
    ".nv-orientation-arc-hit:hover + .nv-orientation-arc{stroke-width:3.2;opacity:1;}",
    ".nv-orientation-axis-x{color:#c2410c;}",
    ".nv-orientation-axis-y{color:#15803d;}",
    ".nv-orientation-axis-z{color:#1d4ed8;}",
    ".nv-orientation-arc-x{stroke:#c2410c;}",
    ".nv-orientation-arc-y{stroke:#15803d;}",
    ".nv-orientation-arc-z{stroke:#1d4ed8;}",
  ].join("\n");
  document.head.appendChild(style);
}

function warnMissing(name) {
  console.warn(`[Nodevision Widgets] ${WIDGET_ID}: missing adapter method ${name}.`);
}

function callAdapter(adapter, name, ...args) {
  if (!adapter || typeof adapter[name] !== "function") return undefined;
  try {
    return adapter[name](...args);
  } catch (err) {
    console.warn(`[Nodevision Widgets] ${WIDGET_ID}: adapter.${name} failed:`, err);
    return undefined;
  }
}

function classForAxis(axis) {
  if (axis === "x") return "nv-orientation-axis-x";
  if (axis === "y") return "nv-orientation-axis-y";
  return "nv-orientation-axis-z";
}

function colorForAxis(axis) {
  if (axis === "x") return 0xc2410c;
  if (axis === "y") return 0x15803d;
  return 0x1d4ed8;
}

function svgPoint(point) {
  return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
}

export class ViewportOrientationWidget {
  constructor(options = {}) {
    this.options = options;
    this.adapter = options.viewAdapter || options.adapter || null;
    this.container = options.container || callAdapter(this.adapter, "getViewportElement") || null;
    this.camera = options.camera || callAdapter(this.adapter, "getCamera") || null;
    this.controls = options.controls || callAdapter(this.adapter, "getControls") || null;
    this.THREE = options.THREE || null;
    this.root = null;
    this.gizmoEl = null;
    this.controlsLayer = null;
    this.arcLayer = null;
    this.tipButtons = new Map();
    this.arcPaths = new Map();
    this.overlayScene = null;
    this.overlayCamera = null;
    this.overlayRenderer = null;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.unsubscribeCameraChanged = null;
    this.arcDrag = null;
    this.destroyed = false;
    this.boundPointerDown = (event) => this.onPointerDown(event);
    this.boundPointerMove = (event) => this.onPointerMove(event);
    this.boundPointerUp = (event) => this.onPointerUp(event);
  }

  async mount() {
    if (this.root || this.destroyed) return this;
    ensureStyles();
    if (!this.container) {
      warnMissing("getViewportElement");
      return this;
    }
    if (!this.THREE) this.THREE = await import("/lib/three/three.module.js");
    if (this.destroyed) return this;
    if (!this.camera) this.camera = callAdapter(this.adapter, "getCamera") || this.options.camera || null;
    if (!this.controls) this.controls = callAdapter(this.adapter, "getControls") || this.options.controls || null;

    this.removeExistingWidget();
    if (getComputedStyle(this.container).position === "static") this.container.style.position = "relative";

    this.root = document.createElement("div");
    this.root.className = "nv-widget nv-widget-viewport-orientation";
    this.root.dataset.nvWidgetId = WIDGET_ID;
    this.root.__nvWidgetInstance = this;

    this.gizmoEl = document.createElement("div");
    this.gizmoEl.className = "nv-orientation-gizmo";
    this.gizmoEl.title = "Drag to rotate view";
    this.root.appendChild(this.gizmoEl);

    this.createOverlayRenderer();
    this.createControlOverlay();
    this.gizmoEl.addEventListener("pointerdown", this.boundPointerDown);
    this.gizmoEl.addEventListener("pointermove", this.boundPointerMove);
    this.gizmoEl.addEventListener("pointerup", this.boundPointerUp);
    this.gizmoEl.addEventListener("pointercancel", this.boundPointerUp);

    this.unsubscribeCameraChanged = callAdapter(this.adapter, "onCameraChanged", () => this.sync());
    this.container.appendChild(this.root);
    this.sync();
    return this;
  }

  removeExistingWidget() {
    const existing = this.container?.querySelector?.(`[data-nv-widget-id="${WIDGET_ID}"]`);
    if (!existing) return;
    if (existing.__nvWidgetInstance && existing.__nvWidgetInstance !== this) {
      existing.__nvWidgetInstance.destroy?.();
      return;
    }
    existing.remove();
  }

  createOverlayRenderer() {
    const THREE = this.THREE;
    this.overlayScene = new THREE.Scene();
    this.overlayCamera = new THREE.PerspectiveCamera(50, 1, 1, 100);
    this.overlayCamera.position.set(50, 50, 50);
    this.addAxisLine("x", [-AXIS_LENGTH, 0, 0], [AXIS_LENGTH, 0, 0]);
    this.addAxisLine("y", [0, -AXIS_LENGTH, 0], [0, AXIS_LENGTH, 0]);
    this.addAxisLine("z", [0, 0, -AXIS_LENGTH], [0, 0, AXIS_LENGTH]);
    this.overlayRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.overlayRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.overlayRenderer.setSize(GIZMO_SIZE, GIZMO_SIZE);
    this.gizmoEl.appendChild(this.overlayRenderer.domElement);
  }

  addAxisLine(axis, from, to) {
    const THREE = this.THREE;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ]);
    const material = new THREE.LineBasicMaterial({ color: colorForAxis(axis), transparent: true, opacity: 0.92 });
    this.overlayScene.add(new THREE.Line(geometry, material));
  }

  createControlOverlay() {
    this.controlsLayer = document.createElement("div");
    this.controlsLayer.className = "nv-orientation-controls";
    this.arcLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.arcLayer.setAttribute("class", "nv-orientation-arc-layer");
    this.arcLayer.setAttribute("viewBox", `0 0 ${GIZMO_SIZE} ${GIZMO_SIZE}`);
    this.arcLayer.setAttribute("aria-hidden", "true");
    this.controlsLayer.appendChild(this.arcLayer);

    ROTATION_ARCS.forEach((arc) => {
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hit.setAttribute("class", "nv-orientation-arc-hit");
      hit.setAttribute("data-arc-id", arc.id);
      hit.addEventListener("pointerdown", (event) => this.onArcPointerDown(event, arc));
      hit.addEventListener("pointermove", (event) => this.onArcPointerMove(event));
      hit.addEventListener("pointerup", (event) => this.onArcPointerUp(event));
      hit.addEventListener("pointercancel", (event) => this.onArcPointerUp(event));
      const visible = document.createElementNS("http://www.w3.org/2000/svg", "path");
      visible.setAttribute("class", `nv-orientation-arc nv-orientation-arc-${arc.tone}`);
      this.arcLayer.append(hit, visible);
      this.arcPaths.set(arc.id, { hit, visible, arc });
    });

    AXIS_TIPS.forEach((tip) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = tip.id;
      button.title = tip.title;
      button.className = `nv-orientation-tip-button ${classForAxis(tip.axis)}`;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.setView(tip.vector, tip.id);
      });
      this.controlsLayer.appendChild(button);
      this.tipButtons.set(tip.id, { button, tip });
    });

    this.gizmoEl.appendChild(this.controlsLayer);
  }

  currentCamera() {
    return callAdapter(this.adapter, "getCamera") || this.camera;
  }

  currentControls() {
    return callAdapter(this.adapter, "getControls") || this.controls;
  }

  sync() {
    if (this.destroyed || !this.overlayRenderer || !this.overlayCamera || !this.THREE) return;
    const camera = this.currentCamera();
    if (!camera) return;
    const controls = this.currentControls();
    const target = controls?.target || this.options.target || new this.THREE.Vector3();
    const offset = camera.position.clone().sub(target);
    if (offset.lengthSq() < 0.0001) offset.set(1, 1, 1);
    this.overlayCamera.position.copy(offset).setLength(50);
    this.overlayCamera.up.copy(camera.up);
    this.overlayCamera.lookAt(0, 0, 0);
    this.overlayCamera.updateMatrixWorld();
    this.overlayRenderer.render(this.overlayScene, this.overlayCamera);
    this.syncControls();
  }

  syncControls() {
    const projected = new Map();
    AXIS_TIPS.forEach((tip) => {
      const point = this.projectAxisPoint(tip.vector, AXIS_LENGTH);
      projected.set(tip.id, point);
      const item = this.tipButtons.get(tip.id);
      if (!item) return;
      item.button.style.left = `${point.x}px`;
      item.button.style.top = `${point.y}px`;
      item.button.style.zIndex = String(Math.round(1000 - point.depth * 100));
    });

    this.arcPaths.forEach(({ hit, visible, arc }) => {
      const from = projected.get(arc.from);
      const to = projected.get(arc.to);
      const path = from && to ? this.arcPath(from, to) : "";
      hit.setAttribute("d", path);
      visible.setAttribute("d", path);
    });
  }

  projectAxisPoint(vector, length = AXIS_LENGTH) {
    const THREE = this.THREE;
    const point = new THREE.Vector3(vector[0], vector[1], vector[2]).multiplyScalar(length).project(this.overlayCamera);
    return {
      x: (point.x * 0.5 + 0.5) * GIZMO_SIZE,
      y: (-point.y * 0.5 + 0.5) * GIZMO_SIZE,
      depth: point.z,
    };
  }

  arcPath(from, to) {
    const center = { x: GIZMO_SIZE / 2, y: GIZMO_SIZE / 2 };
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    let out = { x: mid.x - center.x, y: mid.y - center.y };
    const len = Math.max(1, Math.hypot(out.x, out.y));
    out = { x: out.x / len, y: out.y / len };
    const control = { x: mid.x + out.x * 20, y: mid.y + out.y * 20 };
    return `M ${svgPoint(from)} Q ${svgPoint(control)} ${svgPoint(to)}`;
  }

  requestRender() {
    const handled = callAdapter(this.adapter, "requestRender");
    if (!handled && typeof this.options.onViewChange === "function") this.options.onViewChange();
    this.sync();
  }

  applyCameraOrbitRotation(quaternion) {
    const camera = this.currentCamera();
    const controls = this.currentControls();
    if (!camera || !controls?.target) return false;
    const offset = camera.position.clone().sub(controls.target).applyQuaternion(quaternion);
    camera.position.copy(controls.target).add(offset);
    camera.up.applyQuaternion(quaternion).normalize();
    camera.lookAt(controls.target);
    camera.updateMatrixWorld?.();
    return true;
  }

  rotateView(deltaX, deltaY) {
    const handled = callAdapter(this.adapter, "rotateView", deltaX, deltaY);
    if (handled) {
      this.requestRender();
      return;
    }
    const THREE = this.THREE;
    const camera = this.currentCamera();
    const controls = this.currentControls();
    if (!THREE || !camera || !controls?.target) {
      warnMissing("rotateView or OrbitControls target");
      return;
    }
    const offset = camera.position.clone().sub(controls.target);
    const right = new THREE.Vector3().crossVectors(offset, camera.up).normalize();
    const yawAxis = camera.up.clone().normalize();
    const yaw = new THREE.Quaternion().setFromAxisAngle(yawAxis, -deltaX * 0.01);
    const pitch = right.lengthSq() > 0
      ? new THREE.Quaternion().setFromAxisAngle(right, -deltaY * 0.01)
      : new THREE.Quaternion();
    const rotation = yaw.multiply(pitch);
    if (this.applyCameraOrbitRotation(rotation)) this.requestRender();
  }

  rotateAroundAxis(axis, direction = 1, angle = ROTATION_STEP) {
    const handled = callAdapter(this.adapter, "rotateAroundAxis", axis, direction, angle);
    if (handled) {
      this.requestRender();
      return;
    }
    const THREE = this.THREE;
    const camera = this.currentCamera();
    const controls = this.currentControls();
    if (!THREE || !camera || !controls?.target) {
      warnMissing("rotateAroundAxis or OrbitControls target");
      return;
    }
    const axisVector = new THREE.Vector3(axis[0], axis[1], axis[2]).normalize();
    angle *= direction < 0 ? -1 : 1;
    const rotation = new THREE.Quaternion().setFromAxisAngle(axisVector, angle);
    if (this.applyCameraOrbitRotation(rotation)) this.requestRender();
  }

  setView(direction, label = "view") {
    const handled = callAdapter(this.adapter, "setView", direction, label);
    if (handled) {
      this.requestRender();
      return;
    }
    const THREE = this.THREE;
    const camera = this.currentCamera();
    const controls = this.currentControls();
    if (!THREE || !camera || !controls?.target) {
      warnMissing("setView or OrbitControls target");
      return;
    }
    const target = controls.target;
    const offset = camera.position.clone().sub(target);
    const distance = Math.max(1, offset.length() || 100);
    const vector = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize().multiplyScalar(distance);
    camera.position.copy(target).add(vector);
    if (Math.abs(direction[2]) > 0) camera.up.set(0, 1, 0);
    else camera.up.set(0, 0, 1);
    camera.lookAt(target);
    camera.updateMatrixWorld?.();
    this.requestRender();
  }

  pointerAngle(event) {
    const rect = this.gizmoEl?.getBoundingClientRect?.();
    if (!rect) return 0;
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
  }

  onArcPointerDown(event, arc) {
    event.preventDefault();
    event.stopPropagation();
    this.arcDrag = { arc, lastAngle: this.pointerAngle(event), moved: false };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  }

  onArcPointerMove(event) {
    if (!this.arcDrag) return;
    event.preventDefault();
    event.stopPropagation();
    const nextAngle = this.pointerAngle(event);
    let delta = nextAngle - this.arcDrag.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) > 0.001) {
      this.arcDrag.moved = true;
      this.rotateAroundAxis(this.arcDrag.arc.axis, this.arcDrag.arc.direction, delta);
    }
    this.arcDrag.lastAngle = nextAngle;
  }

  onArcPointerUp(event) {
    if (!this.arcDrag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!this.arcDrag.moved) this.rotateAroundAxis(this.arcDrag.arc.axis, this.arcDrag.arc.direction);
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
    this.arcDrag = null;
  }

  onPointerDown(event) {
    if (event.target?.closest?.("button,path")) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.gizmoEl?.classList.add("is-dragging");
    this.gizmoEl?.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event) {
    if (!this.dragging) return;
    event.preventDefault();
    event.stopPropagation();
    this.rotateView(event.clientX - this.lastX, event.clientY - this.lastY);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  onPointerUp(event) {
    if (!this.dragging) return;
    this.dragging = false;
    this.gizmoEl?.classList.remove("is-dragging");
    if (event?.pointerId !== undefined) this.gizmoEl?.releasePointerCapture?.(event.pointerId);
  }

  destroy() {
    this.destroyed = true;
    if (typeof this.unsubscribeCameraChanged === "function") this.unsubscribeCameraChanged();
    callAdapter(this.adapter, "destroy");
    if (this.gizmoEl) {
      this.gizmoEl.removeEventListener("pointerdown", this.boundPointerDown);
      this.gizmoEl.removeEventListener("pointermove", this.boundPointerMove);
      this.gizmoEl.removeEventListener("pointerup", this.boundPointerUp);
      this.gizmoEl.removeEventListener("pointercancel", this.boundPointerUp);
    }
    if (this.overlayScene) {
      this.overlayScene.traverse?.((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose?.());
        else child.material?.dispose?.();
      });
    }
    this.overlayRenderer?.dispose?.();
    if (this.root?.parentNode) this.root.remove();
    if (this.root?.__nvWidgetInstance === this) this.root.__nvWidgetInstance = null;
    this.root = null;
    this.gizmoEl = null;
    this.controlsLayer = null;
    this.arcLayer = null;
    this.tipButtons.clear();
    this.arcPaths.clear();
    this.overlayScene = null;
    this.overlayCamera = null;
    this.overlayRenderer = null;
  }
}

export default ViewportOrientationWidget;
