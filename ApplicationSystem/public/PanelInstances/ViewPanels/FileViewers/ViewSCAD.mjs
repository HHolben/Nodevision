// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSCAD.mjs
// SCAD file viewer with a Three.js viewport, orientation widget, source preview, and STL export.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { STLLoader } from "/lib/three/STLLoader.js";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";
import { exportScadCodeToSTL } from "/ModelExport/STLExport.mjs";
import { parseBasicScad, parseScadText } from "/ScadEditor/ScadParser.mjs";

const SCAD_VIEWER_VERSION = "source-first-preview-2026-07-27";
const SCAD_VIEWER_ZOOM_SPEED = 0.04;

function scadViewerUrl(pathValue = "", serverBase = "/Notebook") {
  const base = String(serverBase || "/Notebook").replace(/\/+$/, "");
  const clean = String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
  const encoded = clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

function viewportSize(element) {
  const rect = element.getBoundingClientRect?.();
  return {
    width: Math.max(1, rect?.width || element.clientWidth || 1),
    height: Math.max(1, rect?.height || element.clientHeight || 1),
  };
}

function disposeObject3D(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material?.dispose?.());
  });
}

async function renderScadCodeToSTLBuffer(scadCode) {
  const response = await fetch("/api/scad/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scadCode: String(scadCode || ""), format: "stl" }),
  });

  if (!response.ok) {
    let message = String(response.status) + " " + String(response.statusText || "SCAD render failed");
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json().catch(() => null);
      message = [json?.error || message, json?.hint].filter(Boolean).join("\n");
    } else {
      const text = await response.text().catch(() => "");
      if (text.trim()) message = text.trim();
    }
    throw new Error(message);
  }

  return response.arrayBuffer();
}

