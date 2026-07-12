// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/GLBeditor.mjs
// GLB-focused graphical editor with panel-scoped 3D viewport selection/movement and layers integration.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { GLTFLoader } from "/lib/three/examples/jsm/loaders/GLTFLoader.js";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ensureSvgEditingSplit, loadPanelIntoCell } from "/panels/workspace.mjs";
import { mountWidget } from "/Widgets/WidgetHost.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";
import { exportSceneToSTL } from "/ModelExport/STLExport.mjs";

const NOTEBOOK_BASE = "/Notebook";
const LAYERS_PANEL_ID = "SVGLayersPanel";
const GLB_SELECTION_BOX_STYLE_ID = "nv-glb-editor-selection-box-styles";
const GLB_LIGHT_THEME = {
  shellBackground: "#f7f9fc",
  shellText: "#1f2937",
  barBackground: "#ffffff",
  barBorder: "#d7dee8",
  viewportBackground: "#ffffff",
  statusBackground: "#f3f6fa",
  statusText: "#334155",
  sceneBackground: 0xffffff,
  gridCenter: 0x94a3b8,
  gridLine: 0xd4dbe6,
};
const GLB_DARK_THEME = {
  shellBackground: "#101317",
  shellText: "#d9dee6",
  barBackground: "#141a22",
  barBorder: "#2b3340",
  viewportBackground: "#0f141b",
  statusBackground: "#121923",
  statusText: "#bfc8d6",
  sceneBackground: 0x0f141b,
  gridCenter: 0x445067,
  gridLine: 0x2b3444,
};

