// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ModelFamilyEditor.mjs
// This file defines browser-side Model Family Editor logic for the Nodevision UI. It renders interface components and handles user interactions.
import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchArrayBuffer,
  fileExt,
  saveText,
  saveBase64,
} from "./FamilyEditorCommon.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { parseNetlist } from "/PanelInstances/ViewPanels/FileViewers/ViewCIR/parseNetlist.mjs";
import { mountWidget } from "/Widgets/WidgetHost.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";
import { exportSceneToSTL } from "/ModelExport/STLExport.mjs";

const OBJ_LIGHT_THEME = {
  panelBorder: "#d7dee8",
  viewportBackground: "#ffffff",
  sceneBackground: 0xffffff,
  gridCenter: 0x94a3b8,
  gridLine: 0xd4dbe6,
};
const OBJ_DARK_THEME = {
  panelBorder: "#2b3340",
  viewportBackground: "#0f141b",
  sceneBackground: 0x0f141b,
  gridCenter: 0x445067,
  gridLine: 0x2b3444,
};

function currentNodevisionTheme() {
  return document.documentElement?.dataset?.nvTheme === "dark" ? "dark" : "light";
}

function parseObjIndex(rawToken, vertexCount) {
  const raw = String(rawToken || "").split("/")[0];
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n === 0) return null;
  const index = n < 0 ? vertexCount + n : n - 1;
  return index >= 0 && index < vertexCount ? index : null;
}

function createObjPart(index, name = "") {
  return {
    id: `obj-part-${index}`,
    name: String(name || `Part ${index}`).trim() || `Part ${index}`,
    faces: [],
    lines: [],
    pointIndices: new Set(),
  };
}

function objPartHasGeometry(part) {
  return part.faces.length > 0 || part.lines.length > 0 || part.pointIndices.size > 0;
}

function parseObjText(source = "") {
  const vertices = [];
  const parts = [];
  let current = createObjPart(1, "Object 1");
  parts.push(current);

  const usePart = (name = "") => {
    if (!objPartHasGeometry(current)) {
      current.name = String(name || current.name).trim() || current.name;
      return current;
    }
    current = createObjPart(parts.length + 1, name || `Object ${parts.length + 1}`);
    parts.push(current);
    return current;
  };

  String(source || "").split(/\r?\n/).forEach((line) => {
    const clean = line.split("#")[0].trim();
    if (!clean) return;
    const [kind, ...values] = clean.split(/\s+/);
    if (kind === "v") {
      const point = values.slice(0, 3).map((value) => Number(value));
      if (point.length === 3 && point.every(Number.isFinite)) vertices.push(point);
      return;
    }
    if (kind === "o" || kind === "g") {
      usePart(values.join(" ") || `${kind.toUpperCase()} ${parts.length + 1}`);
      return;
    }
    if (kind === "f") {
      const indices = values.map((value) => parseObjIndex(value, vertices.length)).filter(Number.isInteger);
      if (indices.length >= 3) {
        current.faces.push(indices);
        indices.forEach((index) => current.pointIndices.add(index));
      }
      return;
    }
    if (kind === "l") {
      const indices = values.map((value) => parseObjIndex(value, vertices.length)).filter(Number.isInteger);
      if (indices.length >= 2) {
        current.lines.push(indices);
        indices.forEach((index) => current.pointIndices.add(index));
      }
    }
  });

  const visibleParts = parts.filter(objPartHasGeometry);
  if (!visibleParts.length && vertices.length) {
    const fallback = createObjPart(1, "Vertices");
    vertices.forEach((_, index) => fallback.pointIndices.add(index));
    visibleParts.push(fallback);
  }
  return { vertices, parts: visibleParts };
}

