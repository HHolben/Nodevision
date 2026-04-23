// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/GLBeditor.mjs
// GLB-focused graphical editor with panel-scoped 3D viewport selection/movement and layers integration.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { GLTFLoader } from "/lib/three/examples/jsm/loaders/GLTFLoader.js";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ensureSvgEditingSplit, loadPanelIntoCell } from "/panels/workspace.mjs";

const NOTEBOOK_BASE = "/Notebook";
const LAYERS_PANEL_ID = "SVGLayersPanel";

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

function collectMovableObjects(root) {
  if (!root) return [];
  const unique = new Set();

  root.traverse((obj) => {
    if (!obj?.isMesh) return;
    let candidate = obj;
    while (candidate.parent && candidate.parent !== root) {
      candidate = candidate.parent;
    }
    if (!candidate || candidate === root) return;
    if (candidate.isCamera || candidate.isLight || candidate.isBone) return;
    unique.add(candidate);
  });

  if (unique.size === 0) {
    root.children.forEach((child) => {
      if (!child) return;
      if (child.isCamera || child.isLight || child.isBone) return;
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

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
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
  updateToolbarState({
    currentMode: "GraphicalEditing",
    activeActionHandler: null,
  });

  const editorRoot = document.createElement("div");
  editorRoot.style.cssText =
    "display:flex;flex-direction:column;width:100%;height:100%;min-height:0;min-width:0;background:#101317;color:#d9dee6;";
  container.appendChild(editorRoot);

  const topBar = document.createElement("div");
  topBar.style.cssText =
    "display:flex;gap:12px;align-items:center;padding:8px 10px;border-bottom:1px solid #2b3340;background:#141a22;font:12px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;";
  editorRoot.appendChild(topBar);

  const pathLabel = document.createElement("div");
  pathLabel.style.cssText = "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  pathLabel.textContent = `GLB: ${filePath || "(none)"}`;
  topBar.appendChild(pathLabel);

  const hint = document.createElement("div");
  hint.style.cssText = "opacity:0.88;white-space:nowrap;";
  hint.textContent = "Click: select | Alt+Drag: move on XZ | Arrows/PageUp/PageDown: nudge";
  topBar.appendChild(hint);

  const viewport = document.createElement("div");
  viewport.style.cssText = "flex:1;min-height:0;position:relative;overflow:hidden;background:#0f141b;";
  editorRoot.appendChild(viewport);

  const status = document.createElement("div");
  status.style.cssText =
    "padding:6px 10px;border-top:1px solid #2b3340;background:#121923;font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#bfc8d6;";
  status.textContent = "Loading GLB model...";
  editorRoot.appendChild(status);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f141b);

  const width = Math.max(viewport.clientWidth, 1);
  const height = Math.max(viewport.clientHeight, 1);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
  camera.position.set(3, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;

  scene.add(new THREE.AmbientLight(0xffffff, 0.82));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(6, 10, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.52);
  fill.position.set(-6, 4, -8);
  scene.add(fill);

  const grid = new THREE.GridHelper(40, 40, 0x445067, 0x2b3444);
  scene.add(grid);
  scene.add(new THREE.AxesHelper(2.4));

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
    selectedObject: null,
    selectedHelper: null,
    dragActive: false,
    dragObject: null,
    moveStep: 0.1,
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
      selected: state.selectedObject === obj,
      type: obj.type || "Object3D",
      pos: obj.position ? {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z,
      } : { x: 0, y: 0, z: 0 },
    }));
  }

  function rebuildSelectionHelper() {
    if (state.selectedHelper) {
      scene.remove(state.selectedHelper);
      state.selectedHelper.geometry?.dispose?.();
      state.selectedHelper.material?.dispose?.();
      state.selectedHelper = null;
    }
    if (state.selectedObject) {
      state.selectedHelper = new THREE.BoxHelper(state.selectedObject, 0xf5c542);
      scene.add(state.selectedHelper);
    }
  }

  function selectObject(object, options = {}) {
    const next = object && state.selectableSet.has(object) ? object : null;
    state.selectedObject = next;
    rebuildSelectionHelper();
    notifyLayersChanged();
    if (!next) {
      setStatus("No object selected.");
      return;
    }

    const idx = state.selectableObjects.indexOf(next);
    const label = nameForObject(next, idx >= 0 ? idx : 0);
    setStatus(`Selected: ${label}`);
    if (options.focus) {
      frameObject(camera, controls, next);
    }
  }

  function selectByUuid(uuid, options = {}) {
    const target = state.selectableObjects.find((obj) => obj.uuid === uuid) || null;
    selectObject(target, options);
  }

  function setObjectVisibility(uuid, visible) {
    const target = state.selectableObjects.find((obj) => obj.uuid === uuid);
    if (!target) return;
    target.visible = !!visible;
    if (target === state.selectedObject && !target.visible) {
      selectObject(null);
    } else {
      notifyLayersChanged();
    }
  }

  function nudgeSelected(dx, dy, dz) {
    const target = state.selectedObject;
    if (!target) return;
    target.position.x += Number(dx || 0);
    target.position.y += Number(dy || 0);
    target.position.z += Number(dz || 0);
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

  const contextToken = Symbol("nv-glb-layers-context");
  window.GLBLayersContext = {
    id: "glb",
    title: "GLB Layers",
    token: contextToken,
    attachHost: attachLayersHost,
  };

  function clearModel() {
    if (!state.root) return;
    scene.remove(state.root);
    disposeObject(state.root);
    state.root = null;
    state.mixer = null;
    state.selectableObjects = [];
    state.selectableSet = new Set();
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
    state.dragActive = true;
    controls.enabled = false;
    renderer.domElement.style.cursor = "grabbing";
  }

  function stopDrag() {
    if (!state.dragActive) return;
    state.dragActive = false;
    state.dragObject = null;
    controls.enabled = true;
    renderer.domElement.style.cursor = "";
    notifyLayersChanged();
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(collectSelectableMeshes(), true);
    const target = hits.length
      ? resolveSelectableTarget(hits[0].object, state.root, state.selectableSet)
      : null;

    if (!target) {
      selectObject(null);
      return;
    }

    selectObject(target);
    if (event.altKey) {
      event.preventDefault();
      startDrag(event, target);
    }
  }

  function onPointerMove(event) {
    if (!state.dragActive || !state.dragObject) return;
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, dragHit)) return;

    worldPos.copy(dragHit).add(dragOffset);
    const parent = state.dragObject.parent;
    if (parent) {
      localPos.copy(worldPos);
      parent.worldToLocal(localPos);
      state.dragObject.position.copy(localPos);
    } else {
      state.dragObject.position.copy(worldPos);
    }
  }

  function onPointerUp() {
    stopDrag();
  }

  function onResize() {
    if (state.destroyed) return;
    const w = Math.max(viewport.clientWidth, 1);
    const h = Math.max(viewport.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function onKeyDown(event) {
    if (isEditableTarget(event.target)) return;
    if (!state.selectedObject) return;

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
    if (state.mixer) state.mixer.update(delta);
    if (state.selectedHelper) state.selectedHelper.update();
    controls.update();
    renderer.render(scene, camera);
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

          if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
            state.mixer = new THREE.AnimationMixer(root);
            gltf.animations.forEach((clip) => {
              state.mixer.clipAction(clip).play();
            });
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
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);

  renderer.setAnimationLoop(animate);
  await ensureLayersPanelVisible();

  try {
    await loadModel();
    setStatus("GLB ready. Select objects in viewport or Layers panel.");
  } catch (err) {
    console.error("GLB editor load error:", err);
    setStatus(`Failed to load GLB: ${err?.message || err}`);
  }

  const cleanup = () => {
    state.destroyed = true;
    renderer.setAnimationLoop(null);
    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKeyDown);
    controls.dispose();
    clearModel();
    if (state.selectedHelper) {
      scene.remove(state.selectedHelper);
      state.selectedHelper.geometry?.dispose?.();
      state.selectedHelper.material?.dispose?.();
      state.selectedHelper = null;
    }
    renderer.dispose();
    layerListeners.clear();
    if (window.GLBLayersContext?.token === contextToken) {
      delete window.GLBLayersContext;
    }
    container.__nvActiveEditorCleanup = null;
    container.__nvGlbEditorCleanup = null;
  };
  container.__nvGlbEditorCleanup = cleanup;
  container.__nvActiveEditorCleanup = cleanup;
}
