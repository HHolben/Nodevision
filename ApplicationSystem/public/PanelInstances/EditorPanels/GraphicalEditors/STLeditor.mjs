// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/STLeditor.mjs
// This file defines browser-side STLeditor logic for the Nodevision UI. It renders interface components and handles user interactions.

import * as THREE from "/lib/three/three.module.js";
import { STLLoader } from "/lib/three/STLLoader.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setStatus as setNodevisionStatus } from "/StatusBar.mjs";
import { mountWidget } from "/Widgets/WidgetHost.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";

const SAVE_ENDPOINT = "/api/save";
const WELD_EPSILON = 1e-5;
const NODEVISION_TOPOLOGY_PREFIX = "  // nodevision-topology: ";
const STL_ACTION_AXIS_TYPES = new Set(["x", "y", "z"]);
const STL_LIGHT_THEME = {
  editorBackground: "#ffffff",
  sceneBackground: 0xffffff,
  gridCenter: 0x94a3b8,
  gridLine: 0xe2e8f0,
};
const STL_DARK_THEME = {
  editorBackground: "#101317",
  sceneBackground: 0x0f141b,
  gridCenter: 0x445067,
  gridLine: 0x2b3444,
};

function currentNodevisionTheme() {
  return document.documentElement?.dataset?.nvTheme === "dark" ? "dark" : "light";
}