function ensureStyles() {
  if (document.getElementById(GLB_SELECTION_BOX_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GLB_SELECTION_BOX_STYLE_ID;
  style.textContent = `
    .nv-glb-selection-box {
      position: fixed;
      border: 1px solid #f59e0b;
      background: rgba(245, 158, 11, 0.14);
      pointer-events: none;
      z-index: 10000;
      display: none;
    }

    .nv-glb-animation-pane {
      flex: 0 0 auto;
      display: none;
      border-top: 1px solid #2b3340;
      padding: 8px 10px 10px;
      font: 12px/1.3 system-ui, -apple-system, Segoe UI, sans-serif;
      overflow: hidden;
    }

    .nv-glb-animation-pane.active {
      display: block;
    }

    .nv-glb-animation-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .nv-glb-animation-title {
      font-weight: 700;
      letter-spacing: 0;
    }

    .nv-glb-animation-meta {
      opacity: 0.72;
      white-space: nowrap;
    }

    .nv-glb-animation-strip {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 2px;
    }

    .nv-glb-animation-frame {
      flex: 0 0 128px;
      border: 1px solid #4b5563;
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.78);
      color: #e5e7eb;
      padding: 6px;
      cursor: pointer;
      user-select: none;
    }

    .nv-glb-animation-frame.selected {
      border-color: #60a5fa;
      box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.28);
    }

    .nv-glb-animation-frame.drag-over {
      border-color: #f59e0b;
    }

    .nv-glb-animation-thumb {
      width: 112px;
      height: 72px;
      display: block;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: #0b1020;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }

    .nv-glb-animation-placeholder {
      width: 112px;
      height: 72px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: #0b1020;
      color: #94a3b8;
      font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .nv-glb-animation-info {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      min-width: 0;
    }

    .nv-glb-animation-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 650;
    }

    .nv-glb-animation-time {
      opacity: 0.72;
      white-space: nowrap;
      font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .nv-glb-animation-actions {
      margin-left: auto;
      display: flex;
      gap: 6px;
    }

    .nv-glb-animation-btn {
      border: 1px solid #4b5563;
      border-radius: 5px;
      background: #111827;
      color: #e5e7eb;
      padding: 3px 7px;
      font: inherit;
      cursor: pointer;
    }

    .nv-glb-animation-btn:hover {
      background: #1f2937;
    }

    .nv-glb-animation-empty {
      padding: 10px 2px;
      color: inherit;
      opacity: 0.72;
      font: 12px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
    }
  `;
  document.head.appendChild(style);
}

function currentNodevisionTheme() {
  return document.documentElement?.dataset?.nvTheme === "dark" ? "dark" : "light";
}

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function notebookUrl(path = "") {
  const clean = String(path || "")
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/i, "");
  const encoded = clean
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${NOTEBOOK_BASE}/${encoded}`;
}

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    const inputType = (target.type || "").toLowerCase();
    return inputType !== "range" && inputType !== "color";
  }
  if (target.isContentEditable) return true;
  return !!target.closest(
    "textarea, input:not([type='range']):not([type='color']), [contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']",
  );
}

function disposeObject(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.geometry?.dispose) obj.geometry.dispose();
    const material = obj.material;
    if (Array.isArray(material)) {
      material.forEach((m) => m?.dispose && m.dispose());
    } else if (material?.dispose) {
      material.dispose();
    }
  });
}

function isSelectableBone(object) {
  return !!(object?.isBone && object?.userData?.nvInsertedBone === true);
}

function collectMovableObjects(root) {
  if (!root) return [];
  const unique = new Set();

  root.traverse((obj) => {
    if (isSelectableBone(obj)) {
      unique.add(obj);
      return;
    }

    if (!obj?.isMesh) return;
    let candidate = obj;
    while (candidate.parent && candidate.parent !== root) {
      candidate = candidate.parent;
    }
    if (!candidate || candidate === root) return;
    if (candidate.isCamera || candidate.isLight) return;
    if (candidate.isBone && !isSelectableBone(candidate)) return;
    unique.add(candidate);
  });

  if (unique.size === 0) {
    root.children.forEach((child) => {
      if (!child) return;
      if (child.isCamera || child.isLight) return;
      if (child.isBone && !isSelectableBone(child)) return;
      unique.add(child);
    });
  }

  return Array.from(unique);
}

function nameForObject(object, index = 0) {
  const named = String(object?.name || "").trim();
  if (named) return named;
  return `${object?.type || "Object"} ${index + 1}`;
}

function frameObject(camera, controls, object) {
  if (!camera || !controls || !object) return;
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = THREE.MathUtils.degToRad(camera.fov || 45);
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.8;

  camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = Math.max(distance * 100, 1000);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function resolveSelectableTarget(hitObject, root, selectableSet) {
  let cursor = hitObject;
  while (cursor && cursor !== root) {
    if (selectableSet.has(cursor)) return cursor;
    cursor = cursor.parent;
  }
  return null;
}


const GLB_TEXTURE_MAP_KEYS = [
  "map",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "gradientMap",
  "lightMap",
  "matcap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "specularColorMap",
  "specularIntensityMap",
  "specularMap",
  "thicknessMap",
  "transmissionMap",
];

function applyNearestTextureSampling(texture) {
  if (!texture || texture.__nvNearestPixelSampling) return;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.__nvNearestPixelSampling = true;
}

function applyPixelArtTextureSampling(root) {
  root?.traverse?.((node) => {
    const materials = Array.isArray(node?.material)
      ? node.material
      : [node?.material].filter(Boolean);
    materials.forEach((material) => {
      GLB_TEXTURE_MAP_KEYS.forEach((keyName) => applyNearestTextureSampling(material?.[keyName]));
    });
  });
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  ensureStyles();
  const previousCleanup =
    container.__nvActiveEditorCleanup || container.__nvGlbEditorCleanup;
  if (typeof previousCleanup === "function") {
    try {
      previousCleanup();
    } catch (err) {
      console.warn("GLB editor cleanup failed before reload:", err);
    }
  }
  container.__nvActiveEditorCleanup = null;
  container.__nvGlbEditorCleanup = null;
  container.innerHTML = "";

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "GraphicalEditing";
  window.NodevisionState.activeActionHandler = null;
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.activeEditorFilePath = filePath;
  window.NodevisionModelExportContext = null;
  updateToolbarState({
    currentMode: "GraphicalEditing",
    selectedFile: filePath,
    activeEditorFilePath: filePath,
    activeActionHandler: null,
    modelCanExportSTL: false,
    glbCanInsertBone: false,
  });

  const editorRoot = document.createElement("div");
  editorRoot.style.cssText =
    "display:flex;flex-direction:column;width:100%;height:100%;min-height:0;min-width:0;background:#101317;color:#d9dee6;";
  container.appendChild(editorRoot);

  const topBar = document.createElement("div");
  topBar.style.cssText =
    "display:flex;gap:12px;align-items:center;min-width:0;overflow:hidden;padding:8px 10px;border-bottom:1px solid #2b3340;background:#141a22;font:12px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;";
  editorRoot.appendChild(topBar);

  const pathLabel = document.createElement("div");
  pathLabel.style.cssText = "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  pathLabel.textContent = `GLB: ${filePath || "(none)"}`;
  topBar.appendChild(pathLabel);

  const hint = document.createElement("div");
  hint.style.cssText = "opacity:0.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;";
  hint.textContent = "Click/drag: select | Shift: add | Alt+drag: move on XZ | Insert > Bone: add rig bone";
  topBar.appendChild(hint);

  const viewport = document.createElement("div");
  viewport.style.cssText = "flex:1;min-height:0;min-width:0;width:100%;max-width:100%;position:relative;overflow:hidden;background:#0f141b;";
  editorRoot.appendChild(viewport);

  const status = document.createElement("div");
  status.style.cssText =
    "padding:6px 10px;border-top:1px solid #2b3340;background:#121923;font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#bfc8d6;";
  status.textContent = "Loading GLB model...";
  editorRoot.appendChild(status);

  const animationPane = document.createElement("section");
  animationPane.className = "nv-glb-animation-pane";
  animationPane.setAttribute("aria-label", "GLB animation frames");
  editorRoot.appendChild(animationPane);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f141b);

  const initialViewportRect = viewport.getBoundingClientRect();
  const width = Math.max(initialViewportRect.width || viewport.clientWidth || 1, 1);
  const height = Math.max(initialViewportRect.height || viewport.clientHeight || 1, 1);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
  camera.position.set(3, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.imageRendering = "pixelated";
  viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enableRotate = false;

  const orientationWidget = await mountWidget(ViewportOrientationWidget, {
    container: viewport,
    THREE,
    camera,
    controls,
    viewAdapter: {
      getCamera: () => camera,
      getControls: () => controls,
      getViewportElement: () => viewport,
      requestRender: () => {
        renderer.render(scene, camera);
        return true;
      },
    },
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.82));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(6, 10, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.52);
  fill.position.set(-6, 4, -8);
  scene.add(fill);

  let grid = new THREE.GridHelper(40, 40, 0x445067, 0x2b3444);
  scene.add(grid);
  const axesHelper = new THREE.AxesHelper(2.4);
  scene.add(axesHelper);

  function disposeMaterial(material) {
    if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
    else material?.dispose?.();
  }

  function applyViewportTheme(theme = currentNodevisionTheme()) {
    const colors = theme === "dark" ? GLB_DARK_THEME : GLB_LIGHT_THEME;
    editorRoot.style.background = colors.shellBackground;
    editorRoot.style.color = colors.shellText;
    topBar.style.background = colors.barBackground;
    topBar.style.borderBottomColor = colors.barBorder;
    viewport.style.background = colors.viewportBackground;
    status.style.background = colors.statusBackground;
    status.style.borderTopColor = colors.barBorder;
    status.style.color = colors.statusText;
    animationPane.style.background = colors.statusBackground;
    animationPane.style.borderTopColor = colors.barBorder;
    animationPane.style.color = colors.statusText;
    scene.background.set(colors.sceneBackground);

    scene.remove(grid);
    grid.geometry?.dispose?.();
    disposeMaterial(grid.material);
    grid = new THREE.GridHelper(40, 40, colors.gridCenter, colors.gridLine);
    scene.add(grid);
  }

  const onThemeChanged = (event) => applyViewportTheme(event?.detail?.theme || currentNodevisionTheme());
  applyViewportTheme();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane();
  const dragHit = new THREE.Vector3();
  const dragOffset = new THREE.Vector3();
  const worldPos = new THREE.Vector3();
  const localPos = new THREE.Vector3();
  const clock = new THREE.Clock();

  const layerListeners = new Set();
  const state = {
    destroyed: false,
    root: null,
    mixer: null,
    selectableObjects: [],
    selectableSet: new Set(),
    selectedObjects: new Set(),
    selectedObject: null,
    selectedHelper: null,
    dragActive: false,
    dragObject: null,
    dragItems: [],
    dragAnchorStartWorld: new THREE.Vector3(),
    moveStep: 0.1,
    selectionBox: null,
    animationClips: [],
    animationActions: [],
    animationFrames: [],
    selectedAnimationFrameId: null,
    animationPaneVisible: false,
    animationPreviewLocked: false,
    animationThumbnailRequest: 0,
    meshEdit: null,
  };

  function setStatus(text) {
    status.textContent = String(text || "");
  }

  function notifyLayersChanged() {
    layerListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn("GLB layers listener error:", err);
      }
    });
  }

  function layerEntries() {
    return state.selectableObjects.map((obj, index) => ({
      uuid: obj.uuid,
      label: nameForObject(obj, index),
      visible: obj.visible !== false,
      selected: state.selectedObjects.has(obj),
      type: obj.type || "Object3D",
      pos: obj.position ? {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z,
      } : { x: 0, y: 0, z: 0 },
    }));
  }

  function disposeSelectionHelper() {
    if (!state.selectedHelper) return;
    scene.remove(state.selectedHelper);
    state.selectedHelper.traverse?.((node) => {
      node.geometry?.dispose?.();
      disposeMaterial(node.material);
    });
    state.selectedHelper.geometry?.dispose?.();
    disposeMaterial(state.selectedHelper.material);
    state.selectedHelper = null;
  }

  function rebuildSelectionHelper() {
    disposeSelectionHelper();
    if (state.selectedObjects.size === 0) return;
    const group = new THREE.Group();
    group.name = "GLBSelectionHelpers";
    state.selectedObjects.forEach((obj) => {
      const helper = new THREE.BoxHelper(obj, obj === state.selectedObject ? 0xf5c542 : 0x7dd3fc);
      group.add(helper);
    });
    state.selectedHelper = group;
    scene.add(state.selectedHelper);
  }

  function updateSelectionHelper() {
    if (!state.selectedHelper) return;
    if (state.selectedHelper.children?.length) {
      state.selectedHelper.children.forEach((child) => child.update?.());
      return;
    }
    state.selectedHelper.update?.();
  }

  function setSelection(objects = [], options = {}) {
    const unique = [];
    const seen = new Set();
    objects.forEach((obj) => {
      if (!obj || !state.selectableSet.has(obj) || seen.has(obj)) return;
      seen.add(obj);
      unique.push(obj);
    });

    state.selectedObjects = new Set(unique);
    state.selectedObject = unique[0] || null;
    rebuildSelectionHelper();
    refreshMeshEditForSelection();
    notifyLayersChanged();

    if (unique.length === 0) {
      setStatus("No object selected.");
      return;
    }

    if (unique.length === 1) {
      const target = unique[0];
      const idx = state.selectableObjects.indexOf(target);
      const label = nameForObject(target, idx >= 0 ? idx : 0);
      setStatus(`Selected: ${label}`);
      if (options.focus) frameObject(camera, controls, target);
      return;
    }

    setStatus(`Selected: ${unique.length} objects.`);
  }

  function selectObject(object, options = {}) {
    setSelection(object ? [object] : [], options);
  }

  function selectByUuid(uuid, options = {}) {
    const target = state.selectableObjects.find((obj) => obj.uuid === uuid) || null;
    selectObject(target, options);
  }

  function setObjectVisibility(uuid, visible) {
    const target = state.selectableObjects.find((obj) => obj.uuid === uuid);
    if (!target) return;
    target.visible = !!visible;
    if (state.selectedObjects.has(target) && !target.visible) {
      setSelection(Array.from(state.selectedObjects).filter((obj) => obj !== target));
    } else {
      notifyLayersChanged();
    }
  }

  function nudgeSelected(dx, dy, dz) {
    const targets = Array.from(state.selectedObjects);
    if (!targets.length) return;
    targets.forEach((target) => {
      target.position.x += Number(dx || 0);
      target.position.y += Number(dy || 0);
      target.position.z += Number(dz || 0);
    });
    updateSelectionHelper();
    notifyLayersChanged();
  }

  function attachLayersHost(host) {
    if (!host) return () => {};
    host.innerHTML = "";
    host.style.cssText = "display:flex;flex-direction:column;height:100%;min-height:0;gap:8px;";

    const controlsRow = document.createElement("div");
    controlsRow.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
    host.appendChild(controlsRow);

    const stepLabel = document.createElement("label");
    stepLabel.style.cssText = "display:flex;gap:6px;align-items:center;font:12px system-ui,-apple-system,Segoe UI,sans-serif;";
    stepLabel.textContent = "Step";
    const stepInput = document.createElement("input");
    stepInput.type = "number";
    stepInput.min = "0.001";
    stepInput.max = "1000";
    stepInput.step = "0.01";
    stepInput.value = String(state.moveStep);
    stepInput.style.cssText = "width:76px;height:24px;";
    stepLabel.appendChild(stepInput);
    controlsRow.appendChild(stepLabel);

    const moves = [
      { label: "X-", delta: [-1, 0, 0] },
      { label: "X+", delta: [1, 0, 0] },
      { label: "Y-", delta: [0, -1, 0] },
      { label: "Y+", delta: [0, 1, 0] },
      { label: "Z-", delta: [0, 0, -1] },
      { label: "Z+", delta: [0, 0, 1] },
    ];
    moves.forEach((entry) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = entry.label;
      btn.style.cssText = "height:24px;padding:0 8px;";
      btn.addEventListener("click", () => {
        const step = clamp(stepInput.value, 0.001, 1000, state.moveStep);
        state.moveStep = step;
        nudgeSelected(entry.delta[0] * step, entry.delta[1] * step, entry.delta[2] * step);
      });
      controlsRow.appendChild(btn);
    });

    stepInput.addEventListener("change", () => {
      const step = clamp(stepInput.value, 0.001, 1000, state.moveStep);
      state.moveStep = step;
      stepInput.value = String(step);
    });

    const list = document.createElement("div");
    list.style.cssText = "flex:1;min-height:0;overflow:auto;border:1px solid #d4d8df;border-radius:6px;";
    host.appendChild(list);

    const renderList = () => {
      list.innerHTML = "";
      const entries = layerEntries();
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding:10px;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#576172;";
        empty.textContent = "No movable objects found in this GLB.";
        list.appendChild(empty);
        return;
      }

      entries.forEach((entry) => {
        const row = document.createElement("div");
        row.style.cssText = [
          "display:flex",
          "align-items:center",
          "gap:8px",
          "padding:6px 8px",
          "border-bottom:1px solid #ebedf2",
          "cursor:pointer",
          entry.selected ? "background:#e8efff;" : "background:transparent;",
        ].join(";");

        const visible = document.createElement("input");
        visible.type = "checkbox";
        visible.checked = entry.visible;
        visible.title = "Visible";
        visible.addEventListener("click", (evt) => evt.stopPropagation());
        visible.addEventListener("change", () => setObjectVisibility(entry.uuid, visible.checked));
        row.appendChild(visible);

        const name = document.createElement("div");
        name.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;";
        name.textContent = `${entry.label} (${entry.type})`;
        row.appendChild(name);

        const pos = document.createElement("div");
        pos.style.cssText = "font:11px ui-monospace,SFMono-Regular,Menlo,monospace;opacity:0.72;white-space:nowrap;";
        pos.textContent = `${entry.pos.x.toFixed(2)}, ${entry.pos.y.toFixed(2)}, ${entry.pos.z.toFixed(2)}`;
        row.appendChild(pos);

        row.addEventListener("click", () => selectByUuid(entry.uuid, { focus: true }));
        list.appendChild(row);
      });
    };

    const listener = () => renderList();
    layerListeners.add(listener);
    renderList();
    return () => {
      layerListeners.delete(listener);
    };
  }


  function stopAnimationActions() {
    state.animationActions.forEach((action) => {
      if (!action) return;
      action.stop();
      action.enabled = false;
      action.paused = false;
    });
  }

  function resetAnimationSequence() {
    state.animationThumbnailRequest += 1;
    stopAnimationActions();
    state.animationClips = [];
    state.animationActions = [];
    state.animationFrames = [];
    state.selectedAnimationFrameId = null;
    state.animationPreviewLocked = false;
    renderAnimationPane();
  }

  function collectClipFrameTimes(clip) {
    const duration = Number.isFinite(clip?.duration) ? Math.max(clip.duration, 0) : 0;
    const times = new Set([0]);
    (clip?.tracks || []).forEach((track) => {
      Array.from(track?.times || []).forEach((time) => {
        if (!Number.isFinite(time)) return;
        const bounded = clamp(time, 0, Math.max(duration, time), 0);
        times.add(Math.round(bounded * 1000) / 1000);
      });
    });
    if (duration > 0) times.add(Math.round(duration * 1000) / 1000);
    return Array.from(times)
      .filter((time) => Number.isFinite(time) && time >= 0)
      .sort((a, b) => a - b);
  }

  function buildAnimationFrameSequence(clips) {
    const frames = [];
    clips.forEach((clip, clipIndex) => {
      const clipName = String(clip?.name || `Clip ${clipIndex + 1}`).trim();
      collectClipFrameTimes(clip).forEach((time, clipFrameIndex) => {
        frames.push({
          id: `${clipIndex}:${clipName}:${clipFrameIndex}:${time.toFixed(3)}`,
          clip,
          clipIndex,
          clipName,
          clipFrameIndex,
          time,
          thumbnail: "",
        });
      });
    });
    state.animationFrames = frames;
    state.selectedAnimationFrameId = frames[0]?.id || null;
    renderAnimationPane();
  }

  function playAllAnimations() {
    if (!state.mixer || state.animationActions.length === 0) return;
    state.animationPreviewLocked = false;
    state.animationActions.forEach((action) => {
      if (!action) return;
      action.enabled = true;
      action.paused = false;
      action.reset().play();
    });
  }

  function seekAnimationFrame(frame, options = {}) {
    if (!frame || !state.mixer) return;
    const select = options.select !== false;
    if (select) state.selectedAnimationFrameId = frame.id;

    state.animationPreviewLocked = true;
    stopAnimationActions();
    const action = state.animationActions[frame.clipIndex] || state.mixer.clipAction(frame.clip);
    if (action) {
      const duration = Math.max(Number(frame.clip?.duration) || frame.time || 0, frame.time || 0);
      action.enabled = true;
      action.paused = false;
      action.reset().play();
      action.time = clamp(frame.time, 0, duration, 0);
      state.mixer.update(0);
      action.paused = true;
    }

    updateSelectionHelper();
    controls.update();
    if (options.render !== false) {
      renderer.render(scene, camera);
      orientationWidget?.sync?.();
    }
    if (select) {
      const frameIndex = state.animationFrames.findIndex((entry) => entry.id === frame.id);
      setStatus(`Animation frame ${frameIndex + 1}/${state.animationFrames.length}: ${frame.clipName} @ ${frame.time.toFixed(3)}s`);
      renderAnimationPane();
    }
  }

  function captureCurrentViewportThumbnail() {
    try {
      const thumb = document.createElement("canvas");
      thumb.width = 112;
      thumb.height = 72;
      const thumbCtx = thumb.getContext("2d", { alpha: false });
      if (!thumbCtx) return "";
      thumbCtx.imageSmoothingEnabled = false;
      thumbCtx.drawImage(renderer.domElement, 0, 0, thumb.width, thumb.height);
      return thumb.toDataURL("image/png");
    } catch (err) {
      console.warn("GLB animation thumbnail capture failed:", err);
      return "";
    }
  }

  function scheduleAnimationThumbnailCapture() {
    state.animationThumbnailRequest += 1;
    const requestId = state.animationThumbnailRequest;
    if (!state.animationPaneVisible || !state.root || state.animationFrames.length === 0) return;

    let index = 0;
    const previousSelectedId = state.selectedAnimationFrameId;
    const captureNext = () => {
      if (state.destroyed || requestId !== state.animationThumbnailRequest || !state.animationPaneVisible) return;
      const frame = state.animationFrames[index];
      if (!frame) return;
      seekAnimationFrame(frame, { select: false, render: true });
      frame.thumbnail = captureCurrentViewportThumbnail();
      index += 1;
      renderAnimationPane();
      if (index < state.animationFrames.length) {
        requestAnimationFrame(captureNext);
        return;
      }
      const selectedFrame = state.animationFrames.find((entry) => entry.id === previousSelectedId) || state.animationFrames[0];
      if (selectedFrame) seekAnimationFrame(selectedFrame, { select: true, render: true });
    };
    requestAnimationFrame(captureNext);
  }

  function selectAnimationFrame(frameId) {
    const frame = state.animationFrames.find((entry) => entry.id === frameId);
    if (!frame) return;
    seekAnimationFrame(frame, { select: true, render: true });
  }

  function moveAnimationFrame(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    const fromIndex = state.animationFrames.findIndex((entry) => entry.id === fromId);
    if (fromIndex < 0) return;
    const [frame] = state.animationFrames.splice(fromIndex, 1);
    const targetIndex = state.animationFrames.findIndex((entry) => entry.id === toId);
    state.animationFrames.splice(targetIndex < 0 ? state.animationFrames.length : targetIndex, 0, frame);
    renderAnimationPane();
  }

  function deleteAnimationFrame(frameId) {
    const index = state.animationFrames.findIndex((entry) => entry.id === frameId);
    if (index < 0) return;
    const [removed] = state.animationFrames.splice(index, 1);
    if (removed?.id === state.selectedAnimationFrameId) {
      state.selectedAnimationFrameId = state.animationFrames[Math.min(index, state.animationFrames.length - 1)]?.id || null;
    }
    renderAnimationPane();
    const selectedFrame = state.animationFrames.find((entry) => entry.id === state.selectedAnimationFrameId);
    if (selectedFrame) {
      seekAnimationFrame(selectedFrame, { select: true, render: true });
    } else {
      state.animationPreviewLocked = false;
      setStatus("Animation frame sequence is empty.");
    }
  }

  function showAnimationPane() {
    state.animationPaneVisible = true;
    animationPane.classList.add("active");
    renderAnimationPane();
    const selectedFrame = state.animationFrames.find((entry) => entry.id === state.selectedAnimationFrameId) || state.animationFrames[0];
    if (selectedFrame) seekAnimationFrame(selectedFrame, { select: true, render: true });
    scheduleAnimationThumbnailCapture();
  }

  function hideAnimationPane() {
    state.animationPaneVisible = false;
    state.animationThumbnailRequest += 1;
    animationPane.classList.remove("active");
    renderAnimationPane();
    playAllAnimations();
  }

  function toggleAnimationPane() {
    if (state.animationPaneVisible) hideAnimationPane();
    else showAnimationPane();
  }

  function renderAnimationPane() {
    animationPane.classList.toggle("active", state.animationPaneVisible);
    if (!state.animationPaneVisible) {
      animationPane.replaceChildren();
      return;
    }

    const head = document.createElement("div");
    head.className = "nv-glb-animation-head";

    const title = document.createElement("div");
    title.className = "nv-glb-animation-title";
    title.textContent = "Animation Frames";
    head.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "nv-glb-animation-meta";
    meta.textContent = state.animationFrames.length > 0
      ? `${state.animationFrames.length} frame${state.animationFrames.length === 1 ? "" : "s"}`
      : "No animation frames";
    head.appendChild(meta);

    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    head.appendChild(spacer);

    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.className = "nv-glb-animation-btn";
    refresh.textContent = "Refresh";
    refresh.addEventListener("click", scheduleAnimationThumbnailCapture);
    head.appendChild(refresh);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "nv-glb-animation-btn";
    close.textContent = "Close";
    close.addEventListener("click", hideAnimationPane);
    head.appendChild(close);

    const body = document.createElement("div");
    if (state.animationFrames.length === 0) {
      body.className = "nv-glb-animation-empty";
      body.textContent = state.animationClips.length === 0
        ? "This GLB does not expose animation clips."
        : "No keyframe times were found for the loaded animation clips.";
      animationPane.replaceChildren(head, body);
      return;
    }

    body.className = "nv-glb-animation-strip";
    state.animationFrames.forEach((frame, index) => {
      const card = document.createElement("div");
      card.className = `nv-glb-animation-frame${frame.id === state.selectedAnimationFrameId ? " selected" : ""}`;
      card.draggable = true;
      card.dataset.frameId = frame.id;
      card.title = "Drag to reorder";

      if (frame.thumbnail) {
        const img = document.createElement("img");
        img.className = "nv-glb-animation-thumb";
        img.alt = `Frame ${index + 1}`;
        img.draggable = false;
        img.src = frame.thumbnail;
        card.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "nv-glb-animation-placeholder";
        placeholder.textContent = `F${index + 1}`;
        card.appendChild(placeholder);
      }

      const info = document.createElement("div");
      info.className = "nv-glb-animation-info";

      const label = document.createElement("div");
      label.className = "nv-glb-animation-label";
      label.textContent = `${index + 1}. ${frame.clipName}`;
      info.appendChild(label);

      const time = document.createElement("div");
      time.className = "nv-glb-animation-time";
      time.textContent = `${frame.time.toFixed(3)}s`;
      info.appendChild(time);

      const actions = document.createElement("div");
      actions.className = "nv-glb-animation-actions";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "nv-glb-animation-btn";
      del.textContent = "Del";
      del.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteAnimationFrame(frame.id);
      });
      actions.appendChild(del);
      info.appendChild(actions);

      card.appendChild(info);
      card.addEventListener("click", () => selectAnimationFrame(frame.id));
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", frame.id);
      });
      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        card.classList.add("drag-over");
        event.dataTransfer.dropEffect = "move";
      });
      card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        card.classList.remove("drag-over");
        moveAnimationFrame(event.dataTransfer.getData("text/plain"), frame.id);
      });
      body.appendChild(card);
    });

    animationPane.replaceChildren(head, body);
  }

  const contextToken = Symbol("nv-glb-layers-context");
  window.GLBLayersContext = {
    id: "glb",
    title: "GLB Layers",
    token: contextToken,
    attachHost: attachLayersHost,
  };

  const animationContextToken = Symbol("nv-glb-animation-context");
  window.GLBAnimationContext = {
    id: "glb-animation",
    title: "GLB Animation Frames",
    token: animationContextToken,
    showPane: showAnimationPane,
    hidePane: hideAnimationPane,
    togglePane: toggleAnimationPane,
  };

  function exportSTL() {
    const hiddenDisplays = [];
    state.root?.traverse?.((node) => {
      if (!node?.userData?.nvBoneDisplay || node.visible === false) return;
      node.visible = false;
      hiddenDisplays.push(node);
    });

    try {
      exportSceneToSTL(state.root || scene, filePath);
    } finally {
      hiddenDisplays.forEach((node) => {
        node.visible = true;
      });
    }
  }

  const exportToken = Symbol("nv-glb-export-context");
  const glbEditorToken = Symbol("nv-glb-editor-context");
  window.NodevisionModelExportContext = {
    token: exportToken,
    kind: "glb-editor",
    filePath,
    exportSTL,
  };
  window.GLBEditorContext = {
    token: glbEditorToken,
    filePath,
    insertBone,
    handleToolbarAction: handleGLBToolbarAction,
    exportSTL,
  };
  window.NodevisionState.activeActionHandler = handleGLBToolbarAction;
  updateGLBToolbarState();

  function clearModel() {
    clearMeshEditOverlay();
    resetAnimationSequence();
    if (!state.root) {
      state.mixer = null;
      return;
    }
    scene.remove(state.root);
    disposeObject(state.root);
    state.root = null;
    state.mixer = null;
    state.selectableObjects = [];
    state.selectableSet = new Set();
    state.selectedObjects = new Set();
    selectObject(null);
  }

  function collectSelectableMeshes() {
    const meshes = [];
    state.selectableObjects.forEach((obj) => {
      obj.traverse((node) => {
        if (node?.isMesh) meshes.push(node);
      });
    });
    return meshes;
  }

  function addSelectableObject(object) {
    if (!object || state.selectableSet.has(object)) return;
    state.selectableObjects.push(object);
    state.selectableSet.add(object);
  }

  function defaultBoneLength() {
    const box = new THREE.Box3();
    if (state.root) box.setFromObject(state.root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    return clamp(maxDim > 0 ? maxDim * 0.12 : 0.35, 0.05, 5, 0.35);
  }

  function nextBoneName() {
    let count = 0;
    state.root?.traverse?.((node) => {
      if (node?.isBone) count += 1;
    });
    return "Bone " + (count + 1);
  }

  function createBoneDisplay(length) {
    const safeLength = clamp(length, 0.05, 1000, 0.35);
    const radius = Math.max(safeLength * 0.045, 0.018);
    const group = new THREE.Group();
    group.name = "Nodevision Bone Display";
    group.userData.nvBoneDisplay = true;

    const makeMaterial = () => new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
    });

    const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.35, 12, 8), makeMaterial());
    joint.name = "Bone Joint";

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.45, radius * 0.9, safeLength, 8),
      makeMaterial(),
    );
    shaft.name = "Bone Shaft";
    shaft.position.y = safeLength * 0.5;

    const tip = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 6), makeMaterial());
    tip.name = "Bone Tip";
    tip.position.y = safeLength;

    [joint, shaft, tip].forEach((mesh) => {
      mesh.renderOrder = 30;
      mesh.userData.nvBoneDisplay = true;
      group.add(mesh);
    });

    return group;
  }

  function objectWorldCenter(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (!box.isEmpty()) return box.getCenter(new THREE.Vector3());
    const position = new THREE.Vector3();
    object?.getWorldPosition?.(position);
    return position;
  }

  function positionBoneForInsertion(bone, parent, length) {
    if (parent?.isBone) {
      bone.position.set(0, Number(parent.userData?.nvBoneLength) || length, 0);
      return;
    }

    let worldTarget = null;
    if (state.selectedObject && state.selectedObject !== parent) {
      worldTarget = objectWorldCenter(state.selectedObject);
    }

    if (!worldTarget) {
      const box = new THREE.Box3();
      if (state.root) box.setFromObject(state.root);
      worldTarget = box.isEmpty() ? controls.target.clone() : box.getCenter(new THREE.Vector3());
    }

    parent?.updateMatrixWorld?.(true);
    if (parent) bone.position.copy(parent.worldToLocal(worldTarget.clone()));
    else bone.position.copy(worldTarget);
  }

  function insertBone() {
    if (!state.root) {
      setStatus("Load a GLB before inserting a bone.");
      return false;
    }

    const parent = state.selectedObject?.isBone ? state.selectedObject : state.root;
    const length = defaultBoneLength();
    const bone = new THREE.Bone();
    bone.name = nextBoneName();
    bone.userData = {
      ...(bone.userData || {}),
      nvInsertedBone: true,
      nvBoneLength: length,
    };
    bone.add(createBoneDisplay(length));
    positionBoneForInsertion(bone, parent, length);
    parent.add(bone);
    parent.updateMatrixWorld?.(true);
    bone.updateMatrixWorld?.(true);

    addSelectableObject(bone);
    selectObject(bone);
    updateSelectionHelper();
    notifyLayersChanged();

    const parentLabel = parent?.isBone ? " under " + (parent.name || "selected bone") : "";
    setStatus("Inserted bone: " + bone.name + parentLabel + ".");
    return true;
  }

  function handleGLBToolbarAction(callbackKey) {
    if (callbackKey === "glbInsertBone") return insertBone();
    if (callbackKey === "ExportSelectedModelAsSTL" || callbackKey === "exportModelAsSTL") return exportSTL();
    return false;
  }

  function updateGLBToolbarState(extra = {}) {
    updateToolbarState({
      currentMode: "GraphicalEditing",
      activePanelType: "GraphicalEditor",
      selectedFile: filePath,
      activeEditorFilePath: filePath,
      activeActionHandler: handleGLBToolbarAction,
      modelCanExportSTL: true,
      glbCanInsertBone: true,
      ...extra,
    });
  }

  function meshEditEdgeKey(a, b) {
    return a < b ? String(a) + ":" + String(b) : String(b) + ":" + String(a);
  }

  function firstMeshInObject(object) {
    let found = null;
    object?.traverse?.((node) => {
      if (!found && node?.isMesh && node.geometry?.getAttribute?.("position")) found = node;
    });
    return found;
  }

  function clearMeshEditOverlay() {
    const edit = state.meshEdit;
    if (edit?.overlay?.parent) edit.overlay.parent.remove(edit.overlay);
    if (edit?.overlay) disposeObject(edit.overlay);
    state.meshEdit = null;
  }

  function meshTopologyFromGeometry(mesh) {
    const geometry = mesh?.geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position || !Number.isFinite(position.count) || position.count < 3) return null;
    const vertices = [];
    for (let i = 0; i < position.count; i += 1) vertices.push(new THREE.Vector3().fromBufferAttribute(position, i));
    const faces = [];
    const index = geometry.index || null;
    if (index) {
      for (let i = 0; i + 2 < index.count; i += 3) faces.push([index.getX(i), index.getX(i + 1), index.getX(i + 2)]);
    } else {
      for (let i = 0; i + 2 < position.count; i += 3) faces.push([i, i + 1, i + 2]);
    }
    return { vertices, faces, customEdges: [] };
  }

  function refreshMeshEditForSelection() {
    const selected = Array.from(state.selectedObjects || []);
    const mesh = selected.length === 1 ? firstMeshInObject(selected[0]) : null;
    if (state.meshEdit?.mesh === mesh) return;
    clearMeshEditOverlay();
    if (!mesh) return;
    const topology = meshTopologyFromGeometry(mesh);
    if (!topology) return;
    state.meshEdit = { mesh, topology, overlay: null, vertexPoints: null, selectedVertices: new Set(), grab: null };
    rebuildMeshEditOverlay();
  }

  function meshEditEdges(edit = state.meshEdit) {
    const edges = new Map();
    const add = (a, b) => {
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return;
      const key = meshEditEdgeKey(a, b);
      if (!edges.has(key)) edges.set(key, [a, b]);
    };
    for (const face of edit?.topology?.faces || []) {
      if (!Array.isArray(face) || face.length < 3) continue;
      for (let i = 0; i < face.length; i += 1) add(face[i], face[(i + 1) % face.length]);
    }
    for (const edge of edit?.topology?.customEdges || []) add(edge[0], edge[1]);
    return Array.from(edges.values());
  }

  function rebuildMeshEditOverlay() {
    const edit = state.meshEdit;
    if (!edit?.mesh || !edit.topology) return;
    if (edit.overlay?.parent) edit.overlay.parent.remove(edit.overlay);
    if (edit.overlay) disposeObject(edit.overlay);
    const overlay = new THREE.Group();
    overlay.name = "GLBMeshEditOverlay";
    overlay.renderOrder = 20;

    const edgePositions = [];
    meshEditEdges(edit).forEach(([a, b]) => {
      const va = edit.topology.vertices[a];
      const vb = edit.topology.vertices[b];
      if (!va || !vb) return;
      edgePositions.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
    });
    if (edgePositions.length) {
      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
      overlay.add(new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55, depthTest: false })));
    }

    const vertexPositions = [];
    edit.topology.vertices.forEach((vertex) => vertexPositions.push(vertex.x, vertex.y, vertex.z));
    const vertexGeometry = new THREE.BufferGeometry();
    vertexGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertexPositions, 3));
    edit.vertexPoints = new THREE.Points(vertexGeometry, new THREE.PointsMaterial({ color: 0xffcc00, size: 0.04, depthTest: false }));
    overlay.add(edit.vertexPoints);

    if (edit.selectedVertices.size) {
      const selectedPositions = [];
      edit.selectedVertices.forEach((index) => {
        const vertex = edit.topology.vertices[index];
        if (vertex) selectedPositions.push(vertex.x, vertex.y, vertex.z);
      });
      if (selectedPositions.length) {
        const selectedGeometry = new THREE.BufferGeometry();
        selectedGeometry.setAttribute("position", new THREE.Float32BufferAttribute(selectedPositions, 3));
        overlay.add(new THREE.Points(selectedGeometry, new THREE.PointsMaterial({ color: 0xff3333, size: 0.07, depthTest: false })));
      }
    }

    edit.overlay = overlay;
    edit.mesh.add(overlay);
  }

  function rebuildMeshGeometryFromTopology(edit = state.meshEdit) {
    if (!edit?.mesh || !edit.topology) return false;
    const positions = [];
    edit.topology.vertices.forEach((vertex) => positions.push(vertex.x, vertex.y, vertex.z));
    const indices = [];
    edit.topology.faces.forEach((face) => {
      if (Array.isArray(face) && face.length === 3) indices.push(face[0], face[1], face[2]);
      else if (Array.isArray(face) && face.length > 3) {
        for (let i = 1; i < face.length - 1; i += 1) indices.push(face[0], face[i], face[i + 1]);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    edit.mesh.geometry?.dispose?.();
    edit.mesh.geometry = geometry;
    rebuildMeshEditOverlay();
    updateSelectionHelper();
    return true;
  }

  function meshHasEdge(a, b, edit = state.meshEdit) {
    const key = meshEditEdgeKey(a, b);
    return meshEditEdges(edit).some((edge) => meshEditEdgeKey(edge[0], edge[1]) === key);
  }

  function meshFaceNormal(face, edit = state.meshEdit) {
    const vertices = edit?.topology?.vertices || [];
    const a = vertices[face?.[0]];
    const b = vertices[face?.[1]];
    const c = vertices[face?.[2]];
    if (!a || !b || !c) return new THREE.Vector3();
    return new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  }

  function meshCentroid(indices = [], edit = state.meshEdit) {
    const centroid = new THREE.Vector3();
    let count = 0;
    indices.forEach((index) => {
      const vertex = edit?.topology?.vertices?.[index];
      if (!vertex) return;
      centroid.add(vertex);
      count += 1;
    });
    if (count > 0) centroid.multiplyScalar(1 / count);
    return centroid;
  }

  function meshFallbackOffset(indices = [], normalHint = null, edit = state.meshEdit) {
    const box = new THREE.Box3();
    (edit?.topology?.vertices || []).forEach((vertex) => box.expandByPoint(vertex));
    const size = box.getSize(new THREE.Vector3());
    const distance = Math.max(0.001, Math.max(size.x, size.y, size.z, 1) * 0.06);
    const direction = normalHint?.isVector3 && normalHint.lengthSq() > 1e-12 ? normalHint.clone().normalize() : new THREE.Vector3(1, 0, 0);
    return direction.multiplyScalar(distance);
  }

  function startMeshVertexGrab(indices = [], event = null, centroidOverride = null, startOverrides = null) {
    const edit = state.meshEdit;
    if (!edit?.mesh || !edit.topology) return false;
    const unique = Array.from(new Set(indices.filter((index) => Number.isInteger(index) && edit.topology.vertices[index])));
    if (!unique.length) return false;
    const overrides = startOverrides instanceof Map ? startOverrides : new Map();
    edit.selectedVertices = new Set(unique);
    const centroidLocal = centroidOverride?.isVector3 ? centroidOverride.clone() : meshCentroid(unique, edit);
    const centroidWorld = edit.mesh.localToWorld(centroidLocal.clone());
    const cameraDir = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const rect = renderer.domElement.getBoundingClientRect();
    edit.grab = {
      entries: unique.map((index) => ({ index, start: (overrides.get(index) || edit.topology.vertices[index]).clone() })),
      startMouse: new THREE.Vector2(Number.isFinite(event?.clientX) ? event.clientX : rect.left + rect.width * 0.5, Number.isFinite(event?.clientY) ? event.clientY : rect.top + rect.height * 0.5),
      centroidLocal,
      centroidWorld,
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, centroidWorld),
    };
    controls.enabled = false;
    rebuildMeshEditOverlay();
    setStatus("Mesh grab: move mouse, click/Enter to confirm, Esc to cancel.");
    return true;
  }

  function updateMeshVertexGrab(event) {
    const edit = state.meshEdit;
    const grab = edit?.grab;
    if (!edit?.mesh || !grab) return false;
    const rect = renderer.domElement.getBoundingClientRect();
    const start = new THREE.Vector2(((grab.startMouse.x - rect.left) / Math.max(rect.width, 1)) * 2 - 1, -(((grab.startMouse.y - rect.top) / Math.max(rect.height, 1)) * 2 - 1));
    const end = new THREE.Vector2(((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1, -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1));
    const startRay = new THREE.Raycaster();
    const endRay = new THREE.Raycaster();
    startRay.setFromCamera(start, camera);
    endRay.setFromCamera(end, camera);
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    if (!startRay.ray.intersectPlane(grab.plane, p0) || !endRay.ray.intersectPlane(grab.plane, p1)) return true;
    const targetLocal = edit.mesh.worldToLocal(grab.centroidWorld.clone().add(new THREE.Vector3().subVectors(p1, p0)));
    const deltaLocal = targetLocal.sub(grab.centroidLocal);
    grab.entries.forEach((entry) => {
      edit.topology.vertices[entry.index].copy(entry.start).add(deltaLocal);
    });
    rebuildMeshGeometryFromTopology(edit);
    return true;
  }

  function finishMeshVertexGrab(cancel = false) {
    const edit = state.meshEdit;
    const grab = edit?.grab;
    if (!edit || !grab) return false;
    edit.grab = null;
    controls.enabled = true;
    if (cancel) {
      grab.entries.forEach((entry) => edit.topology.vertices[entry.index].copy(entry.start));
      rebuildMeshGeometryFromTopology(edit);
      setStatus("Mesh grab canceled.");
      return true;
    }
    setStatus("Mesh grab confirmed.");
    return true;
  }

  function selectedMeshFaces(edit = state.meshEdit) {
    const faces = [];
    const selected = edit?.selectedVertices || new Set();
    (edit?.topology?.faces || []).forEach((face, index) => {
      if (face.every((vertexIndex) => selected.has(vertexIndex))) faces.push(index);
    });
    return faces;
  }

  function extrudeMeshEdge(edit, selected, event = null) {
    const [a, b] = selected;
    if (!meshHasEdge(a, b, edit)) return false;
    const va = edit.topology.vertices[a];
    const vb = edit.topology.vertices[b];
    const midpoint = new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5);
    const offset = meshFallbackOffset(selected, null, edit);
    const a2 = edit.topology.vertices.length;
    const b2 = a2 + 1;
    edit.topology.vertices.push(va.clone().add(offset), vb.clone().add(offset));
    edit.topology.faces.push([a, b, b2], [a, b2, a2]);
    edit.topology.customEdges.push([a, a2], [b, b2], [a2, b2]);
    rebuildMeshGeometryFromTopology(edit);
    startMeshVertexGrab([a2, b2], event, midpoint, new Map([[a2, va], [b2, vb]]));
    return true;
  }

  function extrudeMeshFaces(edit, faceIndices = [], event = null) {
    const sourceSet = new Set();
    const normal = new THREE.Vector3();
    faceIndices.forEach((faceIndex) => {
      const face = edit.topology.faces[faceIndex];
      face.forEach((index) => sourceSet.add(index));
      normal.add(meshFaceNormal(face, edit));
    });
    const source = Array.from(sourceSet);
    if (source.length < 3) return false;
    const offset = meshFallbackOffset(source, normal, edit);
    const centroid = meshCentroid(source, edit);
    const oldToNew = new Map();
    const overrides = new Map();
    source.forEach((index) => {
      const vertex = edit.topology.vertices[index];
      const newIndex = edit.topology.vertices.length;
      edit.topology.vertices.push(vertex.clone().add(offset));
      oldToNew.set(index, newIndex);
      overrides.set(newIndex, vertex.clone());
    });
    faceIndices.forEach((faceIndex) => {
      const copy = edit.topology.faces[faceIndex].map((index) => oldToNew.get(index));
      edit.topology.faces.push(copy);
    });
    const counts = new Map();
    const oriented = new Map();
    faceIndices.forEach((faceIndex) => {
      const face = edit.topology.faces[faceIndex];
      for (let i = 0; i < face.length; i += 1) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        const key = meshEditEdgeKey(a, b);
        counts.set(key, (counts.get(key) || 0) + 1);
        if (!oriented.has(key)) oriented.set(key, [a, b]);
      }
    });
    counts.forEach((count, key) => {
      if (count !== 1) return;
      const [a, b] = oriented.get(key);
      const a2 = oldToNew.get(a);
      const b2 = oldToNew.get(b);
      edit.topology.faces.push([a, b, b2], [a, b2, a2]);
      edit.topology.customEdges.push([a, a2], [b, b2], [a2, b2]);
    });
    rebuildMeshGeometryFromTopology(edit);
    startMeshVertexGrab(Array.from(oldToNew.values()), event, centroid, overrides);
    return true;
  }

  function extrudeMeshSelection(event = null) {
    const edit = state.meshEdit;
    if (!edit?.selectedVertices?.size) return false;
    const selected = Array.from(edit.selectedVertices);
    if (selected.length === 2) {
      if (extrudeMeshEdge(edit, selected, event)) return true;
      setStatus("Selected mesh vertices are not joined by an edge.");
      return false;
    }
    const faces = selectedMeshFaces(edit);
    if (faces.length && extrudeMeshFaces(edit, faces, event)) return true;
    setStatus("Selected mesh vertices do not define a face.");
    return false;
  }

  function pickMeshVertex(event) {
    const edit = state.meshEdit;
    if (!edit?.vertexPoints || edit.grab) return false;
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(edit.vertexPoints, false);
    const index = hits[0]?.index;
    if (!Number.isInteger(index)) return false;
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      if (edit.selectedVertices.has(index)) edit.selectedVertices.delete(index);
      else edit.selectedVertices.add(index);
    } else {
      edit.selectedVertices = new Set([index]);
    }
    rebuildMeshEditOverlay();
    setStatus(edit.selectedVertices.size + " mesh vertex" + (edit.selectedVertices.size === 1 ? "" : "es") + " selected. E extrudes an edge or face; G grabs.");
    return true;
  }

  function setPointerFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  }

  function startDrag(event, target) {
    if (!target) return;
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    target.getWorldPosition(worldPos);
    dragPlane.set(new THREE.Vector3(0, 1, 0), -worldPos.y);
    dragOffset.set(0, 0, 0);
    if (raycaster.ray.intersectPlane(dragPlane, dragHit)) {
      dragOffset.copy(worldPos).sub(dragHit);
    }
    state.dragObject = target;
    state.dragAnchorStartWorld.copy(worldPos);
    const dragObjects = state.selectedObjects.has(target)
      ? Array.from(state.selectedObjects)
      : [target];
    state.dragItems = dragObjects.map((obj) => ({
      object: obj,
      startWorld: obj.getWorldPosition(new THREE.Vector3()),
    }));
    state.dragActive = true;
    controls.enabled = false;
    renderer.domElement.style.cursor = "grabbing";
  }

  function stopDrag() {
    if (!state.dragActive) return;
    state.dragActive = false;
    state.dragObject = null;
    state.dragItems = [];
    controls.enabled = true;
    renderer.domElement.style.cursor = "";
    notifyLayersChanged();
  }

  function pickObject(event) {
    const hits = raycaster.intersectObjects(collectSelectableMeshes(), true);
    const target = hits.length
      ? resolveSelectableTarget(hits[0].object, state.root, state.selectableSet)
      : null;

    if (!target) {
      if (!event.shiftKey) selectObject(null);
      return;
    }

    if (event.shiftKey) {
      const next = new Set(state.selectedObjects);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      setSelection(Array.from(next));
      return;
    }

    selectObject(target);
  }

  function ensureSelectionBoxElement() {
    if (state.selectionBox?.el) return state.selectionBox.el;
    const el = document.createElement("div");
    el.className = "nv-glb-selection-box";
    document.body.appendChild(el);
    if (state.selectionBox) state.selectionBox.el = el;
    return el;
  }

  function updateSelectionBoxElement() {
    const box = state.selectionBox;
    if (!box) return;
    const el = ensureSelectionBoxElement();
    const left = Math.min(box.startX, box.currentX);
    const top = Math.min(box.startY, box.currentY);
    const width = Math.abs(box.currentX - box.startX);
    const height = Math.abs(box.currentY - box.startY);
    box.moved = box.moved || width > 4 || height > 4;
    Object.assign(el.style, {
      display: box.moved ? "block" : "none",
      left: String(left) + "px",
      top: String(top) + "px",
      width: String(width) + "px",
      height: String(height) + "px",
    });
  }

  function startSelectionBox(event) {
    state.selectionBox = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      moved: false,
      shiftKey: event.shiftKey,
      el: null,
    };
    updateSelectionBoxElement();
  }

  function updateSelectionBox(event) {
    const box = state.selectionBox;
    if (!box) return false;
    box.currentX = event.clientX;
    box.currentY = event.clientY;
    updateSelectionBoxElement();
    return true;
  }

  function rectsIntersect(a, b) {
    return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
  }

  function screenBoundsForObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const rect = renderer.domElement.getBoundingClientRect();
    const points = [];

    if (box.isEmpty()) {
      points.push(object.getWorldPosition(new THREE.Vector3()));
    } else {
      points.push(
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      );
    }

    camera.updateMatrixWorld?.();
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let hasPoint = false;

    points.forEach((point) => {
      const projected = point.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) return;
      const x = rect.left + (projected.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-projected.y * 0.5 + 0.5) * rect.height;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      hasPoint = true;
    });

    return hasPoint ? { left, right, top, bottom } : null;
  }

  function selectObjectsInBox(box) {
    const selectionRect = {
      left: Math.min(box.startX, box.currentX),
      right: Math.max(box.startX, box.currentX),
      top: Math.min(box.startY, box.currentY),
      bottom: Math.max(box.startY, box.currentY),
    };
    const next = box.shiftKey ? new Set(state.selectedObjects) : new Set();

    state.selectableObjects.forEach((obj) => {
      if (!obj || obj.visible === false) return;
      const objectRect = screenBoundsForObject(obj);
      if (objectRect && rectsIntersect(selectionRect, objectRect)) next.add(obj);
    });

    setSelection(Array.from(next));
  }

  function finishSelectionBox(event) {
    const box = state.selectionBox;
    if (!box) return false;
    box.currentX = event.clientX;
    box.currentY = event.clientY;
    updateSelectionBoxElement();
    const moved = box.moved;
    if (moved) {
      selectObjectsInBox(box);
    } else if (!pickMeshVertex(event)) {
      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      pickObject(event);
    }
    box.el?.remove?.();
    state.selectionBox = null;
    return true;
  }

  function onPointerDown(event) {
    if (state.meshEdit?.grab) {
      event.preventDefault();
      finishMeshVertexGrab(false);
      return;
    }
    if (event.button !== 0) return;
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(collectSelectableMeshes(), true);
    const target = hits.length
      ? resolveSelectableTarget(hits[0].object, state.root, state.selectableSet)
      : null;

    if (event.altKey) {
      if (!target) return;
      event.preventDefault();
      if (!state.selectedObjects.has(target)) selectObject(target);
      startDrag(event, target);
      return;
    }

    event.preventDefault();
    startSelectionBox(event);
  }

  function onPointerMove(event) {
    if (updateMeshVertexGrab(event)) return;
    if (updateSelectionBox(event)) return;
    if (!state.dragActive || !state.dragObject) return;
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, dragHit)) return;

    const nextAnchorWorld = dragHit.clone().add(dragOffset);
    const delta = nextAnchorWorld.sub(state.dragAnchorStartWorld);
    state.dragItems.forEach(({ object, startWorld }) => {
      worldPos.copy(startWorld).add(delta);
      const parent = object.parent;
      if (parent) {
        localPos.copy(worldPos);
        parent.worldToLocal(localPos);
        object.position.copy(localPos);
      } else {
        object.position.copy(worldPos);
      }
    });
    updateSelectionHelper();
  }

  function onPointerUp(event) {
    if (finishSelectionBox(event)) return;
    stopDrag();
  }

  function onResize() {
    if (state.destroyed) return;
    const rect = viewport.getBoundingClientRect();
    const w = Math.max(rect.width || viewport.clientWidth || 1, 1);
    const h = Math.max(rect.height || viewport.clientHeight || 1, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function onKeyDown(event) {
    if (isEditableTarget(event.target)) return;
    const key = String(event.key || "").toLowerCase();
    if (state.meshEdit?.grab) {
      if (key === "escape") {
        event.preventDefault();
        finishMeshVertexGrab(true);
      } else if (key === "enter") {
        event.preventDefault();
        finishMeshVertexGrab(false);
      }
      return;
    }
    if (key === "e" && state.meshEdit?.selectedVertices?.size) {
      event.preventDefault();
      extrudeMeshSelection(event);
      return;
    }
    if (key === "g" && state.meshEdit?.selectedVertices?.size) {
      event.preventDefault();
      startMeshVertexGrab(Array.from(state.meshEdit.selectedVertices), event);
      return;
    }
    if (state.selectedObjects.size === 0) return;

    const step = event.shiftKey ? state.moveStep * 10 : state.moveStep;
    let handled = true;
    switch (event.key) {
      case "ArrowLeft":
        nudgeSelected(-step, 0, 0);
        break;
      case "ArrowRight":
        nudgeSelected(step, 0, 0);
        break;
      case "ArrowUp":
        nudgeSelected(0, 0, -step);
        break;
      case "ArrowDown":
        nudgeSelected(0, 0, step);
        break;
      case "PageUp":
        nudgeSelected(0, step, 0);
        break;
      case "PageDown":
        nudgeSelected(0, -step, 0);
        break;
      default:
        handled = false;
        break;
    }
    if (handled) event.preventDefault();
  }

  function animate() {
    if (state.destroyed) return;
    const delta = clock.getDelta();
    if (state.mixer && !state.animationPreviewLocked) state.mixer.update(delta);
    updateSelectionHelper();
    controls.update();
    renderer.render(scene, camera);
    orientationWidget?.sync?.();
  }

  async function loadModel() {
    clearModel();
    return await new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        notebookUrl(filePath),
        (gltf) => {
          const root = gltf.scene || gltf.scenes?.[0];
          if (!root) {
            reject(new Error("GLB loaded but scene is empty."));
            return;
          }

          state.root = root;
          scene.add(root);
          applyPixelArtTextureSampling(root);

          state.animationClips = Array.isArray(gltf.animations) ? gltf.animations : [];
          buildAnimationFrameSequence(state.animationClips);
          if (state.animationClips.length > 0) {
            state.mixer = new THREE.AnimationMixer(root);
            state.animationActions = state.animationClips.map((clip) => state.mixer.clipAction(clip));
            playAllAnimations();
          }
          if (state.animationPaneVisible) {
            const selectedFrame = state.animationFrames.find((entry) => entry.id === state.selectedAnimationFrameId) || state.animationFrames[0];
            if (selectedFrame) seekAnimationFrame(selectedFrame, { select: true, render: true });
            scheduleAnimationThumbnailCapture();
          }

          const bounds = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
          const maxDim = Math.max(bounds.x, bounds.y, bounds.z) || 1;
          state.moveStep = clamp(maxDim * 0.02, 0.01, 5, 0.1);

          state.selectableObjects = collectMovableObjects(root);
          state.selectableSet = new Set(state.selectableObjects);
          frameObject(camera, controls, root);
          if (state.selectableObjects.length > 0) {
            selectObject(state.selectableObjects[0]);
          } else {
            setStatus("GLB loaded, but no movable objects were found.");
            notifyLayersChanged();
          }
          resolve();
        },
        undefined,
        (err) => reject(err),
      );
    });
  }

  async function ensureLayersPanelVisible() {
    try {
      const editorCell = container?.closest?.(".panel-cell");
      if (!editorCell) return;
      const { layersCell } = ensureSvgEditingSplit({ editorCell }) || {};
      if (!layersCell) return;

      const prevActiveCell = window.activeCell;
      window.activeCell = layersCell;
      layersCell.dataset.id = LAYERS_PANEL_ID;
      layersCell.dataset.panelClass = "InfoPanel";
      await loadPanelIntoCell(LAYERS_PANEL_ID, {
        id: LAYERS_PANEL_ID,
        displayName: "GLB Layers",
        providerId: "glb",
      });
      window.activeCell = editorCell;
      window.highlightActiveCell?.(editorCell);
      if (prevActiveCell && prevActiveCell !== editorCell) {
        window.activeCell = editorCell;
      }
    } catch (err) {
      console.warn("GLB editor: failed to auto-open layers panel:", err);
    }
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => onResize());
    resizeObserver.observe(viewport);
  } else {
    window.addEventListener("resize", onResize);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("nv-theme-changed", onThemeChanged);

  renderer.setAnimationLoop(animate);
  await ensureLayersPanelVisible();

  try {
    await loadModel();
    if (!state.animationPaneVisible) {
      setStatus("GLB ready. Select objects in viewport or Layers panel.");
    }
  } catch (err) {
    console.error("GLB editor load error:", err);
    setStatus(`Failed to load GLB: ${err?.message || err}`);
  }

  const cleanup = () => {
    state.destroyed = true;
    state.animationThumbnailRequest += 1;
    renderer.setAnimationLoop(null);
    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    if (resizeObserver) resizeObserver.disconnect();
    else window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("nv-theme-changed", onThemeChanged);
    controls.dispose();
    clearModel();
    disposeSelectionHelper();
    state.selectionBox?.el?.remove?.();
    state.selectionBox = null;
    renderer.dispose();
    orientationWidget?.destroy?.();
    layerListeners.clear();
    if (window.GLBLayersContext?.token === contextToken) {
      delete window.GLBLayersContext;
    }
    if (window.GLBAnimationContext?.token === animationContextToken) {
      delete window.GLBAnimationContext;
    }
    if (window.GLBEditorContext?.token === glbEditorToken) {
      delete window.GLBEditorContext;
    }
    if (window.NodevisionState?.activeActionHandler === handleGLBToolbarAction) {
      window.NodevisionState.activeActionHandler = null;
      updateToolbarState({ activeActionHandler: null, glbCanInsertBone: false });
    }
    if (window.NodevisionModelExportContext?.token === exportToken) {
      window.NodevisionModelExportContext = null;
      updateToolbarState({ modelCanExportSTL: false, glbCanInsertBone: false });
    }
    container.__nvActiveEditorCleanup = null;
    container.__nvGlbEditorCleanup = null;
  };
  container.__nvGlbEditorCleanup = cleanup;
  container.__nvActiveEditorCleanup = cleanup;
}
