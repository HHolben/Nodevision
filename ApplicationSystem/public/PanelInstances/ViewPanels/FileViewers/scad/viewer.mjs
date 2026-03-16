// Nodevision SCAD Editor - viewer.mjs
// Purpose: Three.js viewer + STL preview loading + basic placeholder render from scene tree.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { STLLoader } from "/lib/three/STLLoader.js";

import { evaluateScalar, evaluateVector, kindOfType, NODE_KINDS, NODE_TYPES } from "./sceneTree.mjs";

function disposeObject3D(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose?.();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) m.dispose?.();
    }
  });
}

function setWireframe(obj, enabled) {
  obj.traverse((child) => {
    if (!child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if ("wireframe" in m) m.wireframe = !!enabled;
    }
  });
}

function degreesToRadiansVec(v) {
  return [v[0] * (Math.PI / 180), v[1] * (Math.PI / 180), v[2] * (Math.PI / 180)];
}

function applyNodeTransform(obj, node, parameters) {
  const p = node.parameters || {};
  switch (node.type) {
    case NODE_TYPES.translate: {
      const v = Array.isArray(p.v) ? p.v : p.v ?? p.vec ?? p.xyz ?? [0, 0, 0];
      const vec = Array.isArray(v) ? v : String(v);
      const out = Array.isArray(vec) ? vec : evaluateVector(vec, parameters, [0, 0, 0]);
      obj.position.set(out[0], out[1], out[2]);
      break;
    }
    case NODE_TYPES.rotate: {
      const a = p.a ?? p.angles ?? p.xyz ?? [0, 0, 0];
      const vec = Array.isArray(a) ? a : evaluateVector(String(a), parameters, [0, 0, 0]);
      const r = degreesToRadiansVec(vec);
      obj.rotation.set(r[0], r[1], r[2]);
      break;
    }
    case NODE_TYPES.scale: {
      const v = p.v ?? p.vec ?? [1, 1, 1];
      const vec = Array.isArray(v) ? v : evaluateVector(String(v), parameters, [1, 1, 1]);
      obj.scale.set(vec[0], vec[1], vec[2]);
      break;
    }
    case NODE_TYPES.mirror: {
      const v = p.v ?? p.vec ?? [1, 0, 0];
      const vec = Array.isArray(v) ? v : evaluateVector(String(v), parameters, [1, 0, 0]);
      const sx = vec[0] ? -1 : 1;
      const sy = vec[1] ? -1 : 1;
      const sz = vec[2] ? -1 : 1;
      obj.scale.set(sx, sy, sz);
      break;
    }
    default:
      break;
  }
}

function meshForPrimitive(node, parameters) {
  const p = node.parameters || {};

  const standard = (color) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.85 });

  switch (node.type) {
    case NODE_TYPES.cube: {
      const size = p.size ?? p.v ?? [10, 10, 10];
      const vec = Array.isArray(size) ? size : evaluateVector(String(size), parameters, [10, 10, 10]);
      const geom = new THREE.BoxGeometry(vec[0], vec[1], vec[2]);
      return new THREE.Mesh(geom, standard(0x1976d2));
    }
    case NODE_TYPES.sphere: {
      const r = p.r ?? p.radius ?? 10;
      const rr = typeof r === "number" ? r : evaluateScalar(String(r), parameters);
      const geom = new THREE.SphereGeometry(Math.max(0.001, rr), 28, 18);
      return new THREE.Mesh(geom, standard(0x8e24aa));
    }
    case NODE_TYPES.cylinder: {
      const h = p.h ?? p.height ?? 10;
      const r = p.r ?? p.radius ?? 5;
      const hh = typeof h === "number" ? h : evaluateScalar(String(h), parameters);
      const rr = typeof r === "number" ? r : evaluateScalar(String(r), parameters);
      const geom = new THREE.CylinderGeometry(Math.max(0.001, rr), Math.max(0.001, rr), Math.max(0.001, hh), 32);
      // OpenSCAD cylinder axis is Z; Three's is Y.
      geom.rotateX(Math.PI / 2);
      return new THREE.Mesh(geom, standard(0xff7043));
    }
    default: {
      const geom = new THREE.BoxGeometry(5, 5, 5);
      return new THREE.Mesh(geom, standard(0x616161));
    }
  }
}

function buildApproximateGroup(sceneTree, parameters = {}) {
  const root = new THREE.Group();

  function walk(node, parent) {
    const kind = kindOfType(node.type);
    if (kind === NODE_KINDS.primitive) {
      const mesh = meshForPrimitive(node, parameters);
      mesh.name = node.id || node.type;
      parent.add(mesh);
      return;
    }

    const group = new THREE.Group();
    group.name = node.id || node.type;
    applyNodeTransform(group, node, parameters);

    // Hint booleans by tinting group children wireframe when difference/intersection.
    if (node.type === NODE_TYPES.difference) {
      group.userData.booleanHint = "difference";
    } else if (node.type === NODE_TYPES.intersection) {
      group.userData.booleanHint = "intersection";
    }

    parent.add(group);
    for (const child of node.children || []) walk(child, group);
  }

  walk(sceneTree, root);
  return root;
}