export async function createObjGraphicalPreview(host, sourceText, status, options = {}) {
  const THREE = await import("/lib/three/three.module.js");
  const { OrbitControls } = await import("/lib/three/OrbitControls.js");
  host.innerHTML = "";
  host.tabIndex = 0;
  host.style.cssText = "flex:1;min-height:360px;min-width:0;width:100%;max-width:100%;box-sizing:border-box;position:relative;overflow:hidden;background:#fff;border:1px solid #d7dee8;border-radius:8px;";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(OBJ_LIGHT_THEME.sceneBackground);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
  camera.position.set(3, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enableRotate = false;

  const orientationWidget = await mountWidget(ViewportOrientationWidget, {
    container: host,
    THREE,
    camera,
    controls,
    viewAdapter: {
      getCamera: () => camera,
      getControls: () => controls,
      getViewportElement: () => host,
      requestRender: () => {
        renderer.render(scene, camera);
        return true;
      },
    },
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.82));
  const key = new THREE.DirectionalLight(0xffffff, 1.08);
  key.position.set(6, 10, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-6, 4, -8);
  scene.add(fill);

  function disposeMaterial(material) {
    if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
    else material?.dispose?.();
  }

  function disposeObject(root) {
    root?.traverse?.((node) => {
      node.geometry?.dispose?.();
      disposeMaterial(node.material);
    });
  }

  let grid = new THREE.GridHelper(40, 40, OBJ_LIGHT_THEME.gridCenter, OBJ_LIGHT_THEME.gridLine);
  scene.add(grid);
  scene.add(new THREE.AxesHelper(2.4));

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);
  const partGroups = new Map();
  let pickTargets = [];
  let selectedIds = new Set();
  let selectionBox = null;
  let disposed = false;

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.12;
  raycaster.params.Line.threshold = 0.12;
  const pointer = new THREE.Vector2();
  const helperRoot = new THREE.Group();
  scene.add(helperRoot);
  const edgeEditRoot = new THREE.Group();
  edgeEditRoot.name = "OBJEdgeEditOverlay";
  scene.add(edgeEditRoot);
  let parsedObj = null;
  let edgeRecords = [];
  let edgePickTargets = [];
  let selectedEdgeIndex = null;
  let selectedVertexIndices = new Set();
  let grabState = null;
  let currentSourceText = String(sourceText || "");
  const lastPointerClient = { x: 0, y: 0 };

  function applyViewportTheme(theme = currentNodevisionTheme()) {
    const colors = theme === "dark" ? OBJ_DARK_THEME : OBJ_LIGHT_THEME;
    host.style.background = colors.viewportBackground;
    host.style.borderColor = colors.panelBorder;
    scene.background.set(colors.sceneBackground);
    scene.remove(grid);
    grid.geometry?.dispose?.();
    disposeMaterial(grid.material);
    grid = new THREE.GridHelper(40, 40, colors.gridCenter, colors.gridLine);
    scene.add(grid);
  }

  function frameModel() {
    const box = new THREE.Box3().setFromObject(modelRoot);
    if (box.isEmpty()) {
      camera.position.set(3, 2, 5);
      controls.target.set(0, 0, 0);
      controls.update();
      return;
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const distance = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * 1.8;
    camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
    camera.near = Math.max(distance / 1000, 0.01);
    camera.far = Math.max(distance * 100, 1000);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }

  function clearObjectChildren(root) {
    while (root.children.length) {
      const child = root.children[root.children.length - 1];
      root.remove(child);
      disposeObject(child);
    }
  }

  function rebuildSelectionHelpers() {
    clearObjectChildren(helperRoot);
    selectedIds.forEach((id) => {
      const group = partGroups.get(id);
      if (!group) return;
      helperRoot.add(new THREE.BoxHelper(group, 0xf5c542));
    });
  }

  function formatObjNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return Number(n.toFixed(6)).toString();
  }

  function objPoint(index) {
    const point = parsedObj?.vertices?.[index];
    return Array.isArray(point) ? new THREE.Vector3(Number(point[0]) || 0, Number(point[1]) || 0, Number(point[2]) || 0) : null;
  }

  function buildObjEdgeRecords(parsed) {
    const records = [];
    const seen = new Set();
    const addEdge = (a, b, partId = "") => {
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return;
      if (!parsed.vertices[a] || !parsed.vertices[b]) return;
      const key = a < b ? String(a) + ":" + String(b) : String(b) + ":" + String(a);
      if (seen.has(key)) return;
      seen.add(key);
      records.push({ a, b, partId });
    };

    parsed.parts.forEach((part) => {
      part.faces.forEach((face) => {
        for (let i = 0; i < face.length; i += 1) {
          addEdge(face[i], face[(i + 1) % face.length], part.id);
        }
      });
      part.lines.forEach((line) => {
        for (let i = 0; i < line.length - 1; i += 1) addEdge(line[i], line[i + 1], part.id);
      });
    });
    return records;
  }

  function rebuildEdgeEditOverlay() {
    clearObjectChildren(edgeEditRoot);
    edgePickTargets = [];
    edgeRecords = parsedObj ? buildObjEdgeRecords(parsedObj) : [];
    edgeRecords.forEach((edge, index) => {
      const a = objPoint(edge.a);
      const b = objPoint(edge.b);
      if (!a || !b) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
      const selected = index === selectedEdgeIndex;
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: selected ? 0xf59e0b : 0x38bdf8, transparent: true, opacity: selected ? 1 : 0.38 })
      );
      line.userData.objEdgeIndex = index;
      edgeEditRoot.add(line);
      edgePickTargets.push(line);
    });

    const selected = edgeRecords[selectedEdgeIndex];
    if (selected) {
      const a = objPoint(selected.a);
      const b = objPoint(selected.b);
      if (a && b) {
        const points = new THREE.BufferGeometry().setFromPoints([a, b]);
        const handles = new THREE.Points(points, new THREE.PointsMaterial({ color: 0xff3333, size: 0.08 }));
        handles.userData.objSelectedEdgeHandles = true;
        edgeEditRoot.add(handles);
      }
    }

    if (selectedVertexIndices.size) {
      const selectedPoints = [];
      selectedVertexIndices.forEach((index) => {
        const point = objPoint(index);
        if (point) selectedPoints.push(point);
      });
      if (selectedPoints.length) {
        const vertexGeometry = new THREE.BufferGeometry().setFromPoints(selectedPoints);
        const vertices = new THREE.Points(vertexGeometry, new THREE.PointsMaterial({ color: 0xff3333, size: 0.1 }));
        vertices.userData.objSelectedVertexHandles = true;
        edgeEditRoot.add(vertices);
      }
    }
  }

  function setSelectedEdge(index) {
    selectedEdgeIndex = Number.isInteger(index) && edgeRecords[index] ? index : null;
    const edge = edgeRecords[selectedEdgeIndex];
    selectedVertexIndices = edge ? new Set([edge.a, edge.b]) : new Set();
    if (selectedEdgeIndex !== null) selectedIds = new Set();
    rebuildSelectionHelpers();
    rebuildEdgeEditOverlay();
    status.textContent = edge ? "OBJ edge selected. Press E to extrude and grab." : "OBJ ready. Click an edge or drag to select parts.";
  }

  function selectedEdgeRecord() {
    return Number.isInteger(selectedEdgeIndex) ? edgeRecords[selectedEdgeIndex] || null : null;
  }

  function objExtrudeOffset(edge) {
    const a = objPoint(edge.a);
    const b = objPoint(edge.b);
    if (!a || !b) return new THREE.Vector3(0.2, 0.2, 0);
    const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const box = new THREE.Box3().setFromObject(modelRoot);
    const size = box.getSize(new THREE.Vector3());
    const distance = Math.max(0.05, Math.max(size.x, size.y, size.z, 1) * 0.06);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    if (right.lengthSq() < 1e-12) right.set(1, 0, 0);
    return right.normalize().multiplyScalar(distance).add(center).sub(center);
  }

  function ensureExtrusionPart(parsed) {
    let part = parsed.parts.find((entry) => entry.id === "obj-part-nodevision-extrusions");
    if (!part) {
      part = createObjPart(parsed.parts.length + 1, "Nodevision Extrusions");
      part.id = "obj-part-nodevision-extrusions";
      parsed.parts.push(part);
    }
    return part;
  }

  function appendObjExtrusion(edge, event = null) {
    if (!parsedObj || !edge) return false;
    const a = objPoint(edge.a);
    const b = objPoint(edge.b);
    if (!a || !b) return false;
    const offset = objExtrudeOffset(edge);
    const a2 = parsedObj.vertices.length;
    const b2 = a2 + 1;
    const nextA = a.clone().add(offset);
    const nextB = b.clone().add(offset);
    parsedObj.vertices.push([nextA.x, nextA.y, nextA.z], [nextB.x, nextB.y, nextB.z]);
    const part = ensureExtrusionPart(parsedObj);
    part.faces.push([edge.a, edge.b, b2, a2]);
    [edge.a, edge.b, a2, b2].forEach((index) => part.pointIndices.add(index));

    const block = "\n# Nodevision edge extrusion\n"
      + "v " + [nextA.x, nextA.y, nextA.z].map(formatObjNumber).join(" ") + "\n"
      + "v " + [nextB.x, nextB.y, nextB.z].map(formatObjNumber).join(" ") + "\n"
      + "f " + [edge.a + 1, edge.b + 1, b2 + 1, a2 + 1].join(" ") + "\n";
    currentSourceText = currentSourceText.trimEnd() + block;
    options.onSourceChange?.(currentSourceText);
    const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    setSource(currentSourceText, { selectedEdgeVertices: [a2, b2], statusText: "OBJ edge extruded. Move mouse, click/Enter to confirm." });
    startObjVertexGrab([a2, b2], event, center, new Map([[a2, a], [b2, b]]));
    return true;
  }

  function serializeObjFromParsed(parsed) {
    if (!parsed) return currentSourceText;
    const lines = ["# Nodevision OBJ mesh edit"];
    parsed.vertices.forEach((vertex) => {
      lines.push("v " + [vertex[0], vertex[1], vertex[2]].map(formatObjNumber).join(" "));
    });
    parsed.parts.forEach((part) => {
      lines.push("o " + (part.name || part.id || "Object"));
      part.faces.forEach((face) => lines.push("f " + face.map((index) => String(index + 1)).join(" ")));
      part.lines.forEach((line) => lines.push("l " + line.map((index) => String(index + 1)).join(" ")));
    });
    return lines.join("\n") + "\n";
  }

  function syncObjSourceFromParsed() {
    currentSourceText = serializeObjFromParsed(parsedObj);
    options.onSourceChange?.(currentSourceText);
  }

  function objFaceNormal(face = []) {
    const points = face.map((index) => objPoint(index)).filter(Boolean);
    if (points.length < 3) return new THREE.Vector3();
    const origin = points[0];
    for (let i = 1; i < points.length - 1; i += 1) {
      const normal = new THREE.Vector3()
        .subVectors(points[i], origin)
        .cross(new THREE.Vector3().subVectors(points[i + 1], origin));
      if (normal.lengthSq() > 1e-12) return normal.normalize();
    }
    return new THREE.Vector3();
  }

  function objCentroidForIndices(indices = []) {
    const centroid = new THREE.Vector3();
    let count = 0;
    indices.forEach((index) => {
      const point = objPoint(index);
      if (!point) return;
      centroid.add(point);
      count += 1;
    });
    if (count > 0) centroid.multiplyScalar(1 / count);
    return centroid;
  }

  function objExtrudeOffsetForIndices(indices = [], normalHint = null) {
    const box = new THREE.Box3().setFromObject(modelRoot);
    const size = box.getSize(new THREE.Vector3());
    const distance = Math.max(0.05, Math.max(size.x, size.y, size.z, 1) * 0.06);
    const direction = normalHint?.isVector3 && normalHint.lengthSq() > 1e-12
      ? normalHint.clone().normalize()
      : new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    if (direction.lengthSq() < 1e-12) direction.set(1, 0, 0);
    return direction.normalize().multiplyScalar(distance);
  }

  function appendObjFaceExtrusion(event = null) {
    if (!parsedObj || selectedIds.size === 0) return false;
    const selectedPartIds = new Set(selectedIds);
    const sourceFaces = [];
    parsedObj.parts.forEach((part) => {
      if (!selectedPartIds.has(part.id)) return;
      part.faces.forEach((face) => {
        if (Array.isArray(face) && face.length >= 3) sourceFaces.push(face);
      });
    });
    if (!sourceFaces.length) {
      status.textContent = "Select an OBJ face or edge first.";
      return false;
    }

    const sourceSet = new Set();
    const normal = new THREE.Vector3();
    sourceFaces.forEach((face) => {
      face.forEach((index) => sourceSet.add(index));
      normal.add(objFaceNormal(face));
    });
    const sourceIndices = Array.from(sourceSet).filter((index) => objPoint(index));
    if (sourceIndices.length < 3) return false;

    const offset = objExtrudeOffsetForIndices(sourceIndices, normal);
    const centroid = objCentroidForIndices(sourceIndices);
    const oldToNew = new Map();
    const startOverrides = new Map();
    sourceIndices.forEach((index) => {
      const source = objPoint(index);
      const next = source.clone().add(offset);
      const newIndex = parsedObj.vertices.length;
      parsedObj.vertices.push([next.x, next.y, next.z]);
      oldToNew.set(index, newIndex);
      startOverrides.set(newIndex, source);
    });

    const part = ensureExtrusionPart(parsedObj);
    sourceFaces.forEach((face) => {
      const duplicate = face.map((index) => oldToNew.get(index));
      if (duplicate.every(Number.isInteger)) part.faces.push(duplicate);
    });

    const boundaryCounts = new Map();
    const boundaryOrientation = new Map();
    sourceFaces.forEach((face) => {
      for (let i = 0; i < face.length; i += 1) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        const key = a < b ? String(a) + ":" + String(b) : String(b) + ":" + String(a);
        boundaryCounts.set(key, (boundaryCounts.get(key) || 0) + 1);
        if (!boundaryOrientation.has(key)) boundaryOrientation.set(key, [a, b]);
      }
    });
    boundaryCounts.forEach((count, key) => {
      if (count !== 1) return;
      const [a, b] = boundaryOrientation.get(key);
      const a2 = oldToNew.get(a);
      const b2 = oldToNew.get(b);
      if (Number.isInteger(a2) && Number.isInteger(b2)) part.faces.push([a, b, b2, a2]);
    });

    sourceIndices.forEach((index) => part.pointIndices.add(index));
    Array.from(oldToNew.values()).forEach((index) => part.pointIndices.add(index));
    currentSourceText = serializeObjFromParsed(parsedObj);
    options.onSourceChange?.(currentSourceText);
    const newIndices = Array.from(oldToNew.values());
    setSource(currentSourceText, { selectedVertexIndices: newIndices, statusText: "OBJ face extruded. Move mouse, click/Enter to confirm." });
    startObjVertexGrab(newIndices, event, centroid, startOverrides);
    return true;
  }

  function startObjVertexGrab(indices = [], event = null, centroidOverride = null, startOverrides = null) {
    const unique = Array.from(new Set(indices.filter((index) => Number.isInteger(index) && objPoint(index))));
    if (!parsedObj || !unique.length) return false;
    const rect = renderer.domElement.getBoundingClientRect();
    const overrides = startOverrides instanceof Map ? startOverrides : new Map();
    const entries = unique.map((index) => ({
      index,
      start: (overrides.get(index) || objPoint(index)).clone(),
    }));
    const centroid = centroidOverride?.isVector3 ? centroidOverride.clone() : objCentroidForIndices(unique);
    selectedVertexIndices = new Set(unique);
    rebuildEdgeEditOverlay();
    grabState = {
      type: "vertices",
      entries,
      startMouse: new THREE.Vector2(Number.isFinite(event?.clientX) ? event.clientX : lastPointerClient.x || rect.left + rect.width * 0.5, Number.isFinite(event?.clientY) ? event.clientY : lastPointerClient.y || rect.top + rect.height * 0.5),
      centroid,
    };
    controls.enabled = false;
    status.textContent = "OBJ grab: move mouse, click/Enter to confirm, Esc to cancel.";
    return true;
  }

  function startObjEdgeGrab(event = null) {
    const edge = selectedEdgeRecord();
    return edge ? startObjVertexGrab([edge.a, edge.b], event) : false;
  }

  function updateObjEdgeGrab(event) {
    if (!grabState || !parsedObj) return false;
    const rect = renderer.domElement.getBoundingClientRect();
    const start = new THREE.Vector2(((grabState.startMouse.x - rect.left) / Math.max(rect.width, 1)) * 2 - 1, -(((grabState.startMouse.y - rect.top) / Math.max(rect.height, 1)) * 2 - 1));
    const end = new THREE.Vector2(((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1, -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1));
    const cameraDir = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, grabState.centroid);
    const startRay = new THREE.Raycaster();
    const endRay = new THREE.Raycaster();
    startRay.setFromCamera(start, camera);
    endRay.setFromCamera(end, camera);
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    if (!startRay.ray.intersectPlane(plane, p0) || !endRay.ray.intersectPlane(plane, p1)) return false;
    const delta = new THREE.Vector3().subVectors(p1, p0);
    grabState.entries.forEach((entry) => {
      const next = entry.start.clone().add(delta);
      parsedObj.vertices[entry.index] = [next.x, next.y, next.z];
    });
    rebuildObjDisplayFromParsed();
    return true;
  }

  function finishObjEdgeGrab(cancel = false) {
    if (!grabState) return false;
    const snap = grabState;
    grabState = null;
    controls.enabled = true;
    if (cancel && parsedObj) {
      snap.entries.forEach((entry) => {
        parsedObj.vertices[entry.index] = [entry.start.x, entry.start.y, entry.start.z];
      });
      rebuildObjDisplayFromParsed();
      syncObjSourceFromParsed();
      status.textContent = "OBJ grab canceled.";
      return true;
    }
    syncObjSourceFromParsed();
    status.textContent = "OBJ grab confirmed.";
    return true;
  }

  function setSelection(ids = [], additive = false) {
    selectedEdgeIndex = null;
    selectedVertexIndices = new Set();
    const next = additive ? new Set(selectedIds) : new Set();
    ids.forEach((id) => {
      if (partGroups.has(id)) next.add(id);
    });
    selectedIds = next;
    rebuildSelectionHelpers();
    rebuildEdgeEditOverlay();
    const count = selectedIds.size;
    status.textContent = count ? `OBJ selected: ${count} part(s).` : "OBJ ready. Click or drag in the viewport to select parts.";
  }

  function createPartGroup(part, vertices) {
    const partGroup = new THREE.Group();
    partGroup.name = part.name;
    partGroup.userData.objPartId = part.id;
    partGroup.userData.objPartName = part.name;

    const triangles = [];
    part.faces.forEach((face) => {
      for (let i = 1; i < face.length - 1; i += 1) {
        [face[0], face[i], face[i + 1]].forEach((index) => {
          const vertex = vertices[index];
          if (vertex) triangles.push(vertex[0], vertex[1], vertex[2]);
        });
      }
    });

    if (triangles.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(triangles, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8fb7ff, roughness: 0.72, metalness: 0.04, transparent: true, opacity: 0.94, side: THREE.DoubleSide }));
      mesh.userData.objPartId = part.id;
      partGroup.add(mesh);
      pickTargets.push(mesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.72 }));
      edges.userData.objPartId = part.id;
      partGroup.add(edges);
    }

    const linePositions = [];
    part.lines.forEach((line) => {
      for (let i = 0; i < line.length - 1; i += 1) {
        [line[i], line[i + 1]].forEach((index) => {
          const vertex = vertices[index];
          if (vertex) linePositions.push(vertex[0], vertex[1], vertex[2]);
        });
      }
    });
    if (linePositions.length) {
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
      const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: 0x0f766e }));
      lines.userData.objPartId = part.id;
      partGroup.add(lines);
      pickTargets.push(lines);
    }

    if (!triangles.length && !linePositions.length && part.pointIndices.size) {
      const points = [];
      part.pointIndices.forEach((index) => {
        const vertex = vertices[index];
        if (vertex) points.push(vertex[0], vertex[1], vertex[2]);
      });
      const pointGeometry = new THREE.BufferGeometry();
      pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
      const pointCloud = new THREE.Points(pointGeometry, new THREE.PointsMaterial({ color: 0xf59e0b, size: 0.06 }));
      pointCloud.userData.objPartId = part.id;
      partGroup.add(pointCloud);
      pickTargets.push(pointCloud);
    }

    return partGroup;
  }

  function rebuildObjDisplayFromParsed({ frame = false } = {}) {
    clearObjectChildren(modelRoot);
    clearObjectChildren(helperRoot);
    partGroups.clear();
    pickTargets = [];
    selectedIds = new Set();
    if (!parsedObj) return;
    parsedObj.parts.forEach((part) => {
      const partGroup = createPartGroup(part, parsedObj.vertices);
      if (!partGroup.children.length) return;
      partGroups.set(part.id, partGroup);
      modelRoot.add(partGroup);
    });
    if (frame) frameModel();
    rebuildSelectionHelpers();
    rebuildEdgeEditOverlay();
  }

  function selectEdgeByVertices(vertices = []) {
    if (!Array.isArray(vertices) || vertices.length !== 2) return false;
    const [a, b] = vertices;
    const match = edgeRecords.findIndex((edge) => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a));
    if (match < 0) return false;
    setSelectedEdge(match);
    return true;
  }

  function setSource(nextSource, setOptions = {}) {
    currentSourceText = String(nextSource || "");
    parsedObj = parseObjText(currentSourceText);
    selectedEdgeIndex = null;
    rebuildObjDisplayFromParsed({ frame: true });
    if (setOptions.selectedEdgeVertices) selectEdgeByVertices(setOptions.selectedEdgeVertices);
    if (Array.isArray(setOptions.selectedVertexIndices)) {
      selectedEdgeIndex = null;
      selectedVertexIndices = new Set(setOptions.selectedVertexIndices.filter(Number.isInteger));
      rebuildEdgeEditOverlay();
    }
    status.textContent = setOptions.statusText || ("OBJ graphical preview: " + partGroups.size + " part(s), " + parsedObj.vertices.length + " vertices. Click edge: select | E: extrude | G: grab.");
  }

  function setPointerFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  }

  function pickEdge(event) {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(edgePickTargets, false);
    const edgeIndex = hits[0]?.object?.userData?.objEdgeIndex;
    if (!Number.isInteger(edgeIndex)) return false;
    setSelectedEdge(edgeIndex);
    return true;
  }

  function pickPart(event) {
    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickTargets, false);
    const id = hits[0]?.object?.userData?.objPartId || null;
    if (id) setSelection([id], event.shiftKey || event.ctrlKey || event.metaKey);
    else if (!(event.shiftKey || event.ctrlKey || event.metaKey)) setSelection([]);
  }

  function ensureSelectionBoxElement() {
    if (selectionBox?.el) return selectionBox.el;
    const el = document.createElement("div");
    Object.assign(el.style, { position: "fixed", border: "1px solid #f59e0b", background: "rgba(245,158,11,0.14)", pointerEvents: "none", zIndex: "10000", display: "none" });
    document.body.appendChild(el);
    if (selectionBox) selectionBox.el = el;
    return el;
  }

  function updateSelectionBoxElement() {
    if (!selectionBox) return;
    const el = ensureSelectionBoxElement();
    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const width = Math.abs(selectionBox.currentX - selectionBox.startX);
    const height = Math.abs(selectionBox.currentY - selectionBox.startY);
    selectionBox.moved = selectionBox.moved || width > 4 || height > 4;
    Object.assign(el.style, { display: selectionBox.moved ? "block" : "none", left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  }

  function startSelectionBox(event) {
    selectionBox = { startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY, moved: false, shiftKey: event.shiftKey || event.ctrlKey || event.metaKey, el: null };
    updateSelectionBoxElement();
  }

  function updateSelectionBox(event) {
    if (!selectionBox) return false;
    selectionBox.currentX = event.clientX;
    selectionBox.currentY = event.clientY;
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
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let hasPoint = false;
    camera.updateMatrixWorld?.();
    points.forEach((sourcePoint) => {
      const point = sourcePoint.clone().project(camera);
      if (point.z < -1 || point.z > 1) return;
      const x = rect.left + (point.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-point.y * 0.5 + 0.5) * rect.height;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      hasPoint = true;
    });
    return hasPoint ? { left, right, top, bottom } : null;
  }

  function selectPartsInBox(box) {
    const selectionRect = { left: Math.min(box.startX, box.currentX), right: Math.max(box.startX, box.currentX), top: Math.min(box.startY, box.currentY), bottom: Math.max(box.startY, box.currentY) };
    const ids = [];
    partGroups.forEach((partGroup, id) => {
      const bounds = screenBoundsForObject(partGroup);
      if (bounds && rectsIntersect(selectionRect, bounds)) ids.push(id);
    });
    setSelection(ids, box.shiftKey);
  }

  function finishSelectionBox(event) {
    if (!selectionBox) return false;
    selectionBox.currentX = event.clientX;
    selectionBox.currentY = event.clientY;
    updateSelectionBoxElement();
    const box = selectionBox;
    const moved = box.moved;
    if (moved) selectPartsInBox(box);
    box.el?.remove?.();
    selectionBox = null;
    if (!moved && !pickEdge(event)) pickPart(event);
    return true;
  }

  function onPointerDown(event) {
    host.focus?.();
    lastPointerClient.x = event.clientX;
    lastPointerClient.y = event.clientY;
    if (grabState) {
      event.preventDefault();
      finishObjEdgeGrab(false);
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    startSelectionBox(event);
  }

  function onPointerMove(event) {
    lastPointerClient.x = event.clientX;
    lastPointerClient.y = event.clientY;
    if (grabState) {
      updateObjEdgeGrab(event);
      return;
    }
    updateSelectionBox(event);
  }

  function onPointerUp(event) {
    if (grabState) return;
    finishSelectionBox(event);
  }

  function onKeyDown(event) {
    const active = document.activeElement;
    if (active !== host && !host.contains(active)) return;
    if (["input", "textarea", "select"].includes(active?.tagName?.toLowerCase?.())) return;
    const key = String(event.key || "").toLowerCase();
    if (key === "escape" && grabState) {
      event.preventDefault();
      finishObjEdgeGrab(true);
      return;
    }
    if (key === "enter" && grabState) {
      event.preventDefault();
      finishObjEdgeGrab(false);
      return;
    }
    if (key === "e") {
      const edge = selectedEdgeRecord();
      if (!edge && selectedIds.size === 0) return;
      event.preventDefault();
      if (edge) appendObjExtrusion(edge, event);
      else appendObjFaceExtrusion(event);
      return;
    }
    if (key === "g") {
      if (!selectedEdgeRecord() && selectedVertexIndices.size === 0) return;
      event.preventDefault();
      if (selectedVertexIndices.size) startObjVertexGrab(Array.from(selectedVertexIndices), event);
      else startObjEdgeGrab(event);
    }
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, rect.width || host.clientWidth || 1);
    const height = Math.max(1, rect.height || host.clientHeight || 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function animate() {
    if (disposed) return;
    helperRoot.children.forEach((helper) => helper.update?.());
    controls.update();
    renderer.render(scene, camera);
    orientationWidget?.sync?.();
  }

  const onThemeChanged = (event) => applyViewportTheme(event?.detail?.theme || currentNodevisionTheme());
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("nv-theme-changed", onThemeChanged);

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(host);
  } else {
    window.addEventListener("resize", resize);
  }

  applyViewportTheme();
  setSource(sourceText);
  resize();
  renderer.setAnimationLoop(animate);

  return {
    setSource,
    exportSTL(pathValue = "model.obj") {
      exportSceneToSTL(modelRoot, pathValue);
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("nv-theme-changed", onThemeChanged);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", resize);
      selectionBox?.el?.remove?.();
      selectionBox = null;
      orientationWidget?.destroy?.();
      controls.dispose?.();
      clearObjectChildren(modelRoot);
      clearObjectChildren(helperRoot);
      clearObjectChildren(edgeEditRoot);
      renderer.dispose?.();
      host.innerHTML = "";
    },
  };
}

function detectText(bytes) {
  if (!bytes || bytes.length === 0) return true;
  let suspicious = 0;
  const sampleLen = Math.min(bytes.length, 4096);
  for (let i = 0; i < sampleLen; i += 1) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 7 || (b > 14 && b < 32)) suspicious += 1;
  }
  return suspicious / sampleLen < 0.15;
}

