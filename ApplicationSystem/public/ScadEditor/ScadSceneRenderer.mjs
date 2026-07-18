// Nodevision/ApplicationSystem/public/ScadEditor/ScadSceneRenderer.mjs
// Three.js approximate preview adapter for graphical SCAD models.

import { mountWidget } from "/Widgets/WidgetHost.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";

const SCAD_LIGHT_THEME = {
  viewportBackground: "#ffffff",
  sceneBackground: 0xffffff,
  gridCenter: 0x94a3b8,
  gridLine: 0xe2e8f0,
};
const SCAD_DARK_THEME = {
  viewportBackground: "#0f141b",
  sceneBackground: 0x0f141b,
  gridCenter: 0x445067,
  gridLine: 0x2b3444,
};

function currentNodevisionTheme() {
  return document.documentElement?.dataset?.nvTheme === "dark" ? "dark" : "light";
}

function layerFor(model, obj) {
  return model.layers.find((layer) => layer.id === obj.layerId) || model.layers[0] || {};
}

function objectHeight(obj) {
  const op = (obj.operations || []).find((item) => item.type === "extrude" && !item.disabled);
  return Math.max(0.4, Number(op?.params?.height || 0.6));
}

function shapeForObject(THREE, obj) {
  const p = obj.params || {};
  const shape = new THREE.Shape();
  if (obj.type === "circle") {
    const r = Math.max(0.1, Number(p.radius || 5));
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    return shape;
  }
  if (obj.type === "rectangle") {
    const w = Math.max(0.1, Number(p.width || 20));
    const h = Math.max(0.1, Number(p.height || 10));
    shape.moveTo(0, 0); shape.lineTo(w, 0); shape.lineTo(w, h); shape.lineTo(0, h); shape.lineTo(0, 0);
    return shape;
  }
  if (obj.type === "square") {
    const size = Math.max(0.1, Number(p.size || 12));
    shape.moveTo(0, 0); shape.lineTo(size, 0); shape.lineTo(size, size); shape.lineTo(0, size); shape.lineTo(0, 0);
    return shape;
  }
  if (obj.type === "text") {
    const size = Math.max(1, Number(p.size || 10));
    const text = String(p.text || "Text");
    const w = Math.max(size, text.length * size * 0.62);
    const h = size;
    shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.lineTo(-w / 2, -h / 2);
    return shape;
  }
  const pts = Array.isArray(p.points) ? p.points : [];
  if (!pts.length) return null;
  shape.moveTo(Number(pts[0][0] || 0), Number(pts[0][1] || 0));
  pts.slice(1).forEach((pt) => shape.lineTo(Number(pt[0] || 0), Number(pt[1] || 0)));
  if (obj.type !== "vertexPath") shape.lineTo(Number(pts[0][0] || 0), Number(pts[0][1] || 0));
  return shape;
}

function applyTransform(mesh, obj) {
  const t = obj.transform || {};
  const translate = Array.isArray(t.translate) ? t.translate : [0, 0, 0];
  const rotate = Array.isArray(t.rotate) ? t.rotate : [0, 0, 0];
  const scale = Array.isArray(t.scale) ? t.scale : [1, 1, 1];
  mesh.position.set(Number(translate[0] || 0), Number(translate[1] || 0), Number(translate[2] || 0));
  mesh.rotation.set(Number(rotate[0] || 0) * Math.PI / 180, Number(rotate[1] || 0) * Math.PI / 180, Number(rotate[2] || 0) * Math.PI / 180);
  mesh.scale.set(Number(scale[0] || 1), Number(scale[1] || 1), Number(scale[2] || 1));
}

function vertexPathPoints(THREE, obj) {
  const points = Array.isArray(obj.params?.points) ? obj.params.points : [];
  return points
    .filter((point) => Array.isArray(point))
    .map((point) => new THREE.Vector3(Number(point[0] || 0), Number(point[1] || 0), Number(point[2] || 0)));
}

