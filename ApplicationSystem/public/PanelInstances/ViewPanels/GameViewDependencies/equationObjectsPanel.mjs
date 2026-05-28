// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectsPanel.mjs
// Dedicated equation-object panel for graph-calculator-style Meta World object editing.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";
import {
  makePlaneColliderRef,
  normalizePlaneEquationConfig,
  resizeEquationColliderPlaneMesh,
  syncPlaneColliderRef
} from "./equationColliderTool.mjs";

const DEFAULT_PLANE = {
  a: 0,
  b: 1,
  c: 0,
  d: 0,
  xmin: -15,
  xmax: 15,
  ymin: -15,
  ymax: 15,
  zmin: -15,
  zmax: 15,
  thickness: 0.2,
  collider: true,
  color: "#61d6d6"
};

function parseNumber(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstColorHex(target) {
  const material = Array.isArray(target?.material) ? target.material[0] : target?.material;
  return material?.color?.isColor ? `#${material.color.getHexString()}` : DEFAULT_PLANE.color;
}

function applyColor(target, colorHex, THREE) {
  const materials = Array.isArray(target?.material) ? target.material : [target?.material];
  materials.forEach((mat) => {
    if (!mat) return;
    if (mat.color) mat.color.set(colorHex);
    mat.transparent = true;
    if (!Number.isFinite(mat.opacity) || mat.opacity > 0.5) mat.opacity = 0.34;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
  });
}

export function createEquationObjectsPanel({ THREE, controller, colliders, hostPanel = null, canvas = null }) {
  let visible = false;
  let activeTarget = null;

  const floatingPanel = createFloatingInventoryPanel({
    title: "Equation Objects",
    onRequestClose: () => {
      visible = false;
      activeTarget = null;
      floatingPanel.setVisible(false);
    }
  });
  floatingPanel.setVisible(false);

  function getAnchorRect() {
    const rect = canvas?.getBoundingClientRect?.() || hostPanel?.getBoundingClientRect?.() || null;
    if (rect && rect.width > 0 && rect.height > 0) return rect;
    return { left: 0, top: 96, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: Math.max(320, window.innerHeight - 96) };
  }

  function attachAsRightPane() {
    const rect = getAnchorRect();
    const width = Math.min(420, Math.max(340, rect.width * 0.34));
    Object.assign(floatingPanel.panel.style, {
      position: "fixed",
      left: Math.max(0, rect.right - width) + "px",
      top: Math.max(0, rect.top) + "px",
      width: width + "px",
      minWidth: "320px",
      maxWidth: Math.max(340, rect.width) + "px",
      height: Math.max(320, rect.height) + "px",
      maxHeight: Math.max(320, rect.height) + "px",
      borderLeft: "1px solid rgba(97, 214, 214, 0.55)",
      boxShadow: "-12px 0 26px rgba(0, 0, 0, 0.32)",
      zIndex: "22030"
    });
  }

  function showAttachedPane() {
    visible = true;
    floatingPanel.setVisible(true);
    floatingPanel.undock();
    attachAsRightPane();
  }

  const handleWindowResize = () => {
    if (visible) attachAsRightPane();
  };
  window.addEventListener("resize", handleWindowResize);

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "10px";
  root.style.font = "12px/1.35 monospace";
  root.style.minWidth = "360px";
  floatingPanel.content.appendChild(root);

  const equationLine = document.createElement("div");
  equationLine.style.fontSize = "14px";
  equationLine.style.fontWeight = "600";
  root.appendChild(equationLine);

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  grid.style.gap = "8px";
  root.appendChild(grid);

  function addNumber(labelText, value, step = "0.1") {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.flexDirection = "column";
    label.style.gap = "4px";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.step = step;
    input.value = String(value);
    label.appendChild(input);
    grid.appendChild(label);
    return input;
  }

  const aInput = addNumber("A", DEFAULT_PLANE.a);
  const bInput = addNumber("B", DEFAULT_PLANE.b);
  const cInput = addNumber("C", DEFAULT_PLANE.c);
  const dInput = addNumber("D", DEFAULT_PLANE.d);
  const xminInput = addNumber("X Min", DEFAULT_PLANE.xmin, "1");
  const xmaxInput = addNumber("X Max", DEFAULT_PLANE.xmax, "1");
  const yminInput = addNumber("Y Min", DEFAULT_PLANE.ymin, "1");
  const ymaxInput = addNumber("Y Max", DEFAULT_PLANE.ymax, "1");
  const zminInput = addNumber("Z Min", DEFAULT_PLANE.zmin, "1");
  const zmaxInput = addNumber("Z Max", DEFAULT_PLANE.zmax, "1");
  const depthInput = addNumber("Depth", DEFAULT_PLANE.thickness, "0.05");
  depthInput.min = "0.02";

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = DEFAULT_PLANE.color;
  const colorLabel = document.createElement("label");
  colorLabel.style.display = "flex";
  colorLabel.style.flexDirection = "column";
  colorLabel.style.gap = "4px";
  colorLabel.textContent = "Color";
  colorLabel.appendChild(colorInput);
  grid.appendChild(colorLabel);

  const toggleRow = document.createElement("div");
  toggleRow.style.display = "flex";
  toggleRow.style.alignItems = "center";
  toggleRow.style.gap = "12px";
  root.appendChild(toggleRow);

  const colliderLabel = document.createElement("label");
  colliderLabel.style.display = "inline-flex";
  colliderLabel.style.alignItems = "center";
  colliderLabel.style.gap = "6px";
  const colliderInput = document.createElement("input");
  colliderInput.type = "checkbox";
  colliderInput.checked = true;
  colliderLabel.appendChild(colliderInput);
  colliderLabel.appendChild(document.createTextNode("Collider"));
  toggleRow.appendChild(colliderLabel);

  const modeLine = document.createElement("div");
  modeLine.style.opacity = "0.82";
  toggleRow.appendChild(modeLine);

  const statusLine = document.createElement("div");
  statusLine.style.opacity = "0.85";
  root.appendChild(statusLine);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const insertBtn = document.createElement("button");
  insertBtn.type = "button";
  insertBtn.textContent = "Insert Plane";
  buttonRow.appendChild(insertBtn);

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "Apply To Selected";
  buttonRow.appendChild(applyBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  buttonRow.appendChild(closeBtn);

  function updateEquationLine() {
    equationLine.textContent = `${aInput.value || 0}x + ${bInput.value || 0}y + ${cInput.value || 0}z + ${dInput.value || 0} = 0`;
  }

  function readConfig() {
    const current = normalizePlaneEquationConfig({
      a: parseNumber(aInput.value, DEFAULT_PLANE.a),
      b: parseNumber(bInput.value, DEFAULT_PLANE.b),
      c: parseNumber(cInput.value, DEFAULT_PLANE.c),
      d: parseNumber(dInput.value, DEFAULT_PLANE.d),
      xmin: parseNumber(xminInput.value, DEFAULT_PLANE.xmin),
      xmax: parseNumber(xmaxInput.value, DEFAULT_PLANE.xmax),
      ymin: parseNumber(yminInput.value, DEFAULT_PLANE.ymin),
      ymax: parseNumber(ymaxInput.value, DEFAULT_PLANE.ymax),
      zmin: parseNumber(zminInput.value, DEFAULT_PLANE.zmin),
      zmax: parseNumber(zmaxInput.value, DEFAULT_PLANE.zmax),
      thickness: parseNumber(depthInput.value, DEFAULT_PLANE.thickness)
    });
    return {
      ...current,
      collider: colliderInput.checked === true,
      color: colorInput.value || DEFAULT_PLANE.color
    };
  }

  function setConfig(config = {}, target = null) {
    const normalized = normalizePlaneEquationConfig(config);
    aInput.value = String(normalized.a);
    bInput.value = String(normalized.b);
    cInput.value = String(normalized.c);
    dInput.value = String(normalized.d);
    xminInput.value = String(normalized.xmin);
    xmaxInput.value = String(normalized.xmax);
    yminInput.value = String(normalized.ymin);
    ymaxInput.value = String(normalized.ymax);
    zminInput.value = String(normalized.zmin);
    zmaxInput.value = String(normalized.zmax);
    depthInput.value = String(normalized.thickness);
    colliderInput.checked = target ? Boolean(target.userData?.colliderRef) : config.collider !== false;
    colorInput.value = target ? firstColorHex(target) : (config.color || DEFAULT_PLANE.color);
    modeLine.textContent = target ? "Editing selected plane" : "New plane";
    updateEquationLine();
  }

  function syncTargetCollider(target, colliderEnabled) {
    const existing = target?.userData?.colliderRef;
    if (!colliderEnabled && existing) {
      const idx = colliders.indexOf(existing);
      if (idx !== -1) colliders.splice(idx, 1);
      delete target.userData.colliderRef;
      return;
    }
    if (colliderEnabled && !existing) {
      const ref = makePlaneColliderRef(THREE, target);
      colliders.push(ref);
      target.userData.colliderRef = ref;
      return;
    }
    if (colliderEnabled && existing) syncPlaneColliderRef(THREE, target);
  }

  function applyToTarget(target) {
    if (!target) return false;
    const config = readConfig();
    resizeEquationColliderPlaneMesh(THREE, target, config);
    target.userData.nvType = "equation-collider-plane";
    target.userData.isSolid = config.collider;
    target.userData.physicsEnabled = config.collider;
    syncTargetCollider(target, config.collider);
    applyColor(target, config.color, THREE);
    statusLine.textContent = "Equation object updated.";
    return true;
  }

  [aInput, bInput, cInput, dInput].forEach((input) => input.addEventListener("input", updateEquationLine));

  insertBtn.addEventListener("click", () => {
    const mesh = controller?.addPlane?.(readConfig());
    if (mesh) {
      activeTarget = mesh;
      statusLine.textContent = "Equation object plane inserted.";
      setConfig(mesh.userData.equationCollider, mesh);
    } else {
      statusLine.textContent = "Open a Meta World editor before inserting.";
    }
  });

  applyBtn.addEventListener("click", () => {
    if (!applyToTarget(activeTarget)) statusLine.textContent = "No equation object selected.";
  });

  closeBtn.addEventListener("click", () => {
    visible = false;
    activeTarget = null;
    floatingPanel.setVisible(false);
  });

  setConfig(DEFAULT_PLANE);

  return {
    open(config = DEFAULT_PLANE) {
      activeTarget = null;
      setConfig(config);
      statusLine.textContent = "Configure a plane, then insert it into the world.";
      showAttachedPane();
    },
    openForTarget(target) {
      if (!target) return false;
      activeTarget = target;
      setConfig(target.userData?.equationCollider || DEFAULT_PLANE, target);
      statusLine.textContent = "Edit the selected equation object.";
      showAttachedPane();
      return true;
    },
    isVisible() {
      return visible;
    },
    dispose() {
      window.removeEventListener("resize", handleWindowResize);
      floatingPanel.dispose();
    }
  };
}