function buildCircuitSVG(components = []) {
  const width = 640;
  const rowHeight = 90;
  const height = Math.max(200, components.length * rowHeight + 40);
  const xLeft = 50;
  const xRight = width - 50;
  const xCenter = (xLeft + xRight) / 2;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.background = "#fafafa";

  components.forEach((comp, idx) => {
    const y = 50 + idx * rowHeight;
    const group = document.createElementNS(svgNS, "g");

    const nodeLeft = document.createElementNS(svgNS, "circle");
    nodeLeft.setAttribute("cx", xLeft);
    nodeLeft.setAttribute("cy", y);
    nodeLeft.setAttribute("r", 4);
    nodeLeft.setAttribute("fill", "#333");

    const nodeRight = document.createElementNS(svgNS, "circle");
    nodeRight.setAttribute("cx", xRight);
    nodeRight.setAttribute("cy", y);
    nodeRight.setAttribute("r", 4);
    nodeRight.setAttribute("fill", "#333");

    const wireLeft = document.createElementNS(svgNS, "line");
    wireLeft.setAttribute("x1", xLeft);
    wireLeft.setAttribute("y1", y);
    wireLeft.setAttribute("x2", xCenter - 30);
    wireLeft.setAttribute("y2", y);
    wireLeft.setAttribute("stroke", "#444");
    wireLeft.setAttribute("stroke-width", "2");

    const wireRight = document.createElementNS(svgNS, "line");
    wireRight.setAttribute("x1", xCenter + 30);
    wireRight.setAttribute("y1", y);
    wireRight.setAttribute("x2", xRight);
    wireRight.setAttribute("y2", y);
    wireRight.setAttribute("stroke", "#444");
    wireRight.setAttribute("stroke-width", "2");

    const symbolGroup = document.createElementNS(svgNS, "g");
    const type = (comp.type || "").toUpperCase();

    if (type === "V") {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", xCenter);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 20);
      circle.setAttribute("fill", "#fff");
      circle.setAttribute("stroke", "#1f6feb");
      circle.setAttribute("stroke-width", "2.5");

      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", xCenter);
      text.setAttribute("y", y + 5);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "16");
      text.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
      text.setAttribute("fill", "#1f6feb");
      text.textContent = "V";

      symbolGroup.appendChild(circle);
      symbolGroup.appendChild(text);
    } else if (type === "R") {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", xCenter - 28);
      rect.setAttribute("y", y - 12);
      rect.setAttribute("width", 56);
      rect.setAttribute("height", 24);
      rect.setAttribute("rx", 4);
      rect.setAttribute("fill", "#fff");
      rect.setAttribute("stroke", "#f97316");
      rect.setAttribute("stroke-width", "2.5");
      symbolGroup.appendChild(rect);
    } else if (type === "C") {
      const plate1 = document.createElementNS(svgNS, "line");
      plate1.setAttribute("x1", xCenter - 12);
      plate1.setAttribute("y1", y - 16);
      plate1.setAttribute("x2", xCenter - 12);
      plate1.setAttribute("y2", y + 16);
      plate1.setAttribute("stroke", "#0f172a");
      plate1.setAttribute("stroke-width", "2.5");

      const plate2 = document.createElementNS(svgNS, "line");
      plate2.setAttribute("x1", xCenter + 12);
      plate2.setAttribute("y1", y - 16);
      plate2.setAttribute("x2", xCenter + 12);
      plate2.setAttribute("y2", y + 16);
      plate2.setAttribute("stroke", "#0f172a");
      plate2.setAttribute("stroke-width", "2.5");

      symbolGroup.appendChild(plate1);
      symbolGroup.appendChild(plate2);
    } else {
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", xCenter - 24);
      rect.setAttribute("y", y - 10);
      rect.setAttribute("width", 48);
      rect.setAttribute("height", 20);
      rect.setAttribute("rx", 3);
      rect.setAttribute("fill", "#fff");
      rect.setAttribute("stroke", "#111");
      rect.setAttribute("stroke-width", "2");
      symbolGroup.appendChild(rect);
    }

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", xCenter);
    label.setAttribute("y", y - 28);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12");
    label.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
    label.setAttribute("fill", "#111");
    label.textContent = `${type}${comp.name || ""}`;

    const leftNodeLabel = document.createElementNS(svgNS, "text");
    leftNodeLabel.setAttribute("x", xLeft - 4);
    leftNodeLabel.setAttribute("y", y + 16);
    leftNodeLabel.setAttribute("text-anchor", "end");
    leftNodeLabel.setAttribute("font-size", "11");
    leftNodeLabel.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
    leftNodeLabel.setAttribute("fill", "#444");
    leftNodeLabel.textContent = comp.nodes?.[0] || "";

    const rightNodeLabel = document.createElementNS(svgNS, "text");
    rightNodeLabel.setAttribute("x", xRight + 4);
    rightNodeLabel.setAttribute("y", y + 16);
    rightNodeLabel.setAttribute("text-anchor", "start");
    rightNodeLabel.setAttribute("font-size", "11");
    rightNodeLabel.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
    rightNodeLabel.setAttribute("fill", "#444");
    rightNodeLabel.textContent = comp.nodes?.[1] || "";

    group.appendChild(wireLeft);
    group.appendChild(wireRight);
    group.appendChild(symbolGroup);
    group.appendChild(nodeLeft);
    group.appendChild(nodeRight);
    group.appendChild(label);
    group.appendChild(leftNodeLabel);
    group.appendChild(rightNodeLabel);

    svg.appendChild(group);
  });

  return svg;
}

