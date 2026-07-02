// Nodevision/ApplicationSystem/public/ScadEditor/ScadSceneRenderer.mjs
// Three.js approximate preview adapter for graphical SCAD models.

import { mountWidget } from "/Widgets/WidgetHost.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";

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

export async function createScadSceneRenderer(container, options = {}) {
  const THREE = await import("/lib/three/three.module.js");
  const { OrbitControls } = await import("/lib/three/OrbitControls.js");
  container.innerHTML = "";
  container.style.position = container.style.position || "relative";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f8fb);
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
  scene.add(new THREE.GridHelper(160, 16, 0xb8c1cc, 0xe1e5eb));
  scene.add(new THREE.AxesHelper(60));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b96a8, 1.7));
  const group = new THREE.Group();
  scene.add(group);
  let selectedIds = new Set();
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
    const w = Math.max(320, rect.width || 640);
    const h = Math.max(260, rect.height || 420);
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

  function renderModel(model) {
    modelRef = model;
    clearGroup();
    const selectedColor = 0xffb13b;
    for (const obj of model.objects || []) {
      const layer = layerFor(model, obj);
      if (obj.visible === false || layer.visible === false) continue;
      const selected = selectedIds.has(obj.id);
      const color = selected ? selectedColor : new THREE.Color(layer.color || "#4f8cff");
      const opacity = layer.locked ? 0.42 : 0.78;

      if (obj.type === "vertexPath") {
        const points = vertexPathPoints(THREE, obj);
        if (!points.length) continue;
        const pointGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const pointMaterial = new THREE.PointsMaterial({
          color,
          size: selected ? 8 : 6,
          sizeAttenuation: false,
          transparent: opacity < 1,
          opacity,
        });
        const pointCloud = new THREE.Points(pointGeometry, pointMaterial);
        pointCloud.userData.objectId = obj.id;
        pointCloud.name = obj.name || obj.id;
        applyTransform(pointCloud, obj);
        group.add(pointCloud);

        if (points.length > 1) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
          const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
          const line = obj.params?.closed ? new THREE.LineLoop(lineGeometry, lineMaterial) : new THREE.Line(lineGeometry, lineMaterial);
          line.userData.objectId = obj.id;
          line.name = obj.name || obj.id;
          applyTransform(line, obj);
          group.add(line);
        }
        continue;
      }

      const shape = shapeForObject(THREE, obj);
      if (!shape) continue;
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: objectHeight(obj), bevelEnabled: false });
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.05, transparent: opacity < 1, opacity });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.userData.objectId = obj.id;
      mesh.name = obj.name || obj.id;
      applyTransform(mesh, obj);
      group.add(mesh);
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
    const hits = raycaster.intersectObjects(group.children, false);
    const id = hits[0]?.object?.userData?.objectId || null;
    if (id) pickHandler?.(id, event);
    else boxSelectHandler?.([], event);
  }

  function selectObjectsInBox(box, event) {
    const left = Math.min(box.startX, box.currentX);
    const right = Math.max(box.startX, box.currentX);
    const top = Math.min(box.startY, box.currentY);
    const bottom = Math.max(box.startY, box.currentY);
    const rect = renderer.domElement.getBoundingClientRect();
    const ids = new Set();
    camera.updateMatrixWorld?.();
    group.children.forEach((child) => {
      const id = child.userData?.objectId;
      if (!id) return;
      const bounds = new THREE.Box3().setFromObject(child);
      const center = bounds.isEmpty() ? child.getWorldPosition(new THREE.Vector3()) : bounds.getCenter(new THREE.Vector3());
      const point = center.project(camera);
      if (point.z < -1 || point.z > 1) return;
      const x = rect.left + (point.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-point.y * 0.5 + 0.5) * rect.height;
      if (x >= left && x <= right && y >= top && y <= bottom) ids.add(id);
    });
    boxSelectHandler?.([...ids], { shiftKey: box.shiftKey, ctrlKey: false, metaKey: false });
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

  window.addEventListener("resize", resize);
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
    setPickHandler(fn) { pickHandler = typeof fn === "function" ? fn : null; },
    setBoxSelectHandler(fn) { boxSelectHandler = typeof fn === "function" ? fn : null; },
    dispose() {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handleViewportPointerMove);
      window.removeEventListener("pointerup", handleViewportPointerUp);
      window.removeEventListener("pointercancel", handleViewportPointerUp);
      renderer.domElement.removeEventListener("pointerdown", handleViewportPointerDown);
      selectionBox?.el?.remove?.();
      selectionBox = null;
      cancelAnimationFrame(animationFrame);
      controls.dispose?.();
      clearGroup();
      renderer.dispose?.();
      orientationWidget?.destroy?.();
      container.innerHTML = "";
    },
  };
}