function solidGeometryForObject(THREE, obj) {
  const p = obj.params || {};
  if (obj.type === "sphere") {
    const radius = Math.max(0.1, Number(p.radius || 6));
    const segments = Math.max(8, Math.round(Number(p.segments || 48)));
    return new THREE.SphereGeometry(radius, segments, Math.max(6, Math.round(segments / 2)));
  }
  if (obj.type === "cube") {
    const size = Array.isArray(p.size) ? p.size : [p.size || 12, p.size || 12, p.size || 12];
    const geometry = new THREE.BoxGeometry(Math.max(0.1, Number(size[0] || 12)), Math.max(0.1, Number(size[1] || 12)), Math.max(0.1, Number(size[2] || 12)));
    if (p.center === false) geometry.translate(Number(size[0] || 12) / 2, Number(size[1] || 12) / 2, Number(size[2] || 12) / 2);
    return geometry;
  }
  if (obj.type === "cylinder") {
    const radius = Math.max(0.1, Number(p.radius || 5));
    const height = Math.max(0.1, Number(p.height || 16));
    const segments = Math.max(8, Math.round(Number(p.segments || 48)));
    const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
    geometry.rotateX(Math.PI / 2);
    if (p.center === false) geometry.translate(0, 0, height / 2);
    return geometry;
  }
  if (obj.type === "polyhedron") {
    const points = Array.isArray(p.points) ? p.points : [];
    const faces = Array.isArray(p.faces) ? p.faces : [];
    if (!points.length || !faces.length) return null;
    const vertices = [];
    points.forEach((point) => vertices.push(Number(point?.[0] || 0), Number(point?.[1] || 0), Number(point?.[2] || 0)));
    const indices = [];
    faces.forEach((face) => {
      const arr = Array.isArray(face) ? face.map((index) => Math.max(0, Math.round(Number(index || 0)))) : [];
      for (let i = 1; i < arr.length - 1; i += 1) indices.push(arr[0], arr[i], arr[i + 1]);
    });
    if (!indices.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  return null;
}

export async function createScadSceneRenderer(container, options = {}) {
  const THREE = await import("/lib/three/three.module.js");
  const { OrbitControls } = await import("/lib/three/OrbitControls.js");
  container.innerHTML = "";
  container.style.position = container.style.position || "relative";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCAD_LIGHT_THEME.sceneBackground);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
  camera.position.set(90, -120, 120);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableRotate = false;

  const orientationWidget = await mountWidget(ViewportOrientationWidget, {
    container,
    THREE,
    camera,
    controls,
    viewAdapter: {
      getCamera: () => camera,
      getControls: () => controls,
      getViewportElement: () => container,
      requestRender: () => {
        renderer.render(scene, camera);
        return true;
      },
    },
  });
  function disposeMaterial(material) {
    if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
    else material?.dispose?.();
  }

  let floorGrid = new THREE.GridHelper(160, 16, SCAD_LIGHT_THEME.gridCenter, SCAD_LIGHT_THEME.gridLine);
  scene.add(floorGrid);
  scene.add(new THREE.AxesHelper(60));

  function applyViewportTheme(theme = currentNodevisionTheme()) {
    const colors = theme === "dark" ? SCAD_DARK_THEME : SCAD_LIGHT_THEME;
    container.style.background = colors.viewportBackground;
    scene.background.set(colors.sceneBackground);

    scene.remove(floorGrid);
    floorGrid.geometry?.dispose?.();
    disposeMaterial(floorGrid.material);
    floorGrid = new THREE.GridHelper(160, 16, colors.gridCenter, colors.gridLine);
    scene.add(floorGrid);
  }

  const onThemeChanged = (event) => applyViewportTheme(event?.detail?.theme || currentNodevisionTheme());
  applyViewportTheme();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b96a8, 1.7));
  const group = new THREE.Group();
  scene.add(group);
  let selectedIds = new Set();
  let selectedFaceRefs = [];
  let pickHandler = null;
  let boxSelectHandler = null;
  let selectionBox = null;
  let modelRef = null;
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.7;
  raycaster.params.Line.threshold = 0.7;
  const pointer = new THREE.Vector2();

  function resize() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, rect.width || container.clientWidth || 1);
    const h = Math.max(1, rect.height || container.clientHeight || 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function clearGroup() {
    while (group.children.length) {
      const child = group.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  function pointFromFaceRefPoint(point) {
    if (Array.isArray(point)) return new THREE.Vector3(Number(point[0] || 0), Number(point[1] || 0), Number(point[2] || 0));
    return new THREE.Vector3(Number(point?.x || 0), Number(point?.y || 0), Number(point?.z || 0));
  }

  function selectedFacesForObject(objectId) {
    return selectedFaceRefs.filter((ref) => (ref?.objectId || ref?.id) === objectId && Array.isArray(ref?.points) && ref.points.length >= 3);
  }

  function addSelectedFaceOverlay(objectId, color) {
    selectedFacesForObject(objectId).forEach((ref) => {
      const points = ref.points.map(pointFromFaceRefPoint);
      if (points.length < 3) return;
      const fillGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const indices = [];
      for (let i = 1; i < points.length - 1; i += 1) indices.push(0, i, i + 1);
      fillGeometry.setIndex(indices);
      fillGeometry.computeVertexNormals();
      const fill = new THREE.Mesh(fillGeometry, new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthTest: false,
      }));
      fill.userData.ignorePick = true;
      group.add(fill);

      const outlineGeometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
      const outline = new THREE.Line(outlineGeometry, new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.96,
        depthTest: false,
      }));
      outline.userData.ignorePick = true;
      group.add(outline);
    });
  }

  function faceRefFromHit(hit, objectId) {
    const face = hit?.face;
    const geometry = hit?.object?.geometry;
    const positions = geometry?.attributes?.position;
    if (!face || !positions) return null;
    const points = [face.a, face.b, face.c].map((index) => {
      const point = new THREE.Vector3().fromBufferAttribute(positions, index);
      hit.object.localToWorld(point);
      return [Number(point.x.toFixed(5)), Number(point.y.toFixed(5)), Number(point.z.toFixed(5))];
    });
    const normal = face.normal.clone().transformDirection(hit.object.matrixWorld);
    return {
      objectId,
      id: objectId,
      faceIndex: Number.isInteger(hit.faceIndex) ? hit.faceIndex : 0,
      points,
      normal: [Number(normal.x.toFixed(5)), Number(normal.y.toFixed(5)), Number(normal.z.toFixed(5))],
    };
  }

  const BOOLEAN_STEP_TYPES = new Set(["cutout", "difference", "union", "intersection"]);
  const selectedColor = 0xffb13b;

  function booleanKeyword(step) {
    const op = step?.params?.operation || step?.type;
    if (op === "cutout") return "difference";
    return ["union", "difference", "intersection"].includes(op) ? op : null;
  }

  function enabledBooleanSteps(model) {
    return (model?.timeline || []).filter((step) => BOOLEAN_STEP_TYPES.has(step?.type) && !step.disabled && Boolean(booleanKeyword(step)));
  }

  function objectByIdInModel(model, id) {
    return (model?.objects || []).find((obj) => obj.id === id) || null;
  }

  function booleanStepObjects(model, step) {
    return (step?.objectIds || []).map((id) => objectByIdInModel(model, id)).filter(Boolean);
  }

  function objectHas3DPreview(obj) {
    return ["sphere", "cube", "cylinder", "polyhedron"].includes(obj?.type) || (obj?.operations || []).some((op) => op?.type === "extrude" && !op.disabled);
  }

  function previewObjectHeight(obj) {
    const p = obj?.params || {};
    const extrude = (obj?.operations || []).find((op) => op?.type === "extrude" && !op.disabled);
    if (extrude) return Math.max(0.4, Number(extrude.params?.height || extrude.height || 10));
    if (obj?.type === "cube") {
      const size = Array.isArray(p.size) ? p.size : [p.size || 12, p.size || 12, p.size || 12];
      return Math.max(0.4, Number(size[2] || 12));
    }
    if (obj?.type === "cylinder") return Math.max(0.4, Number(p.height || 16));
    if (obj?.type === "sphere") return Math.max(0.4, Number(p.radius || 6) * 2);
    return objectHeight(obj);
  }

  function booleanPreviewHeight(objects = []) {
    const source = objects.find(objectHas3DPreview) || objects[0];
    return previewObjectHeight(source);
  }

  function renderObjectPreview(model, obj, options = {}) {
    if (!obj) return false;
    const layer = layerFor(model, obj);
    if (obj.visible === false && options.includeHidden !== true) return false;
    if (layer.visible === false) return false;
    const selected = selectedIds.has(obj.id);
    const color = options.color !== undefined ? options.color : (selected ? selectedColor : new THREE.Color(layer.color || "#4f8cff"));
    const opacity = Number.isFinite(options.opacity) ? options.opacity : (layer.locked ? 0.42 : 0.78);
    const transparent = opacity < 1;
    const wireframe = Boolean(options.wireframe);
    const ignorePick = Boolean(options.ignorePick);
    const pickObjectId = options.pickObjectId || obj.id;

    const solidGeometry = solidGeometryForObject(THREE, obj);
    if (solidGeometry) {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.05, transparent, opacity, wireframe });
      const mesh = new THREE.Mesh(solidGeometry, mat);
      mesh.userData.objectId = pickObjectId;
      mesh.userData.ignorePick = ignorePick;
      mesh.name = obj.name || obj.id;
      applyTransform(mesh, obj);
      group.add(mesh);
      if (selected && !ignorePick && !wireframe) addSelectedFaceOverlay(obj.id, selectedColor);
      return true;
    }

    if (obj.type === "vertexPath" || obj.type === "line") {
      const points = vertexPathPoints(THREE, obj);
      if (!points.length) return false;
      const pointGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const pointMaterial = new THREE.PointsMaterial({
        color,
        size: selected ? 8 : 6,
        sizeAttenuation: false,
        transparent,
        opacity,
      });
      const pointCloud = new THREE.Points(pointGeometry, pointMaterial);
      pointCloud.userData.objectId = pickObjectId;
      pointCloud.userData.ignorePick = ignorePick;
      pointCloud.name = obj.name || obj.id;
      applyTransform(pointCloud, obj);
      group.add(pointCloud);

      if (points.length > 1) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({ color, transparent, opacity });
        const line = obj.params?.closed ? new THREE.LineLoop(lineGeometry, lineMaterial) : new THREE.Line(lineGeometry, lineMaterial);
        line.userData.objectId = pickObjectId;
        line.userData.ignorePick = ignorePick;
        line.name = obj.name || obj.id;
        applyTransform(line, obj);
        group.add(line);
      }
      return true;
    }

    const shape = shapeForObject(THREE, obj);
    if (!shape) return false;
    const depth = Number.isFinite(options.depthOverride) ? options.depthOverride : objectHeight(obj);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.05, transparent, opacity, wireframe });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.userData.objectId = pickObjectId;
    mesh.userData.ignorePick = ignorePick;
    mesh.name = obj.name || obj.id;
    applyTransform(mesh, obj);
    group.add(mesh);
    if (selected && !ignorePick && !wireframe) addSelectedFaceOverlay(obj.id, selectedColor);
    return true;
  }

  function objectPreviewBox(obj, depthOverride = null) {
    if (!obj) return null;
    let geometry = solidGeometryForObject(THREE, obj);
    if (!geometry) {
      if (obj.type === "vertexPath" || obj.type === "line") geometry = new THREE.BufferGeometry().setFromPoints(vertexPathPoints(THREE, obj));
      else {
        const shape = shapeForObject(THREE, obj);
        if (shape) geometry = new THREE.ExtrudeGeometry(shape, { depth: Number.isFinite(depthOverride) ? depthOverride : objectHeight(obj), bevelEnabled: false });
      }
    }
    if (!geometry) return null;
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    applyTransform(mesh, obj);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    geometry.dispose?.();
    material.dispose?.();
    return box.isEmpty() ? null : box;
  }

  function intersectionBoxForObjects(objects = [], depthOverride = null) {
    let result = null;
    for (const obj of objects) {
      const box = objectPreviewBox(obj, depthOverride);
      if (!box) continue;
      result = result ? result.intersect(box) : box.clone();
      if (result.isEmpty()) return null;
    }
    return result;
  }

  function renderIntersectionPreview(model, step, objects, depthOverride) {
    objects.forEach((obj) => renderObjectPreview(model, obj, { includeHidden: true, wireframe: true, opacity: 0.24, color: 0x0f766e, depthOverride }));
    const box = intersectionBoxForObjects(objects, depthOverride);
    if (!box) return false;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const geometry = new THREE.BoxGeometry(Math.max(0.01, size.x), Math.max(0.01, size.y), Math.max(0.01, size.z));
    const material = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.7, transparent: true, opacity: 0.48 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.userData.objectId = step.params?.baseObjectId || objects[0]?.id || null;
    mesh.name = step.label || "Intersection Preview";
    group.add(mesh);
    return true;
  }

  function renderBooleanStep(model, step) {
    const keyword = booleanKeyword(step);
    const objects = booleanStepObjects(model, step);
    if (!keyword || objects.length < 2) return [];
    const ids = (step.objectIds || []).filter(Boolean);
    const depthOverride = booleanPreviewHeight(objects);
    const selectedBoolean = ids.some((id) => selectedIds.has(id));
    if (keyword === "difference") {
      const base = objects[0];
      renderObjectPreview(model, base, { includeHidden: true, color: selectedBoolean ? selectedColor : undefined, depthOverride });
      objects.slice(1).forEach((obj) => renderObjectPreview(model, obj, { includeHidden: true, wireframe: true, opacity: selectedIds.has(obj.id) ? 0.45 : 0.28, color: 0xef4444, depthOverride }));
      return ids;
    }
    if (keyword === "intersection") {
      renderIntersectionPreview(model, step, objects, depthOverride);
      return ids;
    }
    objects.forEach((obj) => renderObjectPreview(model, obj, { includeHidden: true, depthOverride }));
    return ids;
  }

  function renderModel(model) {
    modelRef = model;
    clearGroup();
    const emitted = new Set();
    for (const step of enabledBooleanSteps(model)) {
      renderBooleanStep(model, step).forEach((id) => emitted.add(id));
    }
    for (const obj of model.objects || []) {
      if (emitted.has(obj.id)) continue;
      renderObjectPreview(model, obj);
    }
    resize();
    renderer.render(scene, camera);
  }

  let animationFrame = 0;
  function animate() {
    controls.update();
    renderer.render(scene, camera);
    orientationWidget?.sync?.();
    animationFrame = requestAnimationFrame(animate);
  }
  animate();

  function ensureSelectionBoxElement() {
    if (selectionBox?.el) return selectionBox.el;
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      border: "1px solid #f59e0b",
      background: "rgba(245,158,11,0.14)",
      pointerEvents: "none",
      zIndex: "10000",
      display: "none",
    });
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
    Object.assign(el.style, {
      display: selectionBox.moved ? "block" : "none",
      left: String(left) + "px",
      top: String(top) + "px",
      width: String(width) + "px",
      height: String(height) + "px",
    });
  }

  function startSelectionBox(event) {
    selectionBox = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      moved: false,
      shiftKey: event.shiftKey || event.ctrlKey || event.metaKey,
      el: null,
    };
    updateSelectionBoxElement();
  }

  function updateSelectionBox(event) {
    if (!selectionBox) return false;
    selectionBox.currentX = event.clientX;
    selectionBox.currentY = event.clientY;
    updateSelectionBoxElement();
    return true;
  }

  function pickObjectFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(group.children, false).filter((entry) => !entry.object?.userData?.ignorePick);
    const hit = hits[0] || null;
    const id = hit?.object?.userData?.objectId || null;
    if (id) {
      const meta = hit.object?.isPoints && Number.isInteger(hit.index)
        ? { vertexRef: { objectId: id, pointIndex: hit.index } }
        : hit.object?.isMesh && hit.face
          ? { faceRef: faceRefFromHit(hit, id) }
          : null;
      pickHandler?.(id, event, meta);
    } else {
      boxSelectHandler?.([], event, { vertexRefs: [] });
    }
  }

  function rectsIntersect(a, b) {
    return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
  }

  function screenBoundsForObject(object) {
    const bounds = new THREE.Box3().setFromObject(object);
    const rect = renderer.domElement.getBoundingClientRect();
    const points = [];

    if (bounds.isEmpty()) {
      points.push(object.getWorldPosition(new THREE.Vector3()));
    } else {
      points.push(
        new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
        new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
        new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
        new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
        new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
        new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
        new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
        new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
      );
    }

    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let hasPoint = false;

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

  function screenPointFromWorldPoint(worldPoint) {
    const rect = renderer.domElement.getBoundingClientRect();
    const point = worldPoint.clone().project(camera);
    if (point.z < -1 || point.z > 1) return null;
    return {
      x: rect.left + (point.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-point.y * 0.5 + 0.5) * rect.height,
    };
  }

  function collectVertexRefsInBox(selectionRect) {
    const refs = [];
    group.children.forEach((child) => {
      if (!child?.isPoints) return;
      const objectId = child.userData?.objectId;
      const positions = child.geometry?.attributes?.position;
      if (!objectId || !positions) return;
      for (let pointIndex = 0; pointIndex < positions.count; pointIndex += 1) {
        const worldPoint = new THREE.Vector3().fromBufferAttribute(positions, pointIndex);
        child.localToWorld(worldPoint);
        const screenPoint = screenPointFromWorldPoint(worldPoint);
        if (!screenPoint) continue;
        if (screenPoint.x >= selectionRect.left && screenPoint.x <= selectionRect.right && screenPoint.y >= selectionRect.top && screenPoint.y <= selectionRect.bottom) {
          refs.push({ objectId, pointIndex });
        }
      }
    });
    return refs;
  }

  function selectObjectsInBox(box, event) {
    const selectionRect = {
      left: Math.min(box.startX, box.currentX),
      right: Math.max(box.startX, box.currentX),
      top: Math.min(box.startY, box.currentY),
      bottom: Math.max(box.startY, box.currentY),
    };
    const ids = new Set();
    camera.updateMatrixWorld?.();
    const vertexRefs = collectVertexRefsInBox(selectionRect);
    vertexRefs.forEach((ref) => ids.add(ref.objectId));
    group.children.forEach((child) => {
      const id = child.userData?.objectId;
      if (!id) return;
      const bounds = screenBoundsForObject(child);
      if (bounds && rectsIntersect(selectionRect, bounds)) ids.add(id);
    });
    boxSelectHandler?.([...ids], { shiftKey: box.shiftKey, ctrlKey: false, metaKey: false }, { vertexRefs });
  }

  function finishSelectionBox(event) {
    if (!selectionBox) return false;
    selectionBox.currentX = event.clientX;
    selectionBox.currentY = event.clientY;
    updateSelectionBoxElement();
    const box = selectionBox;
    const moved = box.moved;
    if (moved) selectObjectsInBox(box, event);
    box.el?.remove?.();
    selectionBox = null;
    if (!moved) pickObjectFromEvent(event);
    return true;
  }

  function handleViewportPointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    startSelectionBox(event);
  }

  function handleViewportPointerMove(event) {
    updateSelectionBox(event);
  }

  function handleViewportPointerUp(event) {
    finishSelectionBox(event);
  }

  renderer.domElement.addEventListener("pointerdown", handleViewportPointerDown);
  window.addEventListener("pointermove", handleViewportPointerMove);
  window.addEventListener("pointerup", handleViewportPointerUp);
  window.addEventListener("pointercancel", handleViewportPointerUp);

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  } else {
    window.addEventListener("resize", resize);
  }
  window.addEventListener("nv-theme-changed", onThemeChanged);
  resize();

  return {
    domElement: renderer.domElement,
    renderModel,
    setSelectedId(id) {
      selectedIds = id ? new Set([id]) : new Set();
      if (modelRef) renderModel(modelRef);
    },
    setSelectedIds(ids = []) {
      selectedIds = new Set((Array.isArray(ids) ? ids : []).filter(Boolean));
      if (modelRef) renderModel(modelRef);
    },
    setSelectedFaceRefs(refs = []) {
      selectedFaceRefs = (Array.isArray(refs) ? refs : []).filter((ref) => Array.isArray(ref?.points) && ref.points.length >= 3);
      if (modelRef) renderModel(modelRef);
    },
    setPickHandler(fn) { pickHandler = typeof fn === "function" ? fn : null; },
    setBoxSelectHandler(fn) { boxSelectHandler = typeof fn === "function" ? fn : null; },
    dispose() {
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", resize);
      window.removeEventListener("nv-theme-changed", onThemeChanged);
      window.removeEventListener("pointermove", handleViewportPointerMove);
      window.removeEventListener("pointerup", handleViewportPointerUp);
      window.removeEventListener("pointercancel", handleViewportPointerUp);
      renderer.domElement.removeEventListener("pointerdown", handleViewportPointerDown);
      selectionBox?.el?.remove?.();
      selectionBox = null;
      cancelAnimationFrame(animationFrame);
      scene.remove(floorGrid);
      floorGrid.geometry?.dispose?.();
      disposeMaterial(floorGrid.material);
      controls.dispose?.();
      clearGroup();
      renderer.dispose?.();
      orientationWidget?.destroy?.();
      container.innerHTML = "";
    },
  };
}