const CIR_ELEMENT_LIBRARY = [
  { key: "cirInsertResistor", type: "R", label: "Resistor", prefix: "R", defaultValue: "1k", terminals: 2, color: "#f97316" },
  { key: "cirInsertCapacitor", type: "C", label: "Capacitor", prefix: "C", defaultValue: "10u", terminals: 2, color: "#0ea5e9" },
  { key: "cirInsertInductor", type: "L", label: "Inductor", prefix: "L", defaultValue: "1m", terminals: 2, color: "#7c3aed" },
  { key: "cirInsertVoltageSource", type: "V", label: "Voltage Source", prefix: "V", defaultValue: "DC 5", terminals: 2, color: "#1f6feb" },
  { key: "cirInsertCurrentSource", type: "I", label: "Current Source", prefix: "I", defaultValue: "1mA", terminals: 2, color: "#16a34a" },
  { key: "cirInsertDiode", type: "D", label: "Diode", prefix: "D", defaultValue: "1N4148", terminals: 2, color: "#b91c1c" },
  { key: "cirInsertNPN", type: "Q", label: "BJT NPN", prefix: "Q", defaultValue: "NPN", terminals: 3, color: "#f59e0b" },
  { key: "cirInsertPNP", type: "Q", label: "BJT PNP", prefix: "Q", defaultValue: "PNP", terminals: 3, color: "#f59e0b" },
  { key: "cirInsertNMOS", type: "M", label: "NMOS", prefix: "M", defaultValue: "NMOS L=1u W=10u", terminals: 4, color: "#0f172a" },
  { key: "cirInsertPMOS", type: "M", label: "PMOS", prefix: "M", defaultValue: "PMOS L=1u W=10u", terminals: 4, color: "#0f172a" },
  { key: "cirInsertOpAmp", type: "X", label: "Op Amp", prefix: "X", defaultValue: "opamp_model", terminals: 3, color: "#2563eb" },
  { key: "cirInsertGround", type: "GND", label: "Ground", prefix: "GND", defaultValue: "0", terminals: 1, color: "#111827", isGround: true },
];

