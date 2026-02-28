// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/STLeditor.mjs
// STL editor with Blender-like edit shortcuts (G/E/S/F) for vertex-based mesh editing.

import * as THREE from "/lib/three/three.module.js";
import { STLLoader } from "/lib/three/STLLoader.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";

const SAVE_ENDPOINT = "/api/save";
const WELD_EPSILON = 1e-5;

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

function buildTopologyFromGeometry(geometry) {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = nonIndexed.getAttribute("position");
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
  container.innerHTML = "";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.height = "100%";
  container.style.position = "relative";
  container.tabIndex = 0;

  const state = {
    topology: null,
    selection: new Set(),
    mode: "idle", // idle | grab | scale
    actionSnapshot: null,
    maxDim: 100,
    destroyed: false,
    lastPointerClient: { x: 0, y: 0 },
  };

  const toolbar = document.createElement("div");
  toolbar.style.cssText =
    "display:flex;gap:8px;padding:6px;background:#eee;border-bottom:1px solid #ccc;align-items:center;flex-wrap:wrap;";
  container.appendChild(toolbar);

  const modeBadge = document.createElement("span");
  modeBadge.style.cssText =
    "font:12px monospace;color:#333;padding:2px 6px;border:1px solid #aaa;background:#fff;";
  modeBadge.textContent = "Mode: Idle";

  const hint = document.createElement("span");
  hint.style.cssText = "font:12px monospace;color:#555;";
  hint.textContent =
    "Click vertices (Shift=multi). G=grab, E=extrude, S=stretch, F=fill/edge.";

  const viewport = document.createElement("div");
  viewport.style.cssText = "flex:1;position:relative;min-height:0;";
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
  overlayScene.add(new THREE.AxesHelper(20));

  const overlayRenderer = new THREE.WebGLRenderer({ alpha: true });
  overlayRenderer.setSize(100, 100);
  overlayRenderer.domElement.style.cssText =
    "position:absolute;top:10px;right:10px;pointer-events:none;";
  viewport.appendChild(overlayRenderer.domElement);

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.18;
  const pointerNdc = new THREE.Vector2();

  let mesh = null;
  let edgeLines = null;
  let vertexPoints = null;
  let selectedVertexPoints = null;
  let customEdgeLines = null;

  function button(label, action) {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText =
      "padding:4px 10px;border:1px solid #999;background:#fafafa;cursor:pointer;";
    b.addEventListener("click", action);
    return b;
  }

  function setModeLabel(extra = "") {
    const suffix = extra ? ` (${extra})` : "";
    modeBadge.textContent = `Mode: ${state.mode[0].toUpperCase()}${
      state.mode.slice(1)
    }${suffix}`;
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
  }

  function commitAction() {
    state.mode = "idle";
    state.actionSnapshot = null;
    controls.enabled = true;
    setModeLabel();
  }

  function cancelAction() {
    if (!state.actionSnapshot || !state.topology) {
      commitAction();
      return;
    }
    state.topology.vertices = cloneVertices(state.actionSnapshot.startVertices);
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
      return;
    }

    const normal = new THREE.Vector3();
    selectedFaces.forEach((fi) =>
      normal.add(faceNormal(state.topology.vertices, state.topology.faces[fi]))
    );
    if (normal.lengthSq() < 1e-12) normal.set(0, 0, 1);
    normal.normalize().multiplyScalar(distance);

    const selectedFaceSet = new Set(selectedFaces);
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
    pickVertex(evt);
  }

  function onPointerMove(evt) {
    state.lastPointerClient.x = evt.clientX;
    state.lastPointerClient.y = evt.clientY;
    if (state.mode !== "grab" && state.mode !== "scale") return;
    applyActionMove(evt.clientX, evt.clientY);
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
      cancelAction();
      return;
    }

    if (key === "enter" && (state.mode === "grab" || state.mode === "scale")) {
      evt.preventDefault();
      commitAction();
      return;
    }

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
    if (!state.topology) {
      alert("No STL topology loaded.");
      return;
    }
    const content = serializeTopologyToAsciiSTL(state.topology);
    const res = await fetch(SAVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathOverride, content, encoding: "utf8" }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || `${res.status} ${res.statusText}`);
    }
  }

  function onResize() {
    const w = Math.max(1, viewport.clientWidth);
    const h = Math.max(1, viewport.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  async function loadModel() {
    const loader = new STLLoader();
    const geometry = await new Promise((resolve, reject) => {
      loader.load(notebookUrl(filePath), resolve, undefined, reject);
    });
    state.topology = buildTopologyFromGeometry(geometry);
    recenterCameraToTopology();
    rebuildDisplayGeometry();
  }

  toolbar.append(
    button("Recenter", () => {
      recenterCameraToTopology();
      setModeLabel();
    }),
    button("Clear Sel", () => {
      state.selection.clear();
      rebuildSelectionDisplay();
      setModeLabel();
    }),
    button("Save", async () => {
      try {
        await saveSTL(filePath);
        alert("STL saved successfully.");
      } catch (err) {
        console.error("[STLeditor] Save failed:", err);
        alert(`Failed to save STL: ${err.message}`);
      }
    }),
    modeBadge,
    hint,
  );

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "STLediting";
  window.saveWYSIWYGFile = async (path = filePath) => {
    await saveSTL(path);
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", onResize);

  renderer.setAnimationLoop(() => {
    if (state.destroyed) return;
    controls.update();
    renderer.render(scene, camera);
    overlayRenderer.render(overlayScene, overlayCamera);
  });

  try {
    await loadModel();
    onResize();
  } catch (err) {
    console.error("[STLeditor] Failed to load model:", err);
    container.innerHTML =
      `<em style="color:#b00020;">Failed to load STL model: ${err.message}</em>`;
  }

  return {
    destroy() {
      state.destroyed = true;
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      overlayRenderer.dispose();
      container.innerHTML = "";
    },
  };
}
