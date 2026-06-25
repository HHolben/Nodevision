// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/STLeditor.mjs
// This file defines browser-side STLeditor logic for the Nodevision UI. It renders interface components and handles user interactions.

import * as THREE from "/lib/three/three.module.js";
import { STLLoader } from "/lib/three/STLLoader.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setStatus as setNodevisionStatus } from "/StatusBar.mjs";

const SAVE_ENDPOINT = "/api/save";
const WELD_EPSILON = 1e-5;

function ensureStyles() {
  if (document.getElementById("nv-stl-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-stl-editor-styles";
  style.textContent = `
    .nv-stl-editor { position:relative; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; background:#fff; }
    .nv-stl-viewport { position:absolute; inset:0; min-width:0; min-height:0; outline:none; }
    .nv-stl-viewport canvas { display:block; width:100%; height:100%; }
    .nv-stl-error { margin:12px; color:#b00020; }
    .nv-stl-editor.nv-stl-sculpt-active .nv-stl-viewport canvas { cursor: crosshair; }
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

function faceNormal(vertices, face) {
  const a = vertices[face[0]];
  const b = vertices[face[1]];
  const c = vertices[face[2]];
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return new THREE.Vector3().crossVectors(ab, ac).normalize();
}

function serializeTopologyToAsciiSTL(topology) {
  const lines = ["solid nodevision"];
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
  lines.push("endsolid nodevision");
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
    mode: "idle", // idle | grab | scale
    actionSnapshot: null,
    actionChanged: false,
    maxDim: 100,
    destroyed: false,
    dirty: false,
    lastPointerClient: { x: 0, y: 0 },
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
  renderer.setSize(
    Math.max(1, viewport.clientWidth),
    Math.max(1, viewport.clientHeight),
  );
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0x606060));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(1, 1, 1).normalize();
  scene.add(keyLight);

  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.PerspectiveCamera(50, 1, 1, 100);
  overlayCamera.position.set(50, 50, 50);
  const overlayAxes = new THREE.AxesHelper(20);
  overlayScene.add(overlayAxes);

  const overlayRenderer = new THREE.WebGLRenderer({ alpha: true });
  overlayRenderer.setSize(100, 100);
  overlayRenderer.domElement.title = "Drag to rotate view";
  overlayRenderer.domElement.style.cssText = [
    "position:absolute",
    "top:10px",
    "right:10px",
    "width:100px",
    "height:100px",
    "cursor:grab",
    "border-radius:8px",
    "background:rgba(255,255,255,0.72)",
    "box-shadow:0 1px 6px rgba(15,23,42,0.2)",
    "z-index:4",
  ].join(";");
  viewport.appendChild(overlayRenderer.domElement);

  let gizmoDragging = false;
  let gizmoLastX = 0;
  let gizmoLastY = 0;

  function rotateCameraFromGizmo(deltaX, deltaY) {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= deltaX * 0.01;
    spherical.phi = Math.max(0.08, Math.min(Math.PI - 0.08, spherical.phi - deltaY * 0.01));
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    controls.update();
  }

  function syncViewGizmo() {
    const offset = camera.position.clone().sub(controls.target);
    if (offset.lengthSq() < 0.0001) offset.set(1, 1, 1);
    overlayCamera.position.copy(offset).setLength(50);
    overlayCamera.up.copy(camera.up);
    overlayCamera.lookAt(0, 0, 0);
  }

  overlayRenderer.domElement.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    gizmoDragging = true;
    gizmoLastX = event.clientX;
    gizmoLastY = event.clientY;
    overlayRenderer.domElement.style.cursor = "grabbing";
    overlayRenderer.domElement.setPointerCapture?.(event.pointerId);
  });
  overlayRenderer.domElement.addEventListener("pointermove", (event) => {
    if (!gizmoDragging) return;
    event.preventDefault();
    event.stopPropagation();
    rotateCameraFromGizmo(event.clientX - gizmoLastX, event.clientY - gizmoLastY);
    gizmoLastX = event.clientX;
    gizmoLastY = event.clientY;
  });
  const endGizmoDrag = (event) => {
    if (!gizmoDragging) return;
    gizmoDragging = false;
    overlayRenderer.domElement.style.cursor = "grab";
    if (event?.pointerId !== undefined) overlayRenderer.domElement.releasePointerCapture?.(event.pointerId);
  };
  overlayRenderer.domElement.addEventListener("pointerup", endGizmoDrag);
  overlayRenderer.domElement.addEventListener("pointercancel", endGizmoDrag);

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

  function startActionMode(mode, mouseEvt) {
    if (!state.topology || state.selection.size === 0) return;
    state.mode = mode;
    setModeLabel(
      mode === "grab"
        ? "move mouse, click/Enter confirm, Esc cancel"
        : "move mouse, click/Enter confirm, Esc cancel",
    );
    controls.enabled = false;

    const startVertices = cloneVertices(state.topology.vertices);
    const centroid = selectedCentroid(startVertices);
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
    };
    state.actionChanged = false;
  }

  function commitAction() {
    const changed = state.actionChanged;
    state.mode = "idle";
    state.actionSnapshot = null;
    state.actionChanged = false;
    controls.enabled = true;
    setModeLabel();
    if (changed) markDirty("Selection transformed");
  }

  function cancelAction() {
    if (!state.actionSnapshot || !state.topology) {
      commitAction();
      return;
    }
    state.topology.vertices = cloneVertices(state.actionSnapshot.startVertices);
    state.actionChanged = false;
    rebuildDisplayGeometry();
    commitAction();
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

      const delta = new THREE.Vector3().subVectors(endPoint, startPoint);
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

  function extrudeSelection() {
    if (!state.topology || state.selection.size === 0) return;
    const selectedFaces = [];
    state.topology.faces.forEach((f, i) => {
      if (
        state.selection.has(f[0]) && state.selection.has(f[1]) &&
        state.selection.has(f[2])
      ) {
        selectedFaces.push(i);
      }
    });

    const distance = Math.max(0.001, state.maxDim * 0.06);

    if (selectedFaces.length === 0) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.multiplyScalar(-distance);
      state.selection.forEach((vi) => {
        state.topology.vertices[vi].add(dir);
      });
      rebuildDisplayGeometry();
      markDirty("Selection extruded");
      return;
    }

    const normal = new THREE.Vector3();
    selectedFaces.forEach((fi) =>
      normal.add(faceNormal(state.topology.vertices, state.topology.faces[fi]))
    );
    if (normal.lengthSq() < 1e-12) normal.set(0, 0, 1);
    normal.normalize().multiplyScalar(distance);

    const oldToNew = new Map();
    selectedFaces.forEach((fi) => {
      const f = state.topology.faces[fi];
      f.forEach((vi) => {
        if (oldToNew.has(vi)) return;
        const nv = state.topology.vertices[vi].clone().add(normal);
        oldToNew.set(vi, state.topology.vertices.length);
        state.topology.vertices.push(nv);
      });
    });

    const newFaces = [];
    selectedFaces.forEach((fi) => {
      const [a, b, c] = state.topology.faces[fi];
      newFaces.push([oldToNew.get(a), oldToNew.get(b), oldToNew.get(c)]);
    });

    const boundaryEdgeCounts = new Map();
    const boundaryEdgeOrientation = new Map();
    selectedFaces.forEach((fi) => {
      const [a, b, c] = state.topology.faces[fi];
      const oriented = [[a, b], [b, c], [c, a]];
      oriented.forEach(([u, v]) => {
        const key = edgeKey(u, v);
        boundaryEdgeCounts.set(key, (boundaryEdgeCounts.get(key) || 0) + 1);
        if (!boundaryEdgeOrientation.has(key)) {
          boundaryEdgeOrientation.set(key, [u, v]);
        }
      });
    });

    boundaryEdgeCounts.forEach((count, key) => {
      if (count !== 1) return;
      const [a, b] = boundaryEdgeOrientation.get(key);
      const a2 = oldToNew.get(a);
      const b2 = oldToNew.get(b);
      newFaces.push([a, b, b2], [a, b2, a2]);
    });

    state.topology.faces.push(...newFaces);
    state.selection = new Set(oldToNew.values());
    rebuildDisplayGeometry();
    setModeLabel("extruded");
    markDirty("Selection extruded");
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
    if (state.mode === "grab" || state.mode === "scale") commitAction();
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
    if (state.mode === "grab" || state.mode === "scale") {
      commitAction();
      return;
    }
    if (evt.button !== 0) return;
    if (isSculptToolActive()) {
      beginSculptStroke(evt);
      return;
    }
    pickVertex(evt);
  }

  function onPointerMove(evt) {
    state.lastPointerClient.x = evt.clientX;
    state.lastPointerClient.y = evt.clientY;
    if (state.mode === "grab" || state.mode === "scale") {
      applyActionMove(evt.clientX, evt.clientY);
      return;
    }
    if (state.sculpt.stroke) {
      continueSculptStroke(evt);
      return;
    }
    handleSculptHover(evt);
  }

  function onPointerUp() {
    endSculptStroke();
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

    if (key === "enter" && (state.mode === "grab" || state.mode === "scale")) {
      evt.preventDefault();
      commitAction();
      return;
    }

    if (isSculptToolActive()) return;

    if (key === "g") {
      evt.preventDefault();
      if (state.selection.size > 0) startActionMode("grab", evt);
      return;
    }

    if (key === "s") {
      evt.preventDefault();
      if (state.selection.size > 0) startActionMode("scale", evt);
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
    const content = serializeTopologyToAsciiSTL(state.topology);
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
    const w = Math.max(1, viewport.clientWidth);
    const h = Math.max(1, viewport.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
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
    if (isEmptySTLBuffer(arrayBuffer)) {
      state.topology = createEmptyTopology();
      recenterCameraToTopology();
      resetSculptBrushForBounds();
      rebuildDisplayGeometry();
      setModeLabel("empty STL");
      return;
    }

    const loader = new STLLoader();
    const geometry = loader.parse(arrayBuffer);
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

  renderer.setAnimationLoop(() => {
    if (state.destroyed) return;
    controls.update();
    renderer.render(scene, camera);
    syncViewGizmo();
    overlayRenderer.render(overlayScene, overlayCamera);
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
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", onResize);
      controls.dispose();
      if (brushRing) {
        scene.remove(brushRing);
        brushRing.geometry.dispose();
        brushRing.material.dispose();
        brushRing = null;
      }
      renderer.dispose();
      overlayRenderer.dispose();
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