const TERMINAL_LAYOUTS = {
  1: [{ x: 0, y: 20 }],
  2: [
    { x: -32, y: 0 },
    { x: 32, y: 0 },
  ],
  3: [
    { x: -32, y: -16 },
    { x: -32, y: 16 },
    { x: 32, y: 0 },
  ],
  4: [
    { x: -32, y: -18 },
    { x: -32, y: 18 },
    { x: 32, y: -18 },
    { x: 32, y: 18 },
  ],
};

function terminalLayout(count = 2) {
  return (TERMINAL_LAYOUTS[count] || TERMINAL_LAYOUTS[2]).map((p) => ({ ...p }));
}

function normalizeNetName(name = "") {
  const trimmed = String(name).trim();
  if (!trimmed) return "n";
  if (trimmed.toLowerCase() === "gnd") return "0";
  return trimmed;
}

function buildStateFromNetlist(text = "") {
  const { components } = parseNetlist(text);
  const state = {
    components: [],
    nets: new Map(), // netName -> Set of { compId, terminal }
    counters: {},
  };

  const getCount = (prefix) => {
    state.counters[prefix] = (state.counters[prefix] || 0) + 1;
    return state.counters[prefix];
  };

  components.forEach((comp, idx) => {
    const library = CIR_ELEMENT_LIBRARY.find((e) => e.type === comp.type) || {
      prefix: comp.type,
      type: comp.type,
      terminals: comp.nodes?.length || 2,
      defaultValue: comp.value || comp.model || "",
      color: "#111827",
    };

    const id = comp.name || `${library.prefix}${getCount(library.prefix)}`;
    const terminals = terminalLayout(library.terminals || comp.nodes?.length || 2);

    const x = 140 + (idx % 4) * 160;
    const y = 120 + Math.floor(idx / 4) * 140;

    const nodes = [...(comp.nodes || [])];
    while (nodes.length < terminals.length) nodes.push(`n${getCount("n")}`);

    const element = {
      id,
      type: library.type,
      label: library.label || library.type,
      value: comp.value || comp.model || library.defaultValue || "",
      nodes,
      x,
      y,
      rotation: 0,
      color: library.color || "#111827",
      terminals: terminals.length,
    };

    state.components.push(element);

    element.nodes.forEach((netName, termIdx) => {
      const net = normalizeNetName(netName);
      const entry = state.nets.get(net) || new Set();
      entry.add(`${element.id}:${termIdx}`);
      state.nets.set(net, entry);
    });
  });

  if (!state.nets.has("0")) {
    state.nets.set("0", new Set());
  }

  return state;
}

