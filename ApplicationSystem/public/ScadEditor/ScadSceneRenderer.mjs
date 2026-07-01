// Nodevision/ApplicationSystem/public/ScadEditor/ScadSceneRenderer.mjs
// Three.js approximate preview adapter for graphical SCAD models.

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

export async function createScadSceneRenderer(container, options = {}) {
  const THREE = await import("/lib/three/three.module.js");
  container.innerHTML = "";
  container.style.position = container.style.position || "relative";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f8fb);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
  camera.position.set(90, -120, 120);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  scene.add(new THREE.GridHelper(160, 16, 0xb8c1cc, 0xe1e5eb));
  scene.add(new THREE.AxesHelper(60));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b96a8, 1.7));
  const group = new THREE.Group();
  scene.add(group);
  let selectedId = null;
  let pickHandler = null;
  let modelRef = null;
  const raycaster = new THREE.Raycaster();
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
      const shape = shapeForObject(THREE, obj);
      if (!shape) continue;
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: objectHeight(obj), bevelEnabled: false });
      const color = obj.id === selectedId ? selectedColor : new THREE.Color(layer.color || "#4f8cff");
      const opacity = layer.locked ? 0.42 : 0.78;
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
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  }
  animate();

  renderer.domElement.addEventListener("pointerdown", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(group.children, false);
    const id = hits[0]?.object?.userData?.objectId || null;
    if (id) pickHandler?.(id, event);
  });

  window.addEventListener("resize", resize);
  resize();

  return {
    domElement: renderer.domElement,
    renderModel,
    setSelectedId(id) { selectedId = id; if (modelRef) renderModel(modelRef); },
    setPickHandler(fn) { pickHandler = typeof fn === "function" ? fn : null; },
    dispose() { window.removeEventListener("resize", resize); cancelAnimationFrame(animationFrame); clearGroup(); renderer.dispose?.(); container.innerHTML = ""; },
  };
}