function ensureStyles() {
  if (document.getElementById("nv-stl-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-stl-editor-styles";
  style.textContent = `
    .nv-stl-editor { position:relative; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; background:#fff; }
    html[data-nv-theme="dark"] .nv-stl-editor { background:#101317; }
    .nv-stl-viewport { position:absolute; inset:0; min-width:0; min-height:0; outline:none; }
    .nv-stl-viewport canvas { display:block; width:100%; height:100%; }
    .nv-stl-error { margin:12px; color:#b00020; }
    .nv-stl-editor.nv-stl-sculpt-active .nv-stl-viewport canvas { cursor: crosshair; }
    .nv-stl-selection-box { position:fixed; border:1px solid #f59e0b; background:rgba(245,158,11,0.14); pointer-events:none; z-index:10000; display:none; }
  `;
  document.head.appendChild(style);
}

function notebookUrl(path = "") {
  return `/Notebook/${
    String(path || "")
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/")
  }`;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function cloneVertices(vertices) {
  return vertices.map((v) => v.clone());
}

function createEmptyTopology() {
  return { vertices: [], faces: [], customEdges: [] };
}

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

function buildTopologyFromGeometry(geometry) {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = nonIndexed.getAttribute("position");
  if (!pos || !Number.isFinite(pos.count) || pos.count === 0) return createEmptyTopology();
  const vertices = [];
  const faces = [];
  const weldMap = new Map();

  const quantize = (n) => Math.round(n / WELD_EPSILON);

  for (let i = 0; i < pos.count; i += 3) {
    const tri = [];
    for (let j = 0; j < 3; j++) {
      const idx = i + j;
      const x = pos.getX(idx);
      const y = pos.getY(idx);
      const z = pos.getZ(idx);
      const key = `${quantize(x)}|${quantize(y)}|${quantize(z)}`;

      let vIndex = weldMap.get(key);
      if (vIndex === undefined) {
        vIndex = vertices.length;
        vertices.push(new THREE.Vector3(x, y, z));
        weldMap.set(key, vIndex);
      }
      tri.push(vIndex);
    }
    faces.push(tri);
  }

  return { vertices, faces, customEdges: [] };
}

function serializeNodevisionTopology(topology) {
  const vertices = Array.isArray(topology?.vertices)
    ? topology.vertices.map((v) => [v?.x || 0, v?.y || 0, v?.z || 0])
    : [];
  const faces = Array.isArray(topology?.faces)
    ? topology.faces.filter((face) => Array.isArray(face) && face.length >= 3).map((face) => face.slice(0, 3))
    : [];
  const customEdges = Array.isArray(topology?.customEdges)
    ? topology.customEdges.filter((edge) => Array.isArray(edge) && edge.length >= 2).map((edge) => edge.slice(0, 2))
    : [];
  return JSON.stringify({ version: 1, vertices, faces, customEdges });
}

function topologyFromNodevisionMetadata(rawValue) {
  let data = null;
  try {
    data = JSON.parse(String(rawValue || ""));
  } catch {
    return null;
  }
  if (!data || !Array.isArray(data.vertices)) return null;
  const vertices = data.vertices
    .map((v) => Array.isArray(v) && v.length >= 3 ? new THREE.Vector3(Number(v[0]), Number(v[1]), Number(v[2])) : null)
    .filter((v) => v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
  const validIndex = (index) => Number.isInteger(index) && index >= 0 && index < vertices.length;
  const faces = Array.isArray(data.faces)
    ? data.faces.map((face) => Array.isArray(face) ? face.slice(0, 3).map((n) => Number(n)) : [])
      .filter((face) => face.length === 3 && face.every(validIndex) && new Set(face).size === 3)
    : [];
  const customEdges = Array.isArray(data.customEdges)
    ? data.customEdges.map((edge) => Array.isArray(edge) ? edge.slice(0, 2).map((n) => Number(n)) : [])
      .filter((edge) => edge.length === 2 && edge.every(validIndex) && edge[0] !== edge[1])
    : [];
  return { vertices, faces, customEdges };
}

function parseNodevisionTopologyMetadata(text) {
  const prefix = NODEVISION_TOPOLOGY_PREFIX.trim();
  const line = String(text || "").split(/\r?\n/).find((entry) => entry.trim().startsWith(prefix));
  if (!line) return null;
  return topologyFromNodevisionMetadata(line.trim().slice(prefix.length).trim());
}

function isExactBinarySTLBuffer(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 84) return false;
  try {
    const reader = new DataView(arrayBuffer);
    const faces = reader.getUint32(80, true);
    return 84 + faces * 50 === reader.byteLength;
  } catch {
    return false;
  }
}

function looksLikeAsciiSTLText(text) {
  const normalized = String(text || "").replace(/^\uFEFF/, "").trimStart().toLowerCase();
  return normalized.startsWith("solid") && normalized.includes("endsolid");
}

function faceNormal(vertices, face) {
  const a = vertices[face[0]];
  const b = vertices[face[1]];
  const c = vertices[face[2]];
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return new THREE.Vector3().crossVectors(ab, ac).normalize();
}

function verticesAreCoplanar(vertices, epsilon = WELD_EPSILON * 100) {
  if (!Array.isArray(vertices) || vertices.length < 3) return false;
  const origin = vertices[0];
  let normal = null;

  for (let i = 1; i < vertices.length - 1; i++) {
    const ab = new THREE.Vector3().subVectors(vertices[i], origin);
    const ac = new THREE.Vector3().subVectors(vertices[i + 1], origin);
    const candidate = new THREE.Vector3().crossVectors(ab, ac);
    if (candidate.lengthSq() > epsilon * epsilon) {
      normal = candidate.normalize();
      break;
    }
  }

  if (!normal) return false;
  return vertices.every((vertex) => Math.abs(new THREE.Vector3().subVectors(vertex, origin).dot(normal)) <= epsilon);
}

function stlSolidNameFromPath(pathValue) {
  const fallback = "stl";
  const base = String(pathValue || "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || fallback;
  const withoutExt = base.replace(/\.[^.]*$/, "") || base || fallback;
  return withoutExt.replace(/[^A-Za-z0-9_.-]+/g, "_") || fallback;
}

function serializeTopologyToAsciiSTL(topology, nameValue = "") {
  const solidName = stlSolidNameFromPath(nameValue);
  const lines = ["solid " + solidName];
  lines.push(NODEVISION_TOPOLOGY_PREFIX + serializeNodevisionTopology(topology));
  for (const face of topology.faces) {
    const a = topology.vertices[face[0]];
    const b = topology.vertices[face[1]];
    const c = topology.vertices[face[2]];
    if (!a || !b || !c) continue;
    const n = faceNormal(topology.vertices, face);
    lines.push(`facet normal ${n.x} ${n.y} ${n.z}`);
    lines.push("  outer loop");
    lines.push(`    vertex ${a.x} ${a.y} ${a.z}`);
    lines.push(`    vertex ${b.x} ${b.y} ${b.z}`);
    lines.push(`    vertex ${c.x} ${c.y} ${c.z}`);
    lines.push("  endloop");
    lines.push("endfacet");
  }
  lines.push("endsolid " + solidName);
  return lines.join("\n");
}

export async function renderEditor(
  filePath,
  container,
  iframe,
  serverBase = "",
) {
  if (!container) throw new Error("Container required");
  ensureStyles();
  container.innerHTML = "";
  container.classList.add("nv-stl-editor");
  container.style.display = "block";
  container.style.height = "100%";
  container.style.position = "relative";
  container.style.overflow = "hidden";
  container.tabIndex = 0;

  const state = {
    topology: null,
    selection: new Set(),
    mode: "idle", // idle | grab | scale | rotate
    actionSnapshot: null,
    actionChanged: false,
    maxDim: 100,
    destroyed: false,
    dirty: false,
    lastPointerClient: { x: 0, y: 0 },
    commandBuffer: "",
    commandTimer: null,
    selectionBox: null,
    sculpt: {
      tool: "select",
      radius: 1,
      strength: 0.35,
      stroke: null,
    },
  };

  const viewport = document.createElement("div");
  viewport.className = "nv-stl-viewport";
  viewport.tabIndex = 0;
  container.appendChild(viewport);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
  camera.position.set(200, 200, 200);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  const initialViewportRect = viewport.getBoundingClientRect();
  renderer.setSize(
    Math.max(1, initialViewportRect.width || viewport.clientWidth || 1),
    Math.max(1, initialViewportRect.height || viewport.clientHeight || 1),
    false,
  );
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableRotate = false;

  scene.add(new THREE.AmbientLight(0x606060));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(1, 1, 1).normalize();
  scene.add(keyLight);

  function disposeMaterial(material) {
    if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
    else material?.dispose?.();
  }

  let floorGrid = new THREE.GridHelper(200, 40, STL_LIGHT_THEME.gridCenter, STL_LIGHT_THEME.gridLine);
  floorGrid.name = "STLEditorThemeGrid";
  scene.add(floorGrid);

  function applyViewportTheme(theme = currentNodevisionTheme()) {
    const colors = theme === "dark" ? STL_DARK_THEME : STL_LIGHT_THEME;
    container.style.background = colors.editorBackground;
    viewport.style.background = colors.editorBackground;
    scene.background.set(colors.sceneBackground);

    scene.remove(floorGrid);
    floorGrid.geometry?.dispose?.();
    disposeMaterial(floorGrid.material);
    floorGrid = new THREE.GridHelper(200, 40, colors.gridCenter, colors.gridLine);
    floorGrid.name = "STLEditorThemeGrid";
    scene.add(floorGrid);
  }

  const onThemeChanged = (event) => applyViewportTheme(event?.detail?.theme || currentNodevisionTheme());
  applyViewportTheme();

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

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.18;
  const pointerNdc = new THREE.Vector2();

  let mesh = null;
  let edgeLines = null;
  let vertexPoints = null;
  let selectedVertexPoints = null;
  let customEdgeLines = null;
  let brushRing = null;

  function setModeLabel(extra = "") {
    const suffix = extra ? ` (${extra})` : "";
    setNodevisionStatus("STL", `Mode: ${state.mode[0].toUpperCase()}${
      state.mode.slice(1)
    }${suffix}`);
  }

  function notifyToolbarState(extra = {}) {
    updateToolbarState({
      currentMode: "STLediting",
      activePanelType: "GraphicalEditor",
      selectedFile: filePath,
      activeEditorFilePath: filePath,
      activeActionHandler: handleSTLToolbarAction,
      fileIsDirty: state.dirty,
      stlHasSelection: state.selection.size > 0,
      stlSculptTool: state.sculpt.tool,
      stlSculptRadius: state.sculpt.radius,
      stlSculptStrength: state.sculpt.strength,
      ...extra,
    });
  }

  function markDirty(message = "Changed") {
    state.dirty = true;
    notifyToolbarState({ fileIsDirty: true });
    setNodevisionStatus("STL", message);
  }

  function computeBounds() {
    if (!state.topology || state.topology.vertices.length === 0) {
      return {
        center: new THREE.Vector3(),
        size: new THREE.Vector3(1, 1, 1),
        maxDim: 1,
      };
    }
    const box = new THREE.Box3();
    state.topology.vertices.forEach((v) => box.expandByPoint(v));
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    return {
      center,
      size,
      maxDim: Math.max(size.x || 1, size.y || 1, size.z || 1),
    };
  }

  function recenterCameraToTopology() {
    const b = computeBounds();
    state.maxDim = b.maxDim;
    const fov = camera.fov * (Math.PI / 180);
    const dist = Math.abs((b.maxDim / 2) / Math.tan(fov / 2)) * 1.8;
    camera.position.set(
      b.center.x + dist,
      b.center.y + dist,
      b.center.z + dist,
    );
    controls.target.copy(b.center);
    controls.update();
  }

  function rebuildDisplayGeometry() {
    if (!state.topology) return;

    const triangles = state.topology.faces.length;
    const posArray = new Float32Array(triangles * 9);
    for (let i = 0; i < triangles; i++) {
      const [a, b, c] = state.topology.faces[i];
      const va = state.topology.vertices[a];
      const vb = state.topology.vertices[b];
      const vc = state.topology.vertices[c];
      const o = i * 9;
      posArray[o + 0] = va.x;
      posArray[o + 1] = va.y;
      posArray[o + 2] = va.z;
      posArray[o + 3] = vb.x;
      posArray[o + 4] = vb.y;
      posArray[o + 5] = vb.z;
      posArray[o + 6] = vc.x;
      posArray[o + 7] = vc.y;
      posArray[o + 8] = vc.z;
    }

    const meshGeometry = new THREE.BufferGeometry();
    meshGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(posArray, 3),
    );
    meshGeometry.computeVertexNormals();
    meshGeometry.computeBoundingBox();
    meshGeometry.computeBoundingSphere();

    if (!mesh) {
      mesh = new THREE.Mesh(
        meshGeometry,
        new THREE.MeshPhongMaterial({
          color: 0xadd8e6,
          transparent: true,
          opacity: 0.95,
        }),
      );
      mesh.userData.isModel = true;
      scene.add(mesh);
    } else {
      mesh.geometry.dispose();
      mesh.geometry = meshGeometry;
    }

    if (edgeLines) {
      scene.remove(edgeLines);
      edgeLines.geometry.dispose();
      edgeLines.material.dispose();
    }
    edgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(meshGeometry),
      new THREE.LineBasicMaterial({ color: 0x007733 }),
    );
    edgeLines.userData.isEdge = true;
    scene.add(edgeLines);

    const vertexPos = new Float32Array(state.topology.vertices.length * 3);
    state.topology.vertices.forEach((v, i) => {
      const o = i * 3;
      vertexPos[o + 0] = v.x;
      vertexPos[o + 1] = v.y;
      vertexPos[o + 2] = v.z;
    });

    const vertexGeometry = new THREE.BufferGeometry();
    vertexGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertexPos, 3),
    );

    if (!vertexPoints) {
      vertexPoints = new THREE.Points(
        vertexGeometry,
        new THREE.PointsMaterial({
          size: Math.max(0.4, state.maxDim * 0.01),
          color: 0xffcc00,
        }),
      );
      vertexPoints.userData.isVertex = true;
      scene.add(vertexPoints);
    } else {
      vertexPoints.geometry.dispose();
      vertexPoints.geometry = vertexGeometry;
      vertexPoints.material.size = Math.max(0.4, state.maxDim * 0.01);
    }

    rebuildSelectionDisplay();
    rebuildCustomEdgesDisplay();
  }

  function rebuildSelectionDisplay() {
    if (selectedVertexPoints) {
      scene.remove(selectedVertexPoints);
      selectedVertexPoints.geometry.dispose();
      selectedVertexPoints.material.dispose();
      selectedVertexPoints = null;
    }

    if (!state.topology || state.selection.size === 0) return;
    const pos = new Float32Array(state.selection.size * 3);
    let idx = 0;
    for (const vi of state.selection) {
      const v = state.topology.vertices[vi];
      if (!v) continue;
      pos[idx++] = v.x;
      pos[idx++] = v.y;
      pos[idx++] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos.slice(0, idx), 3));
    selectedVertexPoints = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: Math.max(0.7, state.maxDim * 0.016),
        color: 0xff3333,
      }),
    );
    selectedVertexPoints.userData.isSelectedVertex = true;
    scene.add(selectedVertexPoints);
  }

  function rebuildCustomEdgesDisplay() {
    if (customEdgeLines) {
      scene.remove(customEdgeLines);
      customEdgeLines.geometry.dispose();
      customEdgeLines.material.dispose();
      customEdgeLines = null;
    }
    if (!state.topology || state.topology.customEdges.length === 0) return;

    const pos = [];
    for (const [a, b] of state.topology.customEdges) {
      const va = state.topology.vertices[a];
      const vb = state.topology.vertices[b];
      if (!va || !vb) continue;
      pos.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
    }
    if (pos.length === 0) return;

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    customEdgeLines = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color: 0xaa33ff }),
    );
    customEdgeLines.userData.isCustomEdge = true;
    scene.add(customEdgeLines);
  }

  function selectAllVertices() {
    if (!state.topology?.vertices?.length) return;
    state.selection = new Set(state.topology.vertices.map((_, index) => index));
    rebuildSelectionDisplay();
    setModeLabel("all selected");
    notifyToolbarState();
  }

  function selectedCentroid(fromVertices = null) {
    const source = fromVertices || state.topology?.vertices;
    if (!source || state.selection.size === 0) return new THREE.Vector3();
    const c = new THREE.Vector3();
    let n = 0;
    state.selection.forEach((i) => {
      const v = source[i];
      if (!v) return;
      c.add(v);
      n += 1;
    });
    if (n > 0) c.multiplyScalar(1 / n);
    return c;
  }

  function parseActionDistanceNumber(rawValue) {
    const n = Number.parseFloat(String(rawValue || "").trim());
    return Number.isFinite(n) ? n : null;
  }

  function actionAxisConstraintLabel(axis, snap = state.actionSnapshot) {
    if (!STL_ACTION_AXIS_TYPES.has(axis)) return "free";
    const side = getActionAxisDirectionSign(snap) < 0 ? "-" : "+";
    return axis.toUpperCase() + " " + side;
  }

  function getActionAxisVector(axis) {
    if (axis === "x") return new THREE.Vector3(1, 0, 0);
    if (axis === "y") return new THREE.Vector3(0, 1, 0);
    if (axis === "z") return new THREE.Vector3(0, 0, 1);
    return null;
  }

  function actionAngleUnit(snap = state.actionSnapshot) {
    return snap?.angleUnit === "rad" ? "rad" : "deg";
  }

  function actionAngleValueToRadians(value, unit = actionAngleUnit()) {
    if (!Number.isFinite(value)) return null;
    return unit === "rad" ? value : (value * Math.PI) / 180;
  }

  function actionAngleRadiansToValue(angleRad, unit = actionAngleUnit()) {
    if (!Number.isFinite(angleRad)) return null;
    return unit === "rad" ? angleRad : (angleRad * 180) / Math.PI;
  }

  function formatActionAngleNumber(value) {
    if (!Number.isFinite(value)) return "";
    return Number(value.toFixed(6)).toString();
  }

  function actionRotationConstraintLabel(axis, snap = state.actionSnapshot) {
    if (!STL_ACTION_AXIS_TYPES.has(axis)) return "";
    const side = getActionAxisDirectionSign(snap) < 0 ? "-" : "+";
    const radians = Number.isFinite(snap?.angleFixedRadians) ? snap.angleFixedRadians : 0;
    const value = actionAngleRadiansToValue(Math.abs(radians), actionAngleUnit(snap));
    return axis.toUpperCase() + " " + side + formatActionAngleNumber(value || 0) + " " + actionAngleUnit(snap);
  }

  function actionModeInstruction(mode, axis = null) {
    if (mode === "grab") {
      const axisText = axis ? ", " + actionAxisConstraintLabel(axis) + " locked" : "";
      return "move mouse" + axisText + ", X/Y/Z lock axis, click/Enter confirm, Esc cancel";
    }
    if (mode === "rotate") {
      const axisText = axis ? " around " + actionAxisConstraintLabel(axis) : "";
      return "rotate" + axisText + ", X/Y/Z axis, type angle, Tab deg/rad, Enter confirm, Esc cancel";
    }
    return "move mouse, click/Enter confirm, Esc cancel";
  }

  function selectedRotationPivot(fromVertices = null) {
    const source = fromVertices || state.topology?.vertices;
    const selected = Array.from(state.selection || []);
    if (selected.length === 1 && Array.isArray(state.topology?.customEdges)) {
      const selectedIndex = selected[0];
      const edge = state.topology.customEdges.find((candidate) => Array.isArray(candidate) && candidate.includes(selectedIndex));
      if (edge) {
        const otherIndex = edge[0] === selectedIndex ? edge[1] : edge[0];
        const other = source?.[otherIndex];
        if (other) return other.clone();
      }
    }
    return selectedCentroid(source);
  }

  function startActionMode(mode, mouseEvt) {
    if (!state.topology || state.selection.size === 0) return;
    state.mode = mode;
    setModeLabel(actionModeInstruction(mode));
    controls.enabled = false;

    const startVertices = Array.isArray(mouseEvt?.startVerticesOverride)
      ? cloneVertices(mouseEvt.startVerticesOverride)
      : cloneVertices(state.topology.vertices);
    const centroid = mouseEvt?.centroidOverride?.isVector3
      ? mouseEvt.centroidOverride.clone()
      : selectedCentroid(startVertices);
    const rotationPivot = mode === "rotate" ? selectedRotationPivot(startVertices) : centroid.clone();
    const startMouse = new THREE.Vector2(
      Number.isFinite(mouseEvt?.clientX)
        ? mouseEvt.clientX
        : state.lastPointerClient.x,
      Number.isFinite(mouseEvt?.clientY)
        ? mouseEvt.clientY
        : state.lastPointerClient.y,
    );
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      camDir.clone().normalize(),
      centroid.clone(),
    );
    state.actionSnapshot = {
      startVertices,
      centroid,
      startMouse,
      plane,
      axisLock: null,
      axisDistanceBuffer: "",
      axisDirectionSign: 1,
      axisFixedDistance: null,
      axisFixedPosition: null,
      axisInputMode: "distance",
      rotationPivot,
      angleUnit: "deg",
      angleInputBuffer: "",
      angleFixedRadians: null,
    };
    state.actionChanged = false;
  }

  function clearPendingCommand() {
    state.commandBuffer = "";
    if (state.commandTimer) window.clearTimeout(state.commandTimer);
    state.commandTimer = null;
  }

  function commitAction() {
    clearPendingCommand();
    const changed = state.actionChanged;
    state.mode = "idle";
    state.actionSnapshot = null;
    state.actionChanged = false;
    controls.enabled = true;
    setModeLabel();
    if (changed) markDirty("Selection transformed");
  }

  function cancelAction() {
    clearPendingCommand();
    if (!state.actionSnapshot || !state.topology) {
      commitAction();
      return;
    }
    state.topology.vertices = cloneVertices(state.actionSnapshot.startVertices);
    state.actionChanged = false;
    rebuildDisplayGeometry();
    commitAction();
  }

  function getActionAxisDirectionSign(snap = state.actionSnapshot) {
    return snap?.axisDirectionSign === -1 ? -1 : 1;
  }

  function applyActionAxisDistance(distance) {
    const snap = state.actionSnapshot;
    if (state.mode !== "grab" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    if (!Number.isFinite(distance)) return false;
    const axisVector = getActionAxisVector(snap.axisLock);
    if (!axisVector) return false;
    const signedDistance = Math.abs(distance) * getActionAxisDirectionSign(snap);
    snap.axisFixedDistance = signedDistance;
    state.selection.forEach((vi) => {
      state.topology.vertices[vi].copy(snap.startVertices[vi]).addScaledVector(axisVector, signedDistance);
    });
    rebuildDisplayGeometry();
    state.actionChanged = true;
    setModeLabel("moved " + actionAxisConstraintLabel(snap.axisLock) + " " + signedDistance);
    return true;
  }

  function applyActionAxisPosition(position) {
    const snap = state.actionSnapshot;
    if (state.mode !== "grab" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    if (!Number.isFinite(position)) return false;
    snap.axisFixedPosition = position;
    snap.axisFixedDistance = null;
    state.selection.forEach((vi) => {
      const base = snap.startVertices[vi];
      const target = state.topology.vertices[vi];
      if (!base || !target) return;
      target.copy(base);
      target[snap.axisLock] = position;
    });
    rebuildDisplayGeometry();
    state.actionChanged = true;
    setModeLabel("set " + snap.axisLock.toUpperCase() + " position to " + position);
    return true;
  }

  function reapplyActionAxisDistanceBuffer() {
    const snap = state.actionSnapshot;
    if (state.mode !== "grab" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    const value = parseActionDistanceNumber(snap.axisDistanceBuffer);
    if (value !== null) {
      return snap.axisInputMode === "position"
        ? applyActionAxisPosition(value)
        : applyActionAxisDistance(value);
    }
    snap.axisFixedDistance = null;
    snap.axisFixedPosition = null;
    applyActionMove(state.lastPointerClient.x, state.lastPointerClient.y);
    const inputText = snap.axisInputMode === "position" ? ", type absolute position" : "";
    setModeLabel(actionModeInstruction("grab", snap.axisLock) + inputText);
    return true;
  }

  function setActionAxisDirectionSign(sign) {
    const snap = state.actionSnapshot;
    if (state.mode !== "grab" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    snap.axisDirectionSign = sign < 0 ? -1 : 1;
    return reapplyActionAxisDistanceBuffer();
  }

  function toggleActionAxisDirection() {
    const snap = state.actionSnapshot;
    if (state.mode !== "grab" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    snap.axisDirectionSign = getActionAxisDirectionSign(snap) < 0 ? 1 : -1;
    return reapplyActionAxisDistanceBuffer();
  }

  function setActionAxisConstraint(axis, { inputMode = "distance" } = {}) {
    const snap = state.actionSnapshot;
    if (state.mode !== "grab" || !snap || !STL_ACTION_AXIS_TYPES.has(axis)) return false;
    if (snap.axisLock === axis) {
      snap.axisLock = null;
      snap.axisDistanceBuffer = "";
      snap.axisDirectionSign = 1;
      snap.axisFixedDistance = null;
      snap.axisFixedPosition = null;
      snap.axisInputMode = "distance";
      setModeLabel(actionModeInstruction("grab"));
      applyActionMove(state.lastPointerClient.x, state.lastPointerClient.y);
      return true;
    }
    snap.axisLock = axis;
    snap.axisDistanceBuffer = "";
    snap.axisDirectionSign = 1;
    snap.axisFixedDistance = null;
    snap.axisFixedPosition = null;
    snap.axisInputMode = inputMode === "position" ? "position" : "distance";
    const inputText = snap.axisInputMode === "position" ? ", type absolute position" : "";
    setModeLabel(actionModeInstruction("grab", snap.axisLock) + inputText);
    applyActionMove(state.lastPointerClient.x, state.lastPointerClient.y);
    return true;
  }

  function restoreSelectedActionVertices() {
    const snap = state.actionSnapshot;
    if (!snap || !state.topology) return false;
    state.selection.forEach((vi) => {
      const base = snap.startVertices[vi];
      if (base && state.topology.vertices[vi]) state.topology.vertices[vi].copy(base);
    });
    rebuildDisplayGeometry();
    return true;
  }

  function applyActionRotation(angleRadians) {
    const snap = state.actionSnapshot;
    if (state.mode !== "rotate" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    if (!Number.isFinite(angleRadians)) return false;
    const axisVector = getActionAxisVector(snap.axisLock);
    if (!axisVector) return false;
    const signedAngle = Math.abs(angleRadians) * getActionAxisDirectionSign(snap);
    snap.angleFixedRadians = signedAngle;
    const pivot = snap.rotationPivot || snap.centroid || new THREE.Vector3();
    state.selection.forEach((vi) => {
      const base = snap.startVertices[vi];
      const target = state.topology.vertices[vi];
      if (!base || !target) return;
      const offset = new THREE.Vector3().subVectors(base, pivot).applyAxisAngle(axisVector, signedAngle);
      target.copy(pivot).add(offset);
    });
    rebuildDisplayGeometry();
    state.actionChanged = Math.abs(signedAngle) > 1e-12;
    setModeLabel("rotated " + actionRotationConstraintLabel(snap.axisLock, snap));
    return true;
  }

  function reapplyActionRotationBuffer() {
    const snap = state.actionSnapshot;
    if (state.mode !== "rotate" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    const value = parseActionDistanceNumber(snap.angleInputBuffer);
    if (value !== null) return applyActionRotation(actionAngleValueToRadians(Math.abs(value), actionAngleUnit(snap)));
    snap.angleFixedRadians = 0;
    restoreSelectedActionVertices();
    state.actionChanged = false;
    setModeLabel("rotate " + actionAxisConstraintLabel(snap.axisLock, snap) + " locked, type angle in " + actionAngleUnit(snap));
    return true;
  }

  function setActionRotationDirectionSign(sign) {
    const snap = state.actionSnapshot;
    if (state.mode !== "rotate" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    snap.axisDirectionSign = sign < 0 ? -1 : 1;
    return reapplyActionRotationBuffer();
  }

  function toggleActionRotationDirection() {
    const snap = state.actionSnapshot;
    if (state.mode !== "rotate" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    snap.axisDirectionSign = getActionAxisDirectionSign(snap) < 0 ? 1 : -1;
    return reapplyActionRotationBuffer();
  }

  function toggleActionRotationUnit() {
    const snap = state.actionSnapshot;
    if (state.mode !== "rotate" || !snap) return false;
    const fromUnit = actionAngleUnit(snap);
    const toUnit = fromUnit === "deg" ? "rad" : "deg";
    const value = parseActionDistanceNumber(snap.angleInputBuffer);
    if (value !== null) {
      const angleRad = actionAngleValueToRadians(Math.abs(value), fromUnit);
      const nextValue = actionAngleRadiansToValue(angleRad, toUnit);
      snap.angleInputBuffer = formatActionAngleNumber(Math.abs(nextValue || 0));
    }
    snap.angleUnit = toUnit;
    if (!STL_ACTION_AXIS_TYPES.has(snap.axisLock)) {
      setModeLabel("rotate, angle unit " + actionAngleUnit(snap) + ", choose X/Y/Z axis");
      return true;
    }
    return reapplyActionRotationBuffer();
  }

  function setActionRotationAxisConstraint(axis) {
    const snap = state.actionSnapshot;
    if (state.mode !== "rotate" || !snap || !STL_ACTION_AXIS_TYPES.has(axis)) return false;
    if (snap.axisLock === axis) {
      snap.axisLock = null;
      snap.angleInputBuffer = "";
      snap.axisDirectionSign = 1;
      snap.angleFixedRadians = 0;
      restoreSelectedActionVertices();
      state.actionChanged = false;
      setModeLabel(actionModeInstruction("rotate"));
      return true;
    }
    snap.axisLock = axis;
    snap.angleInputBuffer = "";
    snap.axisDirectionSign = 1;
    snap.angleFixedRadians = 0;
    restoreSelectedActionVertices();
    state.actionChanged = false;
    setModeLabel("rotate " + actionAxisConstraintLabel(snap.axisLock, snap) + " locked, type angle in " + actionAngleUnit(snap));
    return true;
  }

  function applyActionMove(clientX, clientY) {
    if (!state.actionSnapshot || !state.topology) return;
    const snap = state.actionSnapshot;

    if (state.mode === "grab") {
      const rect = renderer.domElement.getBoundingClientRect();
      const sx = ((snap.startMouse.x - rect.left) / rect.width) * 2 - 1;
      const sy = -(((snap.startMouse.y - rect.top) / rect.height) * 2 - 1);
      const ex = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ey = -(((clientY - rect.top) / rect.height) * 2 - 1);

      const startRay = new THREE.Raycaster();
      const endRay = new THREE.Raycaster();
      startRay.setFromCamera(new THREE.Vector2(sx, sy), camera);
      endRay.setFromCamera(new THREE.Vector2(ex, ey), camera);

      const startPoint = new THREE.Vector3();
      const endPoint = new THREE.Vector3();
      const hitA = startRay.ray.intersectPlane(snap.plane, startPoint);
      const hitB = endRay.ray.intersectPlane(snap.plane, endPoint);
      if (!hitA || !hitB) return;

      let delta = new THREE.Vector3().subVectors(endPoint, startPoint);
      const axisVector = getActionAxisVector(snap.axisLock);
      if (axisVector) {
        const fixedPosition = Number.isFinite(snap.axisFixedPosition) ? snap.axisFixedPosition : null;
        if (fixedPosition !== null) {
          state.selection.forEach((vi) => {
            const base = snap.startVertices[vi];
            const target = state.topology.vertices[vi];
            if (!base || !target) return;
            target.copy(base);
            target[snap.axisLock] = fixedPosition;
          });
          rebuildDisplayGeometry();
          state.actionChanged = true;
          return;
        }
        const fixedDistance = Number.isFinite(snap.axisFixedDistance) ? snap.axisFixedDistance : null;
        const axisDistance = fixedDistance !== null
          ? fixedDistance
          : delta.dot(axisVector) * getActionAxisDirectionSign(snap);
        delta = axisVector.multiplyScalar(axisDistance);
      }
      state.selection.forEach((vi) => {
        state.topology.vertices[vi].copy(snap.startVertices[vi]).add(delta);
      });
      rebuildDisplayGeometry();
      state.actionChanged = true;
      return;
    }

    if (state.mode === "scale") {
      const dx = clientX - snap.startMouse.x;
      const scale = Math.max(0.05, 1 + dx / 240);
      state.selection.forEach((vi) => {
        const base = snap.startVertices[vi];
        const offset = new THREE.Vector3().subVectors(base, snap.centroid)
          .multiplyScalar(scale);
        state.topology.vertices[vi].copy(snap.centroid).add(offset);
      });
      rebuildDisplayGeometry();
      state.actionChanged = true;
    }
  }

  function handleActionAxisDistanceKey(evt) {
    const snap = state.actionSnapshot;
    if (state.mode !== "grab" || !snap || !STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;
    if (evt.ctrlKey || evt.metaKey || evt.altKey) return false;

    const rawKey = String(evt.key || "");
    const isPositionMode = snap.axisInputMode === "position";
    if (rawKey === "Backspace") {
      snap.axisDistanceBuffer = String(snap.axisDistanceBuffer || "").slice(0, -1);
      return reapplyActionAxisDistanceBuffer();
    }

    if (isPositionMode && (rawKey === "-" || rawKey === "+")) {
      const current = String(snap.axisDistanceBuffer || "");
      if (current.startsWith("-")) {
        snap.axisDistanceBuffer = rawKey === "-" ? current.slice(1) : current;
      } else if (rawKey === "-") {
        snap.axisDistanceBuffer = "-" + current;
      }
      return reapplyActionAxisDistanceBuffer();
    }

    if (rawKey === "=" || rawKey === "-") return toggleActionAxisDirection();
    if (rawKey === "+") return setActionAxisDirectionSign(1);

    if (!"0123456789.".includes(rawKey)) return false;
    if (rawKey === "." && String(snap.axisDistanceBuffer || "").includes(".")) return false;

    snap.axisDistanceBuffer = String(snap.axisDistanceBuffer || "") + rawKey;
    return reapplyActionAxisDistanceBuffer();
  }

  function handleActionRotationKey(evt) {
    const snap = state.actionSnapshot;
    if (state.mode !== "rotate" || !snap) return false;
    if (evt.ctrlKey || evt.metaKey || evt.altKey) return false;

    const rawKey = String(evt.key || "");
    const key = rawKey.toLowerCase();
    if (rawKey === "Tab") return toggleActionRotationUnit();
    if (STL_ACTION_AXIS_TYPES.has(key)) return setActionRotationAxisConstraint(key);
    if (!STL_ACTION_AXIS_TYPES.has(snap.axisLock)) return false;

    if (rawKey === "Backspace") {
      snap.angleInputBuffer = String(snap.angleInputBuffer || "").slice(0, -1);
      return reapplyActionRotationBuffer();
    }

    if (rawKey === "=" || rawKey === "-") return toggleActionRotationDirection();
    if (rawKey === "+") return setActionRotationDirectionSign(1);

    if (!"0123456789.".includes(rawKey)) return false;
    if (rawKey === "." && String(snap.angleInputBuffer || "").includes(".")) return false;

    snap.angleInputBuffer = String(snap.angleInputBuffer || "") + rawKey;
    return reapplyActionRotationBuffer();
  }

  function clientPointFromWorldPoint(point) {
    const rect = renderer.domElement.getBoundingClientRect();
    camera.updateMatrixWorld?.();
    const projected = point.clone().project(camera);
    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
    };
  }

  function pointFromLastCursorOnCameraPlane(planePoint) {
    const rect = renderer.domElement.getBoundingClientRect();
    const clientX = Number.isFinite(state.lastPointerClient.x) && state.lastPointerClient.x !== 0
      ? state.lastPointerClient.x
      : rect.left + rect.width * 0.5;
    const clientY = Number.isFinite(state.lastPointerClient.y) && state.lastPointerClient.y !== 0
      ? state.lastPointerClient.y
      : rect.top + rect.height * 0.5;
    pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    camera.updateMatrixWorld?.();
    raycaster.setFromCamera(pointerNdc, camera);
    const cameraDir = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, planePoint);
    const point = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, point) ? point : null;
  }

  function fallbackExtrudePointFrom(source) {
    const distance = Math.max(WELD_EPSILON * 100, state.maxDim * 0.06, 0.001);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    if (right.lengthSq() < 1e-12) right.set(1, 0, 0);
    return source.clone().addScaledVector(right.normalize(), distance);
  }

  function extrudeSingleVertex(sourceIndex) {
    if (!state.topology || !Number.isInteger(sourceIndex)) return false;
    const source = state.topology.vertices[sourceIndex];
    if (!source) return false;

    let target = pointFromLastCursorOnCameraPlane(source);
    const minDistance = Math.max(WELD_EPSILON * 100, state.maxDim * 0.004, 0.001);
    if (!target || target.distanceTo(source) <= minDistance) {
      target = fallbackExtrudePointFrom(source);
    }

    const newIndex = state.topology.vertices.length;
    state.topology.vertices.push(target.clone());
    state.topology.customEdges = Array.isArray(state.topology.customEdges) ? state.topology.customEdges : [];
    const key = edgeKey(sourceIndex, newIndex);
    const exists = state.topology.customEdges.some((edge) => edgeKey(edge[0], edge[1]) === key);
    if (!exists) state.topology.customEdges.push([sourceIndex, newIndex]);

    state.selection.clear();
    state.selection.add(newIndex);
    state.maxDim = computeBounds().maxDim;
    rebuildDisplayGeometry();
    markDirty("Vertex extruded");
    const grabStartVertices = cloneVertices(state.topology.vertices);
    grabStartVertices[newIndex] = source.clone();
    const sourceClient = clientPointFromWorldPoint(source);
    startActionMode("grab", {
      clientX: sourceClient.x,
      clientY: sourceClient.y,
      startVerticesOverride: grabStartVertices,
      centroidOverride: source,
    });
    applyActionMove(state.lastPointerClient.x, state.lastPointerClient.y);
    return true;
  }

  function ensureCustomEdge(a, b) {
    if (!state.topology || !Number.isInteger(a) || !Number.isInteger(b) || a === b) return false;
    state.topology.customEdges = Array.isArray(state.topology.customEdges) ? state.topology.customEdges : [];
    const key = edgeKey(a, b);
    const exists = state.topology.customEdges.some((edge) => edgeKey(edge[0], edge[1]) === key);
    if (!exists) state.topology.customEdges.push([a, b]);
    return !exists;
  }

  function topologyHasEdge(a, b) {
    if (!state.topology || !Number.isInteger(a) || !Number.isInteger(b) || a === b) return false;
    const key = edgeKey(a, b);
    if ((state.topology.customEdges || []).some((edge) => edgeKey(edge[0], edge[1]) === key)) return true;
    for (const face of state.topology.faces || []) {
      if (!Array.isArray(face) || face.length < 3) continue;
      for (let i = 0; i < face.length; i += 1) {
        if (edgeKey(face[i], face[(i + 1) % face.length]) === key) return true;
      }
    }
    return false;
  }

  function selectedFaceIndicesForSelection() {
    const selectedFaces = [];
    if (!state.topology) return selectedFaces;
    state.topology.faces.forEach((face, index) => {
      if (!Array.isArray(face) || face.length < 3) return;
      if (face.every((vertexIndex) => state.selection.has(vertexIndex))) selectedFaces.push(index);
    });
    return selectedFaces;
  }

  function centroidForVertexIndices(indices = []) {
    const centroid = new THREE.Vector3();
    let count = 0;
    indices.forEach((index) => {
      const vertex = state.topology?.vertices?.[index];
      if (!vertex) return;
      centroid.add(vertex);
      count += 1;
    });
    if (count > 0) centroid.multiplyScalar(1 / count);
    return centroid;
  }

  function extrusionOffsetForSelection(indices = [], normalHint = null) {
    const centroid = centroidForVertexIndices(indices);
    let target = pointFromLastCursorOnCameraPlane(centroid);
    const minDistance = Math.max(WELD_EPSILON * 100, state.maxDim * 0.004, 0.001);
    if (!target || target.distanceTo(centroid) <= minDistance) {
      const distance = Math.max(0.001, state.maxDim * 0.06);
      const normal = normalHint?.isVector3 && normalHint.lengthSq() > 1e-12
        ? normalHint.clone().normalize()
        : new THREE.Vector3().subVectors(fallbackExtrudePointFrom(centroid), centroid).normalize();
      target = centroid.clone().addScaledVector(normal, distance);
    }
    return new THREE.Vector3().subVectors(target, centroid);
  }

  function startGrabForExtrudedVertices(oldToNew, centroid, message = "Selection extruded") {
    state.selection = new Set(oldToNew.values());
    state.maxDim = computeBounds().maxDim;
    rebuildDisplayGeometry();
    markDirty(message);

    const grabStartVertices = cloneVertices(state.topology.vertices);
    oldToNew.forEach((newIndex, oldIndex) => {
      const source = state.topology.vertices[oldIndex];
      if (source) grabStartVertices[newIndex] = source.clone();
    });
    const sourceClient = clientPointFromWorldPoint(centroid);
    startActionMode("grab", {
      clientX: sourceClient.x,
      clientY: sourceClient.y,
      startVerticesOverride: grabStartVertices,
      centroidOverride: centroid,
    });
    applyActionMove(state.lastPointerClient.x, state.lastPointerClient.y);
  }

  function selectedVertexLoopFromTopology() {
    if (!state.topology || state.selection.size < 3) return null;
    const selected = new Set(state.selection);
    const adjacency = new Map(Array.from(selected).map((index) => [index, new Set()]));
    const addSelectedEdge = (a, b) => {
      if (!selected.has(a) || !selected.has(b) || a === b) return;
      adjacency.get(a)?.add(b);
      adjacency.get(b)?.add(a);
    };

    for (const face of state.topology.faces || []) {
      if (!Array.isArray(face) || face.length < 3) continue;
      for (let i = 0; i < face.length; i += 1) addSelectedEdge(face[i], face[(i + 1) % face.length]);
    }
    for (const edge of state.topology.customEdges || []) {
      if (!Array.isArray(edge) || edge.length < 2) continue;
      addSelectedEdge(edge[0], edge[1]);
    }

    if (Array.from(adjacency.values()).some((neighbors) => neighbors.size !== 2)) return null;
    const start = Array.from(selected)[0];
    const loop = [start];
    let previous = null;
    let current = start;
    for (let guard = 0; guard < selected.size; guard += 1) {
      const next = Array.from(adjacency.get(current) || []).find((candidate) => candidate !== previous);
      if (!Number.isInteger(next)) return null;
      if (next === start) return loop.length === selected.size ? loop : null;
      if (loop.includes(next)) return null;
      loop.push(next);
      previous = current;
      current = next;
    }
    return null;
  }

  function extrudeFaceIndices(selectedFaces = []) {
    if (!state.topology || selectedFaces.length === 0) return false;
    const normal = new THREE.Vector3();
    const sourceSet = new Set();
    selectedFaces.forEach((faceIndex) => {
      const face = state.topology.faces[faceIndex];
      if (!face) return;
      face.forEach((vertexIndex) => sourceSet.add(vertexIndex));
      normal.add(faceNormal(state.topology.vertices, face));
    });
    const sourceIndices = Array.from(sourceSet);
    if (sourceIndices.length < 3) return false;
    const offset = extrusionOffsetForSelection(sourceIndices, normal);
    const centroid = centroidForVertexIndices(sourceIndices);

    const oldToNew = new Map();
    sourceIndices.forEach((vertexIndex) => {
      const source = state.topology.vertices[vertexIndex];
      if (!source) return;
      oldToNew.set(vertexIndex, state.topology.vertices.length);
      state.topology.vertices.push(source.clone().add(offset));
    });

    const newFaces = [];
    selectedFaces.forEach((faceIndex) => {
      const face = state.topology.faces[faceIndex];
      const copy = face.map((vertexIndex) => oldToNew.get(vertexIndex));
      if (copy.every(Number.isInteger) && new Set(copy).size === copy.length) newFaces.push(copy);
    });

    const boundaryEdgeCounts = new Map();
    const boundaryEdgeOrientation = new Map();
    selectedFaces.forEach((faceIndex) => {
      const face = state.topology.faces[faceIndex];
      if (!Array.isArray(face) || face.length < 3) return;
      for (let i = 0; i < face.length; i += 1) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        const key = edgeKey(a, b);
        boundaryEdgeCounts.set(key, (boundaryEdgeCounts.get(key) || 0) + 1);
        if (!boundaryEdgeOrientation.has(key)) boundaryEdgeOrientation.set(key, [a, b]);
      }
    });

    boundaryEdgeCounts.forEach((count, key) => {
      if (count !== 1) return;
      const [a, b] = boundaryEdgeOrientation.get(key);
      const a2 = oldToNew.get(a);
      const b2 = oldToNew.get(b);
      if (!Number.isInteger(a2) || !Number.isInteger(b2)) return;
      newFaces.push([a, b, b2], [a, b2, a2]);
      ensureCustomEdge(a, a2);
      ensureCustomEdge(b, b2);
      ensureCustomEdge(a2, b2);
    });

    state.topology.faces.push(...newFaces);
    startGrabForExtrudedVertices(oldToNew, centroid, "Face extruded");
    return true;
  }

  function extrudeVertexLoop(loop = []) {
    if (!state.topology || loop.length < 3) return false;
    const sourceIndices = loop.filter((index) => Number.isInteger(index) && state.topology.vertices[index]);
    if (sourceIndices.length < 3) return false;
    const offset = extrusionOffsetForSelection(sourceIndices);
    const centroid = centroidForVertexIndices(sourceIndices);
    const oldToNew = new Map();
    sourceIndices.forEach((vertexIndex) => {
      const source = state.topology.vertices[vertexIndex];
      oldToNew.set(vertexIndex, state.topology.vertices.length);
      state.topology.vertices.push(source.clone().add(offset));
    });

    const newFaces = [];
    const root = oldToNew.get(sourceIndices[0]);
    for (let i = 1; i < sourceIndices.length - 1; i += 1) {
      const a = oldToNew.get(sourceIndices[i]);
      const b = oldToNew.get(sourceIndices[i + 1]);
      if (Number.isInteger(root) && Number.isInteger(a) && Number.isInteger(b)) newFaces.push([root, a, b]);
    }
    for (let i = 0; i < sourceIndices.length; i += 1) {
      const a = sourceIndices[i];
      const b = sourceIndices[(i + 1) % sourceIndices.length];
      const a2 = oldToNew.get(a);
      const b2 = oldToNew.get(b);
      if (!Number.isInteger(a2) || !Number.isInteger(b2)) continue;
      newFaces.push([a, b, b2], [a, b2, a2]);
      ensureCustomEdge(a, b);
      ensureCustomEdge(a, a2);
      ensureCustomEdge(b, b2);
      ensureCustomEdge(a2, b2);
    }

    state.topology.faces.push(...newFaces);
    startGrabForExtrudedVertices(oldToNew, centroid, "Face boundary extruded");
    return true;
  }

  function extrudeEdgeSelection(edgeIndices = Array.from(state.selection || [])) {
    if (!state.topology || edgeIndices.length !== 2) return false;
    const [a, b] = edgeIndices;
    const sourceA = state.topology.vertices[a];
    const sourceB = state.topology.vertices[b];
    if (!sourceA || !sourceB || a === b || !topologyHasEdge(a, b)) return false;

    const midpoint = new THREE.Vector3().addVectors(sourceA, sourceB).multiplyScalar(0.5);
    let targetMidpoint = pointFromLastCursorOnCameraPlane(midpoint);
    const minDistance = Math.max(WELD_EPSILON * 100, state.maxDim * 0.004, 0.001);
    if (!targetMidpoint || targetMidpoint.distanceTo(midpoint) <= minDistance) {
      targetMidpoint = fallbackExtrudePointFrom(midpoint);
    }
    const offset = new THREE.Vector3().subVectors(targetMidpoint, midpoint);

    const a2 = state.topology.vertices.length;
    const b2 = a2 + 1;
    state.topology.vertices.push(sourceA.clone().add(offset), sourceB.clone().add(offset));
    state.topology.faces.push([a, b, b2], [a, b2, a2]);
    ensureCustomEdge(a, b);
    ensureCustomEdge(a, a2);
    ensureCustomEdge(b, b2);
    ensureCustomEdge(a2, b2);

    state.selection = new Set([a2, b2]);
    state.maxDim = computeBounds().maxDim;
    rebuildDisplayGeometry();
    markDirty("Edge extruded");

    const grabStartVertices = cloneVertices(state.topology.vertices);
    grabStartVertices[a2] = sourceA.clone();
    grabStartVertices[b2] = sourceB.clone();
    const sourceClient = clientPointFromWorldPoint(midpoint);
    startActionMode("grab", {
      clientX: sourceClient.x,
      clientY: sourceClient.y,
      startVerticesOverride: grabStartVertices,
      centroidOverride: midpoint,
    });
    applyActionMove(state.lastPointerClient.x, state.lastPointerClient.y);
    return true;
  }

  function extrudeSelection() {
    if (!state.topology || state.selection.size === 0) return;
    if (state.selection.size === 1) {
      const [sourceIndex] = Array.from(state.selection);
      extrudeSingleVertex(sourceIndex);
      return;
    }
    if (state.selection.size === 2) {
      if (extrudeEdgeSelection()) return;
      setModeLabel("selected vertices are not joined by an edge");
      return;
    }

    const selectedFaces = selectedFaceIndicesForSelection();
    if (selectedFaces.length > 0 && extrudeFaceIndices(selectedFaces)) return;

    const loop = selectedVertexLoopFromTopology();
    if (loop && extrudeVertexLoop(loop)) return;

    setModeLabel("selection does not define a connected edge or face");
  }

  function fillOrConnectSelection() {
    if (!state.topology || state.selection.size < 2) return;
    const selected = Array.from(state.selection);
    if (selected.length === 2) {
      const [a, b] = selected;
      const key = edgeKey(a, b);
      const exists = state.topology.customEdges.some((e) =>
        edgeKey(e[0], e[1]) === key
      );
      if (!exists) state.topology.customEdges.push([a, b]);
      rebuildCustomEdgesDisplay();
      setModeLabel("edge added");
      markDirty("Edge added");
      return;
    }

    const vertices = selected.map((index) => state.topology.vertices[index]).filter(Boolean);
    if (!verticesAreCoplanar(vertices)) {
      setModeLabel("selection is not coplanar");
      return;
    }

    const root = selected[0];
    for (let i = 1; i < selected.length - 1; i++) {
      const a = selected[i];
      const b = selected[i + 1];
      if (root === a || a === b || root === b) continue;
      state.topology.faces.push([root, a, b]);
    }
    rebuildDisplayGeometry();
    setModeLabel("face fill");
    markDirty("Face filled");
  }

  function deleteSelectedVertices() {
    if (!state.topology || state.selection.size === 0 || state.mode !== "idle") return false;

    const removed = new Set(
      Array.from(state.selection).filter((index) =>
        Number.isInteger(index) && index >= 0 && index < state.topology.vertices.length
      ),
    );
    if (removed.size === 0) {
      state.selection.clear();
      rebuildSelectionDisplay();
      notifyToolbarState();
      return false;
    }

    const indexMap = new Map();
    const vertices = [];
    state.topology.vertices.forEach((vertex, index) => {
      if (removed.has(index)) return;
      indexMap.set(index, vertices.length);
      vertices.push(vertex);
    });

    const faces = [];
    for (const face of state.topology.faces) {
      if (!Array.isArray(face) || face.some((index) => removed.has(index))) continue;
      const mapped = face.map((index) => indexMap.get(index));
      if (mapped.every((index) => Number.isInteger(index)) && new Set(mapped).size === 3) faces.push(mapped);
    }

    const customEdges = [];
    const seenEdges = new Set();
    for (const edge of state.topology.customEdges || []) {
      if (!Array.isArray(edge) || edge.length < 2 || edge.some((index) => removed.has(index))) continue;
      const a = indexMap.get(edge[0]);
      const b = indexMap.get(edge[1]);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue;
      const key = edgeKey(a, b);
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      customEdges.push([a, b]);
    }

    state.topology.vertices = vertices;
    state.topology.faces = faces;
    state.topology.customEdges = customEdges;
    state.selection.clear();
    state.maxDim = computeBounds().maxDim;
    rebuildDisplayGeometry();
    setModeLabel("deleted " + removed.size + " point" + (removed.size === 1 ? "" : "s"));
    markDirty("Deleted " + removed.size + " STL point" + (removed.size === 1 ? "" : "s"));
    notifyToolbarState();
    return true;
  }

  function addVertexAtCameraFocus() {
    if (!state.topology) return;
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const distance = Math.max(1, state.maxDim * 0.35);
    const position = controls.target.clone().addScaledVector(direction, -distance);
    const newIndex = state.topology.vertices.length;
    state.topology.vertices.push(position);
    state.selection.clear();
    state.selection.add(newIndex);
    state.maxDim = computeBounds().maxDim;
    rebuildDisplayGeometry();
    setModeLabel("vertex added");
    markDirty("Vertex added");
  }


  function isSculptToolActive() {
    return state.sculpt.tool && state.sculpt.tool !== "select";
  }

  function sculptStatusLabel() {
    return `${state.sculpt.tool} r=${state.sculpt.radius.toFixed(2)} strength=${state.sculpt.strength.toFixed(2)}`;
  }

  function resetSculptBrushForBounds() {
    state.sculpt.radius = Math.max(WELD_EPSILON * 100, state.maxDim * 0.06);
    state.sculpt.strength = Math.max(0.05, Math.min(1, state.sculpt.strength || 0.35));
  }

  function setSculptTool(tool) {
    if (state.mode === "grab" || state.mode === "scale" || state.mode === "rotate") commitAction();
    state.sculpt.stroke = null;
    state.sculpt.tool = tool;
    controls.enabled = !isSculptToolActive();
    container.classList.toggle("nv-stl-sculpt-active", isSculptToolActive());
    if (!isSculptToolActive() && brushRing) brushRing.visible = false;
    setModeLabel(isSculptToolActive() ? `sculpt ${sculptStatusLabel()}` : "sculpt off");
    notifyToolbarState();
  }

  function adjustSculptRadius(factor) {
    state.sculpt.radius = Math.max(WELD_EPSILON * 100, Math.min(state.maxDim * 2, state.sculpt.radius * factor));
    setModeLabel(isSculptToolActive() ? `sculpt ${sculptStatusLabel()}` : `brush radius ${state.sculpt.radius.toFixed(2)}`);
    notifyToolbarState();
  }

  function adjustSculptStrength(delta) {
    state.sculpt.strength = Math.max(0.02, Math.min(1, state.sculpt.strength + delta));
    setModeLabel(isSculptToolActive() ? `sculpt ${sculptStatusLabel()}` : `brush strength ${state.sculpt.strength.toFixed(2)}`);
    notifyToolbarState();
  }

  function ensureBrushRing() {
    if (brushRing) return brushRing;
    const points = [];
    const segments = 80;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0.95, depthTest: false });
    brushRing = new THREE.LineLoop(geometry, material);
    brushRing.visible = false;
    brushRing.renderOrder = 10;
    scene.add(brushRing);
    return brushRing;
  }

  function surfaceHitFromEvent(evt) {
    if (!mesh || !state.topology) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerNdc.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(mesh, false);
    if (!hits.length) return null;
    const hit = hits[0];
    const normal = (hit.face?.normal || new THREE.Vector3(0, 0, 1)).clone();
    normal.transformDirection(mesh.matrixWorld).normalize();
    return { point: hit.point.clone(), normal, faceIndex: hit.faceIndex };
  }

  function updateBrushRing(hit) {
    if (!isSculptToolActive()) return;
    const ring = ensureBrushRing();
    if (!hit) {
      ring.visible = false;
      return;
    }
    ring.visible = true;
    ring.position.copy(hit.point).addScaledVector(hit.normal, state.sculpt.radius * 0.01);
    ring.scale.setScalar(state.sculpt.radius);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.normal.clone().normalize());
  }

  function brushFalloff(distance) {
    const t = Math.max(0, 1 - distance / Math.max(WELD_EPSILON, state.sculpt.radius));
    return t * t * (3 - 2 * t);
  }

  function brushedVertices(hit) {
    if (!state.topology || !hit) return [];
    const affected = [];
    state.topology.vertices.forEach((v, index) => {
      const distance = v.distanceTo(hit.point);
      if (distance <= state.sculpt.radius) affected.push({ index, falloff: brushFalloff(distance) });
    });
    return affected;
  }

  function buildVertexNeighbors() {
    const count = state.topology?.vertices?.length || 0;
    const neighbors = Array.from({ length: count }, () => new Set());
    for (const [a, b, c] of state.topology.faces) {
      neighbors[a]?.add(b); neighbors[a]?.add(c);
      neighbors[b]?.add(a); neighbors[b]?.add(c);
      neighbors[c]?.add(a); neighbors[c]?.add(b);
    }
    return neighbors;
  }

  function applySculptBrush(hit) {
    if (!state.topology || !hit) return false;
    const affected = brushedVertices(hit);
    if (!affected.length) return false;
    const tool = state.sculpt.tool;
    const amount = state.sculpt.radius * state.sculpt.strength * 0.08;
    const original = cloneVertices(state.topology.vertices);
    const bounds = computeBounds();

    if (tool === "smooth") {
      const neighbors = buildVertexNeighbors();
      affected.forEach(({ index, falloff }) => {
        const linked = Array.from(neighbors[index] || []);
        if (!linked.length) return;
        const average = new THREE.Vector3();
        linked.forEach((i) => average.add(original[i]));
        average.multiplyScalar(1 / linked.length);
        state.topology.vertices[index].lerp(average, Math.min(1, state.sculpt.strength * falloff * 0.65));
      });
    } else if (tool === "flatten") {
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(hit.normal, hit.point);
      affected.forEach(({ index, falloff }) => {
        const distance = plane.distanceToPoint(state.topology.vertices[index]);
        state.topology.vertices[index].addScaledVector(hit.normal, -distance * state.sculpt.strength * falloff);
      });
    } else if (tool === "pinch") {
      affected.forEach(({ index, falloff }) => {
        const direction = new THREE.Vector3().subVectors(hit.point, state.topology.vertices[index]);
        state.topology.vertices[index].addScaledVector(direction, state.sculpt.strength * falloff * 0.12);
      });
    } else if (tool === "inflate" || tool === "deflate") {
      const sign = tool === "inflate" ? 1 : -1;
      affected.forEach(({ index, falloff }) => {
        const direction = new THREE.Vector3().subVectors(state.topology.vertices[index], bounds.center);
        if (direction.lengthSq() < 1e-12) direction.copy(hit.normal);
        direction.normalize();
        state.topology.vertices[index].addScaledVector(direction, sign * amount * falloff);
      });
    } else {
      affected.forEach(({ index, falloff }) => {
        state.topology.vertices[index].addScaledVector(hit.normal, amount * falloff);
      });
    }

    rebuildDisplayGeometry();
    updateBrushRing(hit);
    return true;
  }

  function beginSculptStroke(evt) {
    if (!isSculptToolActive() || evt.button !== 0) return false;
    const hit = surfaceHitFromEvent(evt);
    updateBrushRing(hit);
    if (!hit) return false;
    evt.preventDefault();
    controls.enabled = false;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const stroke = {
      tool: state.sculpt.tool,
      startVertices: cloneVertices(state.topology.vertices),
      startHit: hit.point.clone(),
      affected: brushedVertices(hit),
      dragPlane: new THREE.Plane().setFromNormalAndCoplanarPoint(camDir.clone().normalize(), hit.point),
      changed: false,
    };
    state.sculpt.stroke = stroke;
    if (stroke.tool !== "grab") stroke.changed = applySculptBrush(hit) || stroke.changed;
    return true;
  }

  function continueSculptStroke(evt) {
    const stroke = state.sculpt.stroke;
    if (!stroke) return false;
    if (stroke.tool === "grab") {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(stroke.dragPlane, point)) return true;
      const delta = new THREE.Vector3().subVectors(point, stroke.startHit);
      stroke.affected.forEach(({ index, falloff }) => {
        state.topology.vertices[index].copy(stroke.startVertices[index]).addScaledVector(delta, falloff);
      });
      rebuildDisplayGeometry();
      updateBrushRing({ point, normal: stroke.dragPlane.normal.clone() });
      stroke.changed = true;
      return true;
    }
    const hit = surfaceHitFromEvent(evt);
    updateBrushRing(hit);
    stroke.changed = applySculptBrush(hit) || stroke.changed;
    return true;
  }

  function endSculptStroke() {
    const stroke = state.sculpt.stroke;
    if (!stroke) return;
    state.sculpt.stroke = null;
    controls.enabled = !isSculptToolActive();
    if (stroke.changed) markDirty(`Sculpt ${stroke.tool}`);
  }

  function handleSculptHover(evt) {
    if (!isSculptToolActive() || state.sculpt.stroke) return;
    updateBrushRing(surfaceHitFromEvent(evt));
  }

  function handleSTLToolbarAction(callbackKey) {
    const actions = {
      stlAddVertex: () => addVertexAtCameraFocus(),
      stlRecenter: () => {
        recenterCameraToTopology();
        setModeLabel("view centered");
      },
      stlClearSelection: () => {
        state.selection.clear();
        rebuildSelectionDisplay();
        setModeLabel();
        notifyToolbarState();
      },
      stlSelectAll: () => selectAllVertices(),
      stlGrab: () => {
        if (isSculptToolActive()) setSculptTool("select");
        if (state.selection.size > 0) startActionMode("grab");
      },
      stlScale: () => {
        if (isSculptToolActive()) setSculptTool("select");
        if (state.selection.size > 0) startActionMode("scale");
      },
      stlExtrude: () => extrudeSelection(),
      stlFillOrConnect: () => fillOrConnectSelection(),
      stlSculptDraw: () => setSculptTool("draw"),
      stlSculptSmooth: () => setSculptTool("smooth"),
      stlSculptFlatten: () => setSculptTool("flatten"),
      stlSculptInflate: () => setSculptTool("inflate"),
      stlSculptDeflate: () => setSculptTool("deflate"),
      stlSculptPinch: () => setSculptTool("pinch"),
      stlSculptGrab: () => setSculptTool("grab"),
      stlSculptOff: () => setSculptTool("select"),
      stlSculptRadiusDown: () => adjustSculptRadius(0.8),
      stlSculptRadiusUp: () => adjustSculptRadius(1.25),
      stlSculptStrengthDown: () => adjustSculptStrength(-0.08),
      stlSculptStrengthUp: () => adjustSculptStrength(0.08),
      stlSave: async () => {
        try {
          await saveSTL(filePath);
          setNodevisionStatus("STL", "Saved");
        } catch (err) {
          console.error("[STLeditor] Save failed:", err);
          alert("Failed to save STL: " + (err?.message || err));
        }
      },
    };
    if (typeof actions[callbackKey] === "function") {
      actions[callbackKey]();
      return true;
    }
    return false;
  }

  function ensureSelectionBoxElement() {
    if (state.selectionBox?.el) return state.selectionBox.el;
    const el = document.createElement("div");
    el.className = "nv-stl-selection-box";
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

  function startSelectionBox(evt) {
    state.selectionBox = {
      startX: evt.clientX,
      startY: evt.clientY,
      currentX: evt.clientX,
      currentY: evt.clientY,
      moved: false,
      shiftKey: evt.shiftKey,
      el: null,
    };
    updateSelectionBoxElement();
  }

  function updateSelectionBox(evt) {
    const box = state.selectionBox;
    if (!box) return false;
    box.currentX = evt.clientX;
    box.currentY = evt.clientY;
    updateSelectionBoxElement();
    return true;
  }

  function selectVerticesInBox(box) {
    if (!state.topology?.vertices?.length) return;
    const left = Math.min(box.startX, box.currentX);
    const right = Math.max(box.startX, box.currentX);
    const top = Math.min(box.startY, box.currentY);
    const bottom = Math.max(box.startY, box.currentY);
    const rect = renderer.domElement.getBoundingClientRect();
    const next = box.shiftKey ? new Set(state.selection) : new Set();
    camera.updateMatrixWorld?.();
    state.topology.vertices.forEach((vertex, index) => {
      const point = vertex.clone().project(camera);
      if (point.z < -1 || point.z > 1) return;
      const x = rect.left + (point.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-point.y * 0.5 + 0.5) * rect.height;
      if (x >= left && x <= right && y >= top && y <= bottom) next.add(index);
    });
    state.selection = next;
    rebuildSelectionDisplay();
    notifyToolbarState();
  }

  function finishSelectionBox(evt) {
    const box = state.selectionBox;
    if (!box) return false;
    box.currentX = evt.clientX;
    box.currentY = evt.clientY;
    updateSelectionBoxElement();
    const moved = box.moved;
    if (moved) selectVerticesInBox(box);
    box.el?.remove?.();
    state.selectionBox = null;
    if (!moved) pickVertex(evt);
    return true;
  }

  function pickVertex(evt) {
    if (!vertexPoints || !state.topology) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(vertexPoints, false);
    if (!hits.length) {
      if (!evt.shiftKey) {
        state.selection.clear();
        rebuildSelectionDisplay();
        notifyToolbarState();
      }
      return;
    }
    const pointIndex = hits[0].index;
    if (!Number.isInteger(pointIndex)) return;

    if (evt.shiftKey) {
      if (state.selection.has(pointIndex)) state.selection.delete(pointIndex);
      else state.selection.add(pointIndex);
    } else {
      state.selection.clear();
      state.selection.add(pointIndex);
    }
    rebuildSelectionDisplay();
    notifyToolbarState();
  }

  function onPointerDown(evt) {
    container.focus();
    state.lastPointerClient.x = evt.clientX;
    state.lastPointerClient.y = evt.clientY;
    if (state.mode === "grab" || state.mode === "scale" || state.mode === "rotate") {
      commitAction();
      return;
    }
    if (evt.button !== 0) return;
    if (isSculptToolActive()) {
      beginSculptStroke(evt);
      return;
    }
    startSelectionBox(evt);
  }

  function onPointerMove(evt) {
    state.lastPointerClient.x = evt.clientX;
    state.lastPointerClient.y = evt.clientY;
    if (state.mode === "grab" || state.mode === "scale") {
      applyActionMove(evt.clientX, evt.clientY);
      return;
    }
    if (state.mode === "rotate") return;
    if (updateSelectionBox(evt)) return;
    if (state.sculpt.stroke) {
      continueSculptStroke(evt);
      return;
    }
    handleSculptHover(evt);
  }

  function onPointerUp(evt) {
    if (finishSelectionBox(evt)) return;
    endSculptStroke();
  }

  function handlePositionCommand(evt, key) {
    if (evt.ctrlKey || evt.metaKey || evt.altKey || key.length !== 1) return false;
    if (state.commandBuffer === "p") {
      clearPendingCommand();
      if (!STL_ACTION_AXIS_TYPES.has(key) || state.mode !== "idle" || state.selection.size === 0) return false;
      if (isSculptToolActive()) setSculptTool("select");
      startActionMode("grab", evt);
      setActionAxisConstraint(key, { inputMode: "position" });
      return true;
    }
    if (key !== "p" || state.mode !== "idle" || state.selection.size === 0) return false;
    clearPendingCommand();
    state.commandBuffer = "p";
    state.commandTimer = window.setTimeout(() => {
      if (state.commandBuffer !== "p") return;
      clearPendingCommand();
      if (state.mode === "idle") setModeLabel();
    }, 650);
    setModeLabel("position command: px, py, or pz");
    return true;
  }

  function onKeyDown(evt) {
    if (state.destroyed) return;
    const activeEl = document.activeElement;
    if (activeEl !== container && !container.contains(activeEl)) return;
    const key = String(evt.key || "").toLowerCase();
    if (
      ["input", "textarea", "select"].includes(
        document.activeElement?.tagName?.toLowerCase(),
      )
    ) return;

    if (key === "escape") {
      evt.preventDefault();
      if (state.sculpt.stroke) {
        endSculptStroke();
      } else if (isSculptToolActive()) {
        setSculptTool("select");
      } else {
        cancelAction();
      }
      return;
    }

    if (handleActionRotationKey(evt)) {
      evt.preventDefault();
      return;
    }

    if (handleActionAxisDistanceKey(evt)) {
      evt.preventDefault();
      return;
    }

    if (key === "enter" && (state.mode === "grab" || state.mode === "scale" || state.mode === "rotate")) {
      evt.preventDefault();
      commitAction();
      return;
    }

    if (handlePositionCommand(evt, key)) {
      evt.preventDefault();
      return;
    }

    if (state.mode === "grab" && STL_ACTION_AXIS_TYPES.has(key)) {
      evt.preventDefault();
      setActionAxisConstraint(key);
      return;
    }

    if ((key === "delete" || key === "del" || key === "backspace") && state.mode === "idle") {
      evt.preventDefault();
      deleteSelectedVertices();
      return;
    }

    if (isSculptToolActive()) return;

    if (key === "g") {
      evt.preventDefault();
      if (state.selection.size > 0) startActionMode("grab", evt);
      return;
    }

    if (key === "a") {
      evt.preventDefault();
      selectAllVertices();
      return;
    }

    if (key === "s") {
      evt.preventDefault();
      if (state.selection.size > 0) startActionMode("scale", evt);
      return;
    }

    if (key === "r") {
      evt.preventDefault();
      if (state.selection.size > 0) startActionMode("rotate", evt);
      return;
    }

    if (key === "e") {
      evt.preventDefault();
      extrudeSelection();
      return;
    }

    if (key === "f") {
      evt.preventDefault();
      fillOrConnectSelection();
    }
  }

  async function saveSTL(pathOverride = filePath) {
    if (!state.topology) state.topology = createEmptyTopology();
    const content = serializeTopologyToAsciiSTL(state.topology, pathOverride);
    const res = await fetch(SAVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathOverride, content, encoding: "utf8" }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || (String(res.status) + " " + String(res.statusText || "STL save failed")));
    }
    state.dirty = false;
    notifyToolbarState({ fileIsDirty: false });
  }

  function onResize() {
    const rect = viewport.getBoundingClientRect();
    const w = Math.max(1, rect.width || viewport.clientWidth || 1);
    const h = Math.max(1, rect.height || viewport.clientHeight || 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => onResize());
    resizeObserver.observe(viewport);
  } else {
    window.addEventListener("resize", onResize);
  }

  async function loadModel() {
    const response = await fetch(notebookUrl(filePath), { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status) + " " + String(response.statusText || "STL load failed"));
    const arrayBuffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(arrayBuffer);
    const metadataTopology = parseNodevisionTopologyMetadata(text);
    if (metadataTopology) {
      state.topology = metadataTopology;
      recenterCameraToTopology();
      resetSculptBrushForBounds();
      rebuildDisplayGeometry();
      if (state.topology.vertices.length === 0 && state.topology.faces.length === 0) setModeLabel("empty STL");
      else setModeLabel("loaded");
      return;
    }
    if (isEmptySTLBuffer(arrayBuffer)) {
      state.topology = createEmptyTopology();
      recenterCameraToTopology();
      resetSculptBrushForBounds();
      rebuildDisplayGeometry();
      setModeLabel("empty STL");
      return;
    }

    const loader = new STLLoader();
    const geometry = looksLikeAsciiSTLText(text) && !isExactBinarySTLBuffer(arrayBuffer)
      ? loader.parse(text)
      : loader.parse(arrayBuffer);
    state.topology = buildTopologyFromGeometry(geometry);
    recenterCameraToTopology();
    resetSculptBrushForBounds();
    rebuildDisplayGeometry();
    if (state.topology.vertices.length === 0 && state.topology.faces.length === 0) setModeLabel("empty STL");
    else setModeLabel("loaded");
  }

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeActionHandler = handleSTLToolbarAction;
  notifyToolbarState();
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "STL Mesh", force: true, toggle: false },
  }));
  window.saveWYSIWYGFile = async (path = filePath) => {
    await saveSTL(path);
  };
  window.STLEditorContext = {
    filePath,
    handleToolbarAction: handleSTLToolbarAction,
    save: saveSTL,
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("nv-theme-changed", onThemeChanged);

  renderer.setAnimationLoop(() => {
    if (state.destroyed) return;
    controls.update();
    renderer.render(scene, camera);
    orientationWidget?.sync?.();
  });

  try {
    await loadModel();
    onResize();
  } catch (err) {
    console.error("[STLeditor] Failed to load model:", err);
    container.innerHTML = "";
    const message = document.createElement("em");
    message.className = "nv-stl-error";
    message.textContent = "Failed to load STL model: " + (err?.message || err);
    container.appendChild(message);
  }

  return {
    destroy() {
      state.destroyed = true;
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("nv-theme-changed", onThemeChanged);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", onResize);
      state.selectionBox?.el?.remove?.();
      state.selectionBox = null;
      controls.dispose();
      if (brushRing) {
        scene.remove(brushRing);
        brushRing.geometry.dispose();
        brushRing.material.dispose();
        brushRing = null;
      }
      scene.remove(floorGrid);
      floorGrid.geometry?.dispose?.();
      disposeMaterial(floorGrid.material);
      renderer.dispose();
      orientationWidget?.destroy?.();
      if (window.NodevisionState?.activeActionHandler === handleSTLToolbarAction) {
        window.NodevisionState.activeActionHandler = null;
      }
      if (window.STLEditorContext?.handleToolbarAction === handleSTLToolbarAction) {
        delete window.STLEditorContext;
      }
      container.classList.remove("nv-stl-editor");
      container.innerHTML = "";
    },
  };
}