function nextNetName(state) {
  state.counters.net = (state.counters.net || 0) + 1;
  return `n${state.counters.net}`;
}

function ensureComponentIds(state) {
  const used = new Set(state.components.map((c) => c.id));
  const counters = {};
  state.components.forEach((c) => {
    if (!c.id) {
      counters[c.type] = (counters[c.type] || 0) + 1;
      let candidate = `${c.type}${counters[c.type]}`;
      while (used.has(candidate)) {
        counters[c.type] += 1;
        candidate = `${c.type}${counters[c.type]}`;
      }
      c.id = candidate;
      used.add(candidate);
    }
  });
}

function generateNetlist(state) {
  ensureComponentIds(state);
  const lines = [];

  for (const comp of state.components) {
    if (comp.type === "GND") continue;
    const nodes = (comp.nodes || []).slice(0, comp.terminals || 2);
    const value = comp.value || "";
    const name = comp.id || `${comp.type}?`;
    const joinedNodes = nodes.join(" ");

    if (["R", "L", "C"].includes(comp.type)) {
      lines.push(`${name} ${joinedNodes} ${value || "1"}`);
    } else if (["V", "I"].includes(comp.type)) {
      lines.push(`${name} ${joinedNodes} ${value || "DC 0"}`);
    } else if (["D", "Q", "M", "X"].includes(comp.type)) {
      const model = value || "MODEL";
      lines.push(`${name} ${joinedNodes} ${model}`);
    } else {
      lines.push(`${name} ${joinedNodes} ${value}`.trim());
    }
  }

  return lines.join("\n");
}