export function createSCADViewer(containerEl, opts = {}) {
  const width = containerEl.clientWidth || 640;
  const height = containerEl.clientHeight || 400;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
  camera.position.set(140, 140, 140);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  containerEl.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.GridHelper(120, 24));
  scene.add(new THREE.AxesHelper(60));
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75);
  dl.position.set(1, 1, 1);
  scene.add(dl);

  const loader = new STLLoader();

  let currentObject = null;
  let wireframeEnabled = false;
  let pickHandler = null;
  let selectedId = null;

  /** @type {Set<THREE.Material>} */
  const highlightedMaterials = new Set();

  function clearHighlight() {
    for (const mat of highlightedMaterials) {
      const prev = mat.userData?.__nvPrevEmissive;
      if (prev !== undefined && mat.emissive) mat.emissive.setHex(prev);
      const prevIntensity = mat.userData?.__nvPrevEmissiveIntensity;
      if (prevIntensity !== undefined) mat.emissiveIntensity = prevIntensity;
    }
    highlightedMaterials.clear();
  }

  function highlightObject(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat || !("emissive" in mat)) continue;
        if (!mat.userData) mat.userData = {};
        if (mat.userData.__nvPrevEmissive === undefined) {
          mat.userData.__nvPrevEmissive = mat.emissive?.getHex?.() ?? 0x000000;
          mat.userData.__nvPrevEmissiveIntensity = mat.emissiveIntensity ?? 1;
        }
        mat.emissive?.setHex?.(0xffd54f);
        mat.emissiveIntensity = 0.55;
        highlightedMaterials.add(mat);
      }
    });
  }

  function setSelectedId(id) {
    selectedId = id || null;
    clearHighlight();
    if (!currentObject || !selectedId) return;
    let hit = null;
    currentObject.traverse((child) => {
      if (hit) return;
      if (child.name === selectedId) hit = child;
    });
    if (hit) highlightObject(hit);
  }

  function fitToObject(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 1.6;

    controls.target.copy(center);
    camera.position.set(center.x + dist, center.y + dist, center.z + dist);
    camera.near = Math.max(0.1, maxDim / 2000);
    camera.far = Math.max(2000, maxDim * 50);
    camera.updateProjectionMatrix();
    controls.update();
  }

  function setObject(obj, { fit = true } = {}) {
    if (currentObject) {
      scene.remove(currentObject);
      disposeObject3D(currentObject);
    }
    currentObject = obj;
    if (!currentObject) return;
    setWireframe(currentObject, wireframeEnabled);
    scene.add(currentObject);
    setSelectedId(selectedId);
    if (fit) fitToObject(currentObject);
  }

  function setWireframeEnabled(enabled) {
    wireframeEnabled = !!enabled;
    if (currentObject) setWireframe(currentObject, wireframeEnabled);
  }

  async function setSTLArrayBuffer(arrayBuffer, { fit = true } = {}) {
    const geom = loader.parse(arrayBuffer);
    geom.computeVertexNormals?.();
    // STL comes in as Y-up; OpenSCAD is Z-up. This tends to match already in many setups,
    // but we keep as-is; user can orbit.
    const mat = new THREE.MeshStandardMaterial({
      color: 0x455a64,
      metalness: 0.2,
      roughness: 0.8,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = "stl";
    setObject(mesh, { fit });
  }

  function setApproximateFromTree(sceneTree, parameters, { fit = true } = {}) {
    const group = buildApproximateGroup(sceneTree, parameters);
    setObject(group, { fit });
  }

  function setPickHandler(fn) {
    pickHandler = typeof fn === "function" ? fn : null;
  }

  // Picking (approximate mode: meshes are named with node ids)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.addEventListener("pointerdown", (ev) => {
    if (!pickHandler) return;
    if (!currentObject) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObject(currentObject, true);
    const hit = intersects.find((i) => i.object?.isMesh && i.object?.name);
    if (!hit) return;
    const id = hit.object.name;
    if (id === "stl") return;
    pickHandler(id);
  });

  const resizeObserver = new ResizeObserver(() => {
    const w = containerEl.clientWidth || 1;
    const h = containerEl.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(containerEl);

  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function dispose() {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    controls.dispose();
    if (currentObject) {
      scene.remove(currentObject);
      disposeObject3D(currentObject);
    }
    clearHighlight();
    renderer.dispose();
    containerEl.innerHTML = "";
  }

  if (opts.initialTree) setApproximateFromTree(opts.initialTree, opts.initialParameters || {});

  return {
    scene,
    camera,
    renderer,
    controls,
    setWireframeEnabled,
    setSTLArrayBuffer,
    setApproximateFromTree,
    fitToObject,
    setPickHandler,
    setSelectedId,
    dispose,
  };
}