function numberOr(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function vector3(values, fallback = [0, 0, 0]) {
  const source = Array.isArray(values) ? values : fallback;
  return [0, 1, 2].map((index) => numberOr(source[index], fallback[index] || 0));
}

function applyScadObjectTransform(object, transform = {}) {
  const translate = vector3(transform.translate, [0, 0, 0]);
  const rotate = vector3(transform.rotate, [0, 0, 0]);
  const scale = vector3(transform.scale, [1, 1, 1]);
  object.position.set(translate[0], translate[1], translate[2]);
  object.rotation.set(rotate[0] * Math.PI / 180, rotate[1] * Math.PI / 180, rotate[2] * Math.PI / 180);
  object.scale.set(scale[0], scale[1], scale[2]);
}

function activeExtrudeOperation(obj) {
  return (obj?.operations || []).find((op) => op?.type === "extrude" && !op.disabled) || null;
}

function scadObjectHeight(obj) {
  const params = obj?.params || {};
  const extrude = activeExtrudeOperation(obj);
  if (extrude) return Math.max(0.01, numberOr(extrude.params?.height ?? extrude.height, 10));
  if (obj?.type === "cube") {
    const size = Array.isArray(params.size) ? params.size : [params.size ?? 12, params.size ?? 12, params.size ?? 12];
    return Math.max(0.01, numberOr(size[2], 12));
  }
  if (obj?.type === "cylinder") return Math.max(0.01, numberOr(params.height ?? params.h, 16));
  if (obj?.type === "sphere") return Math.max(0.01, numberOr(params.radius ?? params.r, 6) * 2);
  return 0.4;
}

function shapeForScadObject(obj) {
  const params = obj?.params || {};
  const shape = new THREE.Shape();

  if (obj?.type === "circle") {
    const radius = Math.max(0.1, numberOr(params.radius ?? params.r, 5));
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    return shape;
  }

  if (obj?.type === "rectangle") {
    const width = Math.max(0.1, numberOr(params.width, 20));
    const height = Math.max(0.1, numberOr(params.height, 10));
    const x0 = params.center ? -width / 2 : 0;
    const y0 = params.center ? -height / 2 : 0;
    shape.moveTo(x0, y0);
    shape.lineTo(x0 + width, y0);
    shape.lineTo(x0 + width, y0 + height);
    shape.lineTo(x0, y0 + height);
    shape.lineTo(x0, y0);
    return shape;
  }

  if (obj?.type === "square") {
    const size = Math.max(0.1, numberOr(params.size, 12));
    const x0 = params.center ? -size / 2 : 0;
    const y0 = params.center ? -size / 2 : 0;
    shape.moveTo(x0, y0);
    shape.lineTo(x0 + size, y0);
    shape.lineTo(x0 + size, y0 + size);
    shape.lineTo(x0, y0 + size);
    shape.lineTo(x0, y0);
    return shape;
  }

  if (obj?.type === "text") {
    const size = Math.max(1, numberOr(params.size, 10));
    const value = String(params.text || "Text");
    const width = Math.max(size, value.length * size * 0.62);
    const height = size;
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.lineTo(-width / 2, -height / 2);
    return shape;
  }

  const points = Array.isArray(params.points) ? params.points : [];
  if (!points.length) return null;
  shape.moveTo(numberOr(points[0]?.[0], 0), numberOr(points[0]?.[1], 0));
  points.slice(1).forEach((point) => shape.lineTo(numberOr(point?.[0], 0), numberOr(point?.[1], 0)));
  if (obj?.type !== "vertexPath") shape.lineTo(numberOr(points[0]?.[0], 0), numberOr(points[0]?.[1], 0));
  return shape;
}

function geometryForScadObject(obj, options = {}) {
  const params = obj?.params || {};
  if (obj?.type === "sphere") {
    const radius = Math.max(0.1, numberOr(params.radius ?? params.r, 6));
    const segments = Math.max(8, Math.round(numberOr(params.segments ?? params.fn ?? params.$fn, 48)));
    return new THREE.SphereGeometry(radius, segments, Math.max(6, Math.round(segments / 2)));
  }
  if (obj?.type === "cube") {
    const size = Array.isArray(params.size) ? params.size : [params.size ?? 12, params.size ?? 12, params.size ?? 12];
    const geometry = new THREE.BoxGeometry(
      Math.max(0.1, numberOr(size[0], 12)),
      Math.max(0.1, numberOr(size[1], 12)),
      Math.max(0.1, numberOr(size[2], 12)),
    );
    if (params.center === false) geometry.translate(numberOr(size[0], 12) / 2, numberOr(size[1], 12) / 2, numberOr(size[2], 12) / 2);
    return geometry;
  }
  if (obj?.type === "cylinder") {
    const radius = Math.max(0.1, numberOr(params.radius ?? params.r, 5));
    const height = Math.max(0.1, numberOr(params.height ?? params.h, 16));
    const segments = Math.max(8, Math.round(numberOr(params.segments ?? params.fn ?? params.$fn, 48)));
    const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
    geometry.rotateX(Math.PI / 2);
    if (params.center === false) geometry.translate(0, 0, height / 2);
    return geometry;
  }
  if (obj?.type === "polyhedron") {
    const points = Array.isArray(params.points) ? params.points : [];
    const faces = Array.isArray(params.faces) ? params.faces : [];
    if (!points.length || !faces.length) return null;
    const vertices = [];
    points.forEach((point) => vertices.push(numberOr(point?.[0], 0), numberOr(point?.[1], 0), numberOr(point?.[2], 0)));
    const indices = [];
    faces.forEach((face) => {
      const arr = Array.isArray(face) ? face.map((index) => Math.max(0, Math.round(numberOr(index, 0)))) : [];
      for (let i = 1; i < arr.length - 1; i += 1) indices.push(arr[0], arr[i], arr[i + 1]);
    });
    if (!indices.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const shape = shapeForScadObject(obj);
  if (!shape) return null;
  const depth = Math.max(0.01, Number.isFinite(options.depthOverride) ? options.depthOverride : scadObjectHeight(obj));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function layerForApproximateObject(model, obj) {
  return (model.layers || []).find((layer) => layer.id === obj?.layerId) || (model.layers || [])[0] || {};
}

function approximateObjectIsVisible(model, obj, options = {}) {
  if (!obj || (obj.visible === false && options.includeHidden !== true)) return false;
  const layer = layerForApproximateObject(model, obj);
  return layer.visible !== false;
}

function addApproximateObject(group, model, obj, options = {}) {
  if (!approximateObjectIsVisible(model, obj, options)) return false;
  const geometry = geometryForScadObject(obj, options);
  if (!geometry) return false;
  const layer = layerForApproximateObject(model, obj);
  const opacity = Number.isFinite(options.opacity) ? options.opacity : 0.78;
  const material = new THREE.MeshStandardMaterial({
    color: options.color !== undefined ? options.color : new THREE.Color(layer.color || "#4f8cff"),
    metalness: 0.12,
    roughness: 0.78,
    transparent: opacity < 1,
    opacity,
    wireframe: Boolean(options.wireframe),
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = obj.name || obj.id || obj.type || "scad-object";
  mesh.userData.objectId = obj.id || null;
  mesh.userData.booleanPreview = Boolean(options.booleanPreview);
  applyScadObjectTransform(mesh, obj.transform || {});
  group.add(mesh);
  return true;
}

function objectPreviewBox(obj, options = {}) {
  const geometry = geometryForScadObject(obj, options);
  if (!geometry) return null;
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  applyScadObjectTransform(mesh, obj.transform || {});
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  geometry.dispose?.();
  material.dispose?.();
  return box.isEmpty() ? null : box;
}

function intersectionBoxForObjects(objects = []) {
  let result = null;
  for (const obj of objects) {
    const box = objectPreviewBox(obj);
    if (!box) continue;
    result = result ? result.intersect(box) : box.clone();
    if (result.isEmpty()) return null;
  }
  return result;
}

function booleanKeyword(step) {
  const op = step?.params?.operation || step?.type;
  if (op === "cutout") return "difference";
  return ["union", "difference", "intersection"].includes(op) ? op : null;
}

function enabledBooleanSteps(model) {
  const stepTypes = new Set(["cutout", "difference", "union", "intersection"]);
  return (model?.timeline || []).filter((step) => stepTypes.has(step?.type) && !step.disabled && Boolean(booleanKeyword(step)));
}

function objectById(model, id) {
  return (model?.objects || []).find((obj) => obj.id === id) || null;
}

function booleanStepObjects(model, step) {
  return (step?.objectIds || []).map((id) => objectById(model, id)).filter(Boolean);
}

function addIntersectionBox(group, box, step) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const geometry = new THREE.BoxGeometry(Math.max(0.01, size.x), Math.max(0.01, size.y), Math.max(0.01, size.z));
  const material = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.7, transparent: true, opacity: 0.48 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(center);
  mesh.name = step?.label || "Intersection Preview";
  mesh.userData.objectId = step?.params?.baseObjectId || step?.objectIds?.[0] || null;
  mesh.userData.booleanPreview = true;
  group.add(mesh);
}

function renderBooleanApproximation(group, model, step) {
  const keyword = booleanKeyword(step);
  const objects = booleanStepObjects(model, step);
  if (!keyword || objects.length < 2) return [];
  const ids = (step.objectIds || []).filter(Boolean);

  if (keyword === "difference") {
    addApproximateObject(group, model, objects[0], { includeHidden: true, booleanPreview: true });
    objects.slice(1).forEach((obj) => addApproximateObject(group, model, obj, { includeHidden: true, color: 0xef4444, opacity: 0.3, wireframe: true, booleanPreview: true }));
    return ids;
  }

  if (keyword === "intersection") {
    objects.forEach((obj) => addApproximateObject(group, model, obj, { includeHidden: true, color: 0x0f766e, opacity: 0.28, wireframe: true, booleanPreview: true }));
    const box = intersectionBoxForObjects(objects);
    if (box) addIntersectionBox(group, box, step);
    else group.userData.previewNote = "empty intersection";
    return ids;
  }

  objects.forEach((obj) => addApproximateObject(group, model, obj, { includeHidden: true, booleanPreview: true }));
  return ids;
}

function buildApproximateModelFromScad(scadText) {
  let parsed = null;
  try {
    parsed = parseScadText(scadText);
  } catch (err) {
    console.warn("[ViewSCAD] Metadata parse failed; trying visible source preview:", err);
    try {
      const sourceModel = parseBasicScad(scadText);
      parsed = { model: sourceModel, source: "visible-source" };
    } catch (sourceErr) {
      console.warn("[ViewSCAD] Source preview parse failed:", sourceErr);
      return null;
    }
  }

  const model = parsed?.model;
  const objects = Array.isArray(model?.objects) ? model.objects : [];
  if (!objects.length) return null;

  const group = new THREE.Group();
  group.name = "source-scad-model";
  group.userData.source = parsed.source || "source";
  group.userData.objectTypes = objects.map((obj) => obj?.type).filter(Boolean);

  const emitted = new Set();
  enabledBooleanSteps(model).forEach((step) => {
    renderBooleanApproximation(group, model, step).forEach((id) => emitted.add(id));
  });

  objects.forEach((obj) => {
    if (emitted.has(obj.id)) return;
    addApproximateObject(group, model, obj);
  });

  return group.children.length ? group : null;
}


export async function renderFile(filePath, panel, iframe, serverBase = "/Notebook") {
  const resolvedPath = typeof filePath === "string" ? filePath : filePath?.path || filePath?.filePath || "";
  if (!resolvedPath.toLowerCase().endsWith(".scad")) {
    panel.innerHTML = "<p>No SCAD file selected.</p>";
    return false;
  }

  if (typeof panel?._dispose === "function") {
    try {
      panel._dispose();
    } catch (err) {
      console.warn("[ViewSCAD] Previous viewer cleanup failed:", err);
    }
  }

  panel.innerHTML = "";
  panel.dataset.nvScadViewerVersion = SCAD_VIEWER_VERSION;
  window.__nvScadViewerVersion = SCAD_VIEWER_VERSION;
  console.info("[ViewSCAD] running " + SCAD_VIEWER_VERSION);
  panel.style.cssText = "display:flex;flex-direction:column;gap:8px;width:100%;height:100%;min-width:0;min-height:420px;overflow:hidden;box-sizing:border-box;padding:8px;";
  window.NodevisionModelExportContext = null;
  updateToolbarState({ currentMode: "SCADviewing", activePanelType: "ViewPanel", selectedFile: resolvedPath, modelCanExportSTL: false });

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;";
  const title = document.createElement("div");
  title.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12px/1.35 system-ui,sans-serif;";
  title.textContent = resolvedPath;
  const resetViewBtn = document.createElement("button");
  resetViewBtn.type = "button";
  resetViewBtn.textContent = "Reset View";
  resetViewBtn.style.cssText = "flex:0 0 auto;padding:4px 8px;";
  const diagnostic = document.createElement("div");
  diagnostic.style.cssText = "flex:0 0 auto;font:11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#475569;max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  diagnostic.textContent = SCAD_VIEWER_VERSION;
  toolbar.append(title, diagnostic, resetViewBtn);

  const viewer = document.createElement("div");
  viewer.style.cssText = "flex:1;min-height:300px;min-width:0;width:100%;border:1px solid #ccc;position:relative;overflow:hidden;background:#f0f0f0;";
  const loading = document.createElement("div");
  loading.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,0.86);padding:10px;border-radius:4px;z-index:2;font:12px system-ui,sans-serif;";
  loading.textContent = "Loading...";
  viewer.appendChild(loading);

  const codePre = document.createElement("pre");
  codePre.style.cssText = "white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f9f9f9;border:1px solid #ccc;padding:10px;margin:0;max-height:220px;overflow:auto;";

  panel.append(toolbar, viewer, codePre);

  let scene = null;
  let camera = null;
  let renderer = null;
  let controls = null;
  let orientationWidget = null;
  let resizeObserver = null;
  let animationFrame = 0;
  let disposed = false;
  let scadText = "";
  let compiledModel = null;
  const stlLoader = new STLLoader();
  const initialCameraPosition = new THREE.Vector3(100, 100, 100);
  const initialCameraTarget = new THREE.Vector3(0, 0, 0);
  let exportToken = null;

  function resize() {
    if (!renderer || !camera) return;
    const size = viewportSize(viewer);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height, false);
  }

  function animate() {
    if (disposed || !renderer || !scene || !camera) return;
    controls?.update();
    renderer.render(scene, camera);
    orientationWidget?.sync?.();
    animationFrame = requestAnimationFrame(animate);
  }

  function fitCameraToObject(object) {
    if (!object || !camera || !controls) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fov = camera.fov * (Math.PI / 180);
    const dist = Math.max(40, Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.65);

    const offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(dist);
    controls.target.copy(center);
    camera.position.copy(center).add(offset);
    camera.near = Math.max(0.01, maxDim / 2000);
    camera.far = Math.max(1000, maxDim * 80);
    camera.updateProjectionMatrix();
    controls.update();
    orientationWidget?.sync?.();
  }

  function setCompiledSTL(arrayBuffer) {
    if (!scene) return;
    if (compiledModel) {
      scene.remove(compiledModel);
      disposeObject3D(compiledModel);
      compiledModel = null;
    }

    const geometry = stlLoader.parse(arrayBuffer);
    const position = geometry.getAttribute("position");
    if (!position || position.count <= 0) {
      geometry.dispose?.();
      throw new Error("OpenSCAD produced an empty STL.");
    }

    geometry.computeVertexNormals?.();
    const material = new THREE.MeshStandardMaterial({
      color: 0x1976d2,
      metalness: 0.18,
      roughness: 0.72,
    });
    compiledModel = new THREE.Mesh(geometry, material);
    compiledModel.name = "compiled-scad";
    scene.add(compiledModel);
    fitCameraToObject(compiledModel);
    renderer?.render?.(scene, camera);
  }

  function disposeViewer() {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    if (resizeObserver) resizeObserver.disconnect();
    else window.removeEventListener("resize", resize);
    orientationWidget?.destroy?.();
    controls?.dispose?.();
    if (compiledModel) {
      scene?.remove?.(compiledModel);
      disposeObject3D(compiledModel);
      compiledModel = null;
    }
    renderer?.dispose?.();
    if (exportToken && window.NodevisionModelExportContext?.token === exportToken) {
      window.NodevisionModelExportContext = null;
      updateToolbarState({ modelCanExportSTL: false });
    }
    panel._dispose = null;
  }

  function setSourceModel(object) {
    if (!scene || !object) return false;
    if (compiledModel) {
      scene.remove(compiledModel);
      disposeObject3D(compiledModel);
      compiledModel = null;
    }
    compiledModel = object;
    scene.add(compiledModel);
    fitCameraToObject(compiledModel);
    renderer?.render?.(scene, camera);
    return true;
  }

  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    scene.add(new THREE.GridHelper(50, 50));
    scene.add(new THREE.AxesHelper(25));

    const size = viewportSize(viewer);
    camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.1, 1000);
    camera.position.copy(initialCameraPosition);
    camera.lookAt(initialCameraTarget);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(size.width, size.height, false);
    viewer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.zoomSpeed = SCAD_VIEWER_ZOOM_SPEED;
    controls.panSpeed = 0.65;
    controls.rotateSpeed = 0.75;
    controls.target.copy(initialCameraTarget);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1);
    scene.add(dirLight);

    orientationWidget = new ViewportOrientationWidget({
      container: viewer,
      THREE,
      camera,
      controls,
      viewAdapter: {
        getCamera: () => camera,
        getControls: () => controls,
        getViewportElement: () => viewer,
        requestRender: () => {
          renderer.render(scene, camera);
          return true;
        },
      },
    });
    orientationWidget.mount();

    resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    if (resizeObserver) resizeObserver.observe(viewer);
    else window.addEventListener("resize", resize);

    resetViewBtn.onclick = () => {
      if (compiledModel) fitCameraToObject(compiledModel);
      else {
        camera.position.copy(initialCameraPosition);
        controls.target.copy(initialCameraTarget);
        controls.update();
      }
      orientationWidget?.sync?.();
    };

    animate();
  }

  panel._dispose = disposeViewer;

  try {
    const response = await fetch(scadViewerUrl(resolvedPath, serverBase), { cache: "no-store" });
    if (disposed) return true;
    if (!response.ok) throw new Error("HTTP " + String(response.status));
    scadText = await response.text();
    if (disposed) return true;
    codePre.textContent = scadText;
    setupScene();
    const sourcePreview = buildApproximateModelFromScad(scadText);
    const hasSourcePreview = setSourceModel(sourcePreview);
    const objectTypes = sourcePreview?.userData?.objectTypes?.join(", ") || "none";
    const previewNote = sourcePreview?.userData?.previewNote ? "; " + sourcePreview.userData.previewNote : "";
    diagnostic.textContent = "fetched " + String(scadText.length) + " chars; parsed " + objectTypes + previewNote;

    if (hasSourcePreview) {
      loading.textContent = "Rendering exact SCAD...";
      try {
        const stlBuffer = await renderScadCodeToSTLBuffer(scadText);
        if (disposed) return true;
        setCompiledSTL(stlBuffer);
        diagnostic.textContent = "fetched " + String(scadText.length) + " chars; exact STL";
      } catch (err) {
        console.warn("[ViewSCAD] Exact render failed; keeping source preview:", err);
        diagnostic.textContent = "fetched " + String(scadText.length) + " chars; preview " + objectTypes + previewNote;
      } finally {
        loading.remove();
      }
    } else {
      loading.textContent = "Rendering SCAD...";
      const stlBuffer = await renderScadCodeToSTLBuffer(scadText);
      if (disposed) return true;
      setCompiledSTL(stlBuffer);
      diagnostic.textContent = "fetched " + String(scadText.length) + " chars; exact STL";
      loading.remove();
    }

    exportToken = Symbol("nv-scad-viewer-export-context");
    window.NodevisionModelExportContext = {
      token: exportToken,
      kind: "scad-viewer",
      filePath: resolvedPath,
      exportSTL: () => exportScadCodeToSTL(scadText, resolvedPath),
    };
    updateToolbarState({ currentMode: "SCADviewing", activePanelType: "ViewPanel", selectedFile: resolvedPath, modelCanExportSTL: true });

  } catch (err) {
    if (disposed) return true;
    console.error("[ViewSCAD] Error:", err);
    const renderedSource = !!String(scadText || "").trim();
    const hasVisiblePreview = !!compiledModel;
    if (hasVisiblePreview) loading.remove();
    else loading.textContent = renderedSource ? "SCAD render failed." : "SCAD load failed.";
    const error = document.createElement("div");
    error.style.cssText = "position:absolute;left:10px;bottom:10px;max-width:80%;z-index:3;color:#fff;background:rgba(176,0,32,0.9);padding:8px 10px;border-radius:4px;font:12px system-ui,sans-serif;";
    error.textContent = "Error " + (renderedSource ? "rendering" : "loading") + " SCAD file: " + String(err?.message || err);
    viewer.appendChild(error);
  }

  return true;
}