function renderCanvasEditor(root, state, status, textarea, renderPreview) {
  root.innerHTML = "";

  const layout = document.createElement("div");
  layout.style.cssText = "display:flex;gap:12px;align-items:flex-start;min-height:360px;";

  const palette = document.createElement("div");
  palette.style.cssText = "width:200px;display:flex;flex-direction:column;gap:8px;";
  const paletteTitle = document.createElement("div");
  paletteTitle.textContent = "Palette";
  paletteTitle.style.cssText = "font:12px monospace;color:#222;";
  palette.appendChild(paletteTitle);

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Filter components";
  search.style.cssText = "padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font:12px monospace;";
  palette.appendChild(search);

  const paletteList = document.createElement("div");
  paletteList.style.cssText = "display:grid;grid-template-columns:1fr;gap:6px;max-height:480px;overflow:auto;";
  palette.appendChild(paletteList);

  const canvasWrapper = document.createElement("div");
  canvasWrapper.style.cssText = [
    "flex:1",
    "min-height:360px",
    "border:1px solid #cbd5e1",
    "border-radius:10px",
    "background:linear-gradient(90deg, #f8fafc 24px, transparent 24px), linear-gradient(#f8fafc 24px, transparent 24px), linear-gradient(90deg, #e2e8f0 25px, transparent 26px), linear-gradient(#e2e8f0 25px, transparent 26px)",
    "background-size:48px 48px, 48px 48px, 48px 48px, 48px 48px",
    "background-position:-1px -1px, -1px -1px, -1px -1px, -1px -1px",
    "position:relative",
    "overflow:auto",
    "padding:24px",
    "box-sizing:border-box",
  ].join(";");

  const netLegend = document.createElement("div");
  netLegend.style.cssText = "width:220px;display:flex;flex-direction:column;gap:8px;";
  const legendTitle = document.createElement("div");
  legendTitle.textContent = "Nets";
  legendTitle.style.cssText = "font:12px monospace;color:#222;";
  netLegend.appendChild(legendTitle);

  const netsList = document.createElement("div");
  netsList.style.cssText = "display:flex;flex-direction:column;gap:4px;max-height:420px;overflow:auto;font:12px monospace;";
  netLegend.appendChild(netsList);

  layout.appendChild(palette);
  layout.appendChild(canvasWrapper);
  layout.appendChild(netLegend);
  root.appendChild(layout);

  const selection = new Set();
  let dragging = null;

  const addElement = (entry) => {
    if (!entry) return;
    const counters = state.counters;
    counters[entry.prefix] = (counters[entry.prefix] || 0) + 1;
    const id = `${entry.prefix}${counters[entry.prefix]}`;
    const posX = 120 + (state.components.length % 3) * 180;
    const posY = 120 + Math.floor(state.components.length / 3) * 140;
    const nodes = terminalLayout(entry.terminals).map(() => nextNetName(state));
    const element = {
      id,
      type: entry.type,
      label: entry.label,
      value: entry.defaultValue,
      nodes,
      x: posX,
      y: posY,
      rotation: 0,
      color: entry.color,
      terminals: entry.terminals,
    };

    state.components.push(element);
    nodes.forEach((net, termIdx) => {
      const n = normalizeNetName(net);
      const set = state.nets.get(n) || new Set();
      set.add(`${id}:${termIdx}`);
      state.nets.set(n, set);
    });

    renderCanvas();
    renderNets();
    syncTextarea();
  };

  const renderNets = () => {
    netsList.innerHTML = "";
    [...state.nets.keys()].sort().forEach((net) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;";
      const label = document.createElement("span");
      label.textContent = net === "0" ? "0 (GND)" : net;
      row.appendChild(label);
      netsList.appendChild(row);
    });
  };

  const syncTextarea = () => {
    const netlist = generateNetlist(state);
    textarea.value = netlist;
    renderPreview(netlist);
    status.textContent = "Canvas updated -> netlist";
  };

  const renderPalette = () => {
    const query = search.value.trim().toLowerCase();
    paletteList.innerHTML = "";
    CIR_ELEMENT_LIBRARY.filter((e) => !query || e.label.toLowerCase().includes(query)).forEach((entry) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${entry.label} (${entry.type})`;
      btn.style.cssText = [
        "display:flex",
        "justify-content:space-between",
        "align-items:center",
        "gap:6px",
        "padding:8px 10px",
        "border:1px solid #cbd5e1",
        "border-radius:8px",
        "background:#fff",
        "cursor:grab",
        "font:12px monospace",
        `color:${entry.color}`,
      ].join(";");

      btn.addEventListener("click", () => addElement(entry));

      paletteList.appendChild(btn);
    });
  };

  function renderCanvas() {
    canvasWrapper.innerHTML = "";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "2000");
    svg.setAttribute("height", "1200");
    svg.style.pointerEvents = "none";
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.overflow = "visible";
    canvasWrapper.appendChild(svg);

    const drawTerminalDot = (x, y, color = "#111") => {
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", color);
      svg.appendChild(dot);
    };

    const drawWire = (start, end, highlight = false) => {
      const path = document.createElementNS(svgNS, "path");
      const midX = (start.x + end.x) / 2;
      const d = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      path.setAttribute("d", d);
      path.setAttribute("stroke", highlight ? "#ef4444" : "#0f172a");
      path.setAttribute("stroke-width", highlight ? "3" : "2");
      path.setAttribute("fill", "none");
      svg.appendChild(path);
    };

    const cardLayer = document.createElement("div");
    cardLayer.style.position = "relative";
    cardLayer.style.width = "100%";
    cardLayer.style.height = "100%";
    canvasWrapper.appendChild(cardLayer);

    // Wires
    state.components.forEach((comp) => {
      const layout = terminalLayout(comp.terminals || 2);
      comp.nodes.forEach((net, idx) => {
        const netName = normalizeNetName(net);
        const peers = [...(state.nets.get(netName) || [])];
        peers.forEach((peer) => {
          const [peerId, peerTerm] = peer.split(":");
          if (peerId === comp.id) return;
          const peerComp = state.components.find((c) => c.id === peerId);
          if (!peerComp) return;
          const peerLayout = terminalLayout(peerComp.terminals || 2);
          const pPos = {
            x: peerComp.x + peerLayout[peerTerm]?.x || 0,
            y: peerComp.y + peerLayout[peerTerm]?.y || 0,
          };
          const cPos = {
            x: comp.x + layout[idx]?.x || 0,
            y: comp.y + layout[idx]?.y || 0,
          };
          const idKey = [comp.id, peerId].sort().join("::") + `:${idx}:${peerTerm}`;
          if (!svg.__drawnPaths) svg.__drawnPaths = new Set();
          if (svg.__drawnPaths.has(idKey)) return;
          svg.__drawnPaths.add(idKey);
          drawWire(cPos, pPos, selection.has(comp.id) || selection.has(peerId));
        });
      });
    });

    // Components
    state.components.forEach((comp) => {
      const card = document.createElement("div");
      card.style.cssText = [
        "position:absolute",
        `left:${comp.x - 60}px`,
        `top:${comp.y - 40}px`,
        "width:120px",
        "height:80px",
        "border:1px solid #cbd5e1",
        "border-radius:10px",
        "background:#fff",
        "box-shadow:0 4px 12px rgba(15,23,42,0.08)",
        "padding:8px",
        "box-sizing:border-box",
        "cursor:grab",
        `border-color:${selection.has(comp.id) ? "#ef4444" : "#cbd5e1"}`,
      ].join(";");

      const title = document.createElement("div");
      title.textContent = `${comp.id} (${comp.type})`;
      title.style.cssText = `font:12px monospace;color:${comp.color};margin-bottom:6px;`;

      const valueInput = document.createElement("input");
      valueInput.type = "text";
      valueInput.value = comp.value || "";
      valueInput.style.cssText = "width:100%;font:12px monospace;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;";
      valueInput.addEventListener("input", () => {
        comp.value = valueInput.value;
        syncTextarea();
      });

      const netWrap = document.createElement("div");
      netWrap.style.cssText = "margin-top:6px;display:flex;flex-direction:column;gap:4px;";

      comp.nodes.forEach((net, idx) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:6px;font:11px monospace;";
        const lbl = document.createElement("span");
        lbl.textContent = `n${idx+1}`;
        lbl.style.minWidth = "28px";
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = net;
        inp.style.cssText = "flex:1;font:11px monospace;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;";
        inp.addEventListener("input", () => {
          const oldNet = normalizeNetName(comp.nodes[idx]);
          comp.nodes[idx] = inp.value;
          const newNet = normalizeNetName(inp.value);
          if (oldNet !== newNet) {
            const oldSet = state.nets.get(oldNet);
            if (oldSet) {
              oldSet.delete(`${comp.id}:${idx}`);
            }
            const set = state.nets.get(newNet) || new Set();
            set.add(`${comp.id}:${idx}`);
            state.nets.set(newNet, set);
          }
          renderNets();
          syncTextarea();
        });
        row.appendChild(lbl);
        row.appendChild(inp);
        netWrap.appendChild(row);
      });

      card.appendChild(title);
      card.appendChild(valueInput);
      card.appendChild(netWrap);

      card.addEventListener("pointerdown", (evt) => {
        selection.clear();
        selection.add(comp.id);
        dragging = {
          id: comp.id,
          startX: evt.clientX,
          startY: evt.clientY,
          origX: comp.x,
          origY: comp.y,
        };
        renderCanvas();
        card.setPointerCapture(evt.pointerId);
      });

      card.addEventListener("pointermove", (evt) => {
        if (!dragging || dragging.id !== comp.id) return;
        const dx = evt.clientX - dragging.startX;
        const dy = evt.clientY - dragging.startY;
        comp.x = dragging.origX + dx;
        comp.y = dragging.origY + dy;
        renderCanvas();
      });

      card.addEventListener("pointerup", () => {
        dragging = null;
        syncTextarea();
      });

      cardLayer.appendChild(card);

      // Terminals dots on overlay
      const layout = terminalLayout(comp.terminals || 2);
      layout.forEach((pos) => {
        drawTerminalDot(comp.x + pos.x, comp.y + pos.y, comp.color);
      });
    });
  }

  renderPalette();
  renderNets();
  renderCanvas();

  return { addElement };
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  if (typeof container.__nvModelFamilyEditorCleanup === "function") {
    try {
      container.__nvModelFamilyEditorCleanup();
    } catch (err) {
      console.warn("Model family editor cleanup failed before reload:", err);
    }
  }
  container.__nvModelFamilyEditorCleanup = null;
  const ext = fileExt(filePath);
  const isCIR = ext === "cir";
  const isOBJ = ext === "obj";
  const currentMode = isCIR ? "CIRediting" : isOBJ ? "OBJediting" : "ModelFamilyEditing";

  ensureNodevisionState(currentMode);
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeActionHandler = null;
  window.NodevisionModelExportContext = null;
  updateToolbarState({ currentMode, selectedFile: filePath, activeActionHandler: null, modelCanExportSTL: false });

  const { status, body } = createBaseLayout(container, `Model/CAD Editor — ${filePath}`);

  try {
    const buffer = await fetchArrayBuffer(filePath);
    const bytes = new Uint8Array(buffer);
    const likelyTextExt = new Set(["obj", "ply", "step", "stp", "scad", "gcode", "dxf", "vtk", "sdf", "ifc", "usd", "usda", "cir"]);
    const isText = detectText(bytes) || likelyTextExt.has(ext);

    const info = document.createElement("div");
    info.style.cssText = "font:12px monospace;color:#555;";
    info.textContent = `Extension: ${ext || "(none)"} | Size: ${bytes.length.toLocaleString()} bytes`;
    body.appendChild(info);

    if (isText && bytes.length < 4 * 1024 * 1024) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

      const layout = document.createElement("div");
      layout.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:stretch;min-height:320px;min-width:0;width:100%;";

      const editorCol = document.createElement("div");
      editorCol.style.cssText = "flex:1 1 320px;min-width:min(320px,100%);display:flex;flex-direction:column;gap:8px;";

      const textarea = document.createElement("textarea");
      textarea.id = "markdown-editor";
      textarea.value = text;
      textarea.spellcheck = false;
      textarea.style.cssText = [
        "width:100%",
        "height:100%",
        "min-height:260px",
        "resize:none",
        "padding:12px",
        "box-sizing:border-box",
        "font:13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        "border:1px solid #c9c9c9",
        "border-radius:8px",
        "background:#fff",
        "color:#111",
        "flex:1",
      ].join(";");

      editorCol.appendChild(textarea);
      layout.appendChild(editorCol);

      if (isCIR) {
        const previewTitle = document.createElement("div");
        previewTitle.style.cssText = "font:12px monospace;color:#333;margin-bottom:4px;";
        previewTitle.textContent = "Circuit preview";

        const previewArea = document.createElement("div");
        previewArea.id = "cir-preview";
        previewArea.style.cssText = "width:100%;min-height:280px;";

        const renderPreview = (value) => {
          try {
            const { components } = parseNetlist(value || "");
            previewArea.innerHTML = "";
            if (!components.length) {
              previewArea.innerHTML = "<div style='color:#666;font:12px monospace;'>No components to render.</div>";
              return;
            }
            const svg = buildCircuitSVG(components);
            previewArea.appendChild(svg);
          } catch (err) {
            previewArea.innerHTML = `<div style="color:#b00020;font:12px monospace;">Preview error: ${err.message}</div>`;
          }
        };

        const previewCol = document.createElement("div");
        previewCol.style.cssText = [
          "flex:1",
          "min-width:320px",
          "border:1px solid #c9c9c9",
          "border-radius:8px",
          "background:#fff",
          "padding:8px",
          "box-sizing:border-box",
          "min-height:360px",
          "overflow:auto",
          "display:flex",
          "flex-direction:column",
          "gap:10px",
        ].join(";");

        const canvasArea = document.createElement("div");
        canvasArea.id = "cir-canvas";
        canvasArea.style.cssText = "width:100%;min-height:320px;";

        previewCol.appendChild(previewTitle);
        previewCol.appendChild(canvasArea);
        previewCol.appendChild(previewArea);
        layout.appendChild(previewCol);
        body.appendChild(layout);

        const initialState = buildStateFromNetlist(textarea.value);
        const canvasApi = renderCanvasEditor(canvasArea, initialState, status, textarea, renderPreview);
        renderPreview(textarea.value);

        const cirToolbarHandler = (callbackKey) => {
          const entry = CIR_ELEMENT_LIBRARY.find((e) => e.key === callbackKey);
          if (!entry || !canvasApi?.addElement) return;
          canvasApi.addElement(entry);
        };
        window.NodevisionState.activeActionHandler = cirToolbarHandler;
        updateToolbarState({ currentMode, activeActionHandler: cirToolbarHandler });
      } else if (isOBJ) {
        const previewCol = document.createElement("div");
        previewCol.style.cssText = [
          "flex:1.15 1 360px",
          "min-width:min(360px,100%)",
          "max-width:100%",
          "min-height:360px",
          "display:flex",
          "flex-direction:column",
          "gap:8px",
        ].join(";");

        const previewTitle = document.createElement("div");
        previewTitle.textContent = "OBJ viewport";
        previewTitle.style.cssText = "font:12px monospace;color:#333;";
        const previewMount = document.createElement("div");
        previewMount.style.cssText = "flex:1;min-height:360px;min-width:0;width:100%;";
        previewCol.append(previewTitle, previewMount);
        layout.appendChild(previewCol);
        body.appendChild(layout);

        const objPreview = await createObjGraphicalPreview(previewMount, textarea.value, status, {
          onSourceChange: (nextSource) => {
            textarea.value = String(nextSource || "");
          },
        });
        const exportToken = Symbol("nv-obj-export-context");
        window.NodevisionModelExportContext = {
          token: exportToken,
          kind: "obj",
          filePath,
          exportSTL: () => objPreview.exportSTL(filePath),
        };
        updateToolbarState({ currentMode, modelCanExportSTL: true });
        container.__nvModelFamilyEditorCleanup = () => {
          objPreview.dispose();
          if (window.NodevisionModelExportContext?.token === exportToken) {
            window.NodevisionModelExportContext = null;
            updateToolbarState({ modelCanExportSTL: false });
          }
        };
        textarea.addEventListener("input", () => objPreview.setSource(textarea.value));
      } else {
        body.appendChild(layout);
      }

      window.getEditorMarkdown = () => textarea.value;
      window.saveMDFile = async (path = filePath) => {
        await saveText(path, textarea.value);
      };
      if (!isOBJ) {
        status.textContent = isCIR ? "Circuit netlist mode" : "Model text mode";
      }
      return;
    }

    let replacementBase64 = "";
    const panel = document.createElement("div");
    panel.style.cssText = "margin-top:8px;border:1px solid #c9c9c9;border-radius:8px;padding:12px;background:#fafafa;font:13px/1.45 monospace;";
    panel.innerHTML = "<div>Binary model mode: use replacement upload and Save.</div>";
    body.appendChild(panel);

    const input = document.createElement("input");
    input.type = "file";
    input.style.cssText = "margin-top:10px;max-width:420px;";
    panel.appendChild(input);

    const msg = document.createElement("div");
    msg.style.cssText = "margin-top:8px;color:#666;font:12px monospace;";
    msg.textContent = "No replacement file loaded.";
    panel.appendChild(msg);

    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      if (!f) return;
      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      replacementBase64 = String(dataURL).split(",")[1] || "";
      msg.textContent = `Ready: ${f.name} (${f.size.toLocaleString()} bytes)`;
      status.textContent = "Replacement loaded. Press Save.";
    });

    window.saveWYSIWYGFile = async (path = filePath) => {
      if (!replacementBase64) throw new Error("No replacement file selected.");
      await saveBase64(path, replacementBase64);
    };
    status.textContent = "Model binary mode";
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load model file: ${err.message}</div>`;
    status.textContent = "Load failed";
  }
}
