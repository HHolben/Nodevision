// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationColliderTool.mjs
// Shared helpers and insertion controller for mathematical collider objects.

function parseNumber(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizePlaneEquationConfig(raw = {}) {
  let a = parseNumber(raw.a, 0);
  let b = parseNumber(raw.b, 1);
  let c = parseNumber(raw.c, 0);
  const d = parseNumber(raw.d, 0);
  if (Math.hypot(a, b, c) < 0.000001) {
    a = 0;
    b = 1;
    c = 0;
  }
  return {
    kind: "plane",
    a,
    b,
    c,
    d,
    xmin: parseNumber(raw.xmin, Number.isFinite(Number(raw.size)) ? -Math.abs(Number(raw.size)) / 2 : -15),
    xmax: parseNumber(raw.xmax, Number.isFinite(Number(raw.size)) ? Math.abs(Number(raw.size)) / 2 : 15),
    ymin: parseNumber(raw.ymin, -15),
    ymax: parseNumber(raw.ymax, 15),
    zmin: parseNumber(raw.zmin, Number.isFinite(Number(raw.size)) ? -Math.abs(Number(raw.size)) / 2 : -15),
    zmax: parseNumber(raw.zmax, Number.isFinite(Number(raw.size)) ? Math.abs(Number(raw.size)) / 2 : 15),
    thickness: Math.max(0.02, parseNumber(raw.thickness, 0.2))
  };
}

export function getPlaneConstraintExtent(config) {
  const sx = Math.abs((config.xmax ?? 15) - (config.xmin ?? -15));
  const sy = Math.abs((config.ymax ?? 15) - (config.ymin ?? -15));
  const sz = Math.abs((config.zmax ?? 15) - (config.zmin ?? -15));
  return Math.max(1, sx, sy, sz);
}

export function pointWithinPlaneConstraints(config, point, padding = 0) {
  if (!config || !point) return false;
  return point.x >= Math.min(config.xmin, config.xmax) - padding
    && point.x <= Math.max(config.xmin, config.xmax) + padding
    && point.y >= Math.min(config.ymin, config.ymax) - padding
    && point.y <= Math.max(config.ymin, config.ymax) + padding
    && point.z >= Math.min(config.zmin, config.zmax) - padding
    && point.z <= Math.max(config.zmin, config.zmax) + padding;
}

export function applyPlaneEquationToMesh(THREE, mesh, rawConfig = {}) {
  if (!THREE || !mesh) return null;
  const config = normalizePlaneEquationConfig(rawConfig);
  const normal = new THREE.Vector3(config.a, config.b, config.c);
  const normalLength = Math.max(0.000001, normal.length());
  normal.divideScalar(normalLength);
  const point = normal.clone().multiplyScalar(-config.d / normalLength);

  mesh.position.copy(point);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  mesh.scale.set(1, 1, 1);
  mesh.userData.equationCollider = config;
  return config;
}

export function makePlaneColliderRef(THREE, mesh, rawConfig = mesh?.userData?.equationCollider || {}) {
  const config = normalizePlaneEquationConfig(rawConfig);
  return {
    type: "equation-plane",
    target: mesh || null,
    equation: config,
    thickness: config.thickness,
    normal: THREE ? new THREE.Vector3(config.a, config.b, config.c).normalize() : null
  };
}

export function syncPlaneColliderRef(THREE, mesh) {
  const ref = mesh?.userData?.colliderRef;
  if (!ref || ref.type !== "equation-plane") return;
  const config = normalizePlaneEquationConfig(mesh.userData?.equationCollider || {});
  ref.equation = config;
  ref.thickness = config.thickness;
  ref.target = mesh;
  if (THREE) ref.normal = new THREE.Vector3(config.a, config.b, config.c).normalize();
}

export function getPlaneRayIntersection(THREE, mesh, ray, minDistance = 0.05) {
  if (!THREE || !mesh || !ray) return null;
  const config = normalizePlaneEquationConfig(mesh.userData?.equationCollider || {});
  const normal = new THREE.Vector3(config.a, config.b, config.c);
  const normalLength = normal.length();
  if (normalLength < 0.000001) return null;
  const denom = normal.dot(ray.direction);
  if (Math.abs(denom) < 0.000001) return null;
  const distance = -(normal.dot(ray.origin) + config.d) / denom;
  if (!Number.isFinite(distance) || distance < minDistance) return null;
  const point = ray.origin.clone().add(ray.direction.clone().multiplyScalar(distance));
  if (!pointWithinPlaneConstraints(config, point)) return null;
  return {
    object: mesh,
    distance,
    point,
    face: { normal: normal.divideScalar(normalLength) },
    equationColliderHit: true
  };
}

export function createEquationColliderPlaneMesh(THREE, rawConfig = {}, materialOptions = {}) {
  const config = normalizePlaneEquationConfig(rawConfig);
  const material = new THREE.MeshStandardMaterial({
    color: materialOptions.color || "#61d6d6",
    transparent: true,
    opacity: Number.isFinite(materialOptions.opacity) ? materialOptions.opacity : 0.34,
    depthWrite: false,
    emissive: materialOptions.emissive || "#113838",
    emissiveIntensity: Number.isFinite(materialOptions.emissiveIntensity) ? materialOptions.emissiveIntensity : 0.18,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(getPlaneConstraintExtent(config), config.thickness, getPlaneConstraintExtent(config)),
    material
  );
  mesh.name = "Equation Object Plane";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.nvType = "equation-collider-plane";
  mesh.userData.isSolid = true;
  mesh.userData.physicsEnabled = true;
  mesh.userData.breakable = false;
  applyPlaneEquationToMesh(THREE, mesh, config);
  return mesh;
}

export function resizeEquationColliderPlaneMesh(THREE, mesh, rawConfig = {}) {
  if (!THREE || !mesh) return null;
  const config = normalizePlaneEquationConfig(rawConfig);
  if (mesh.geometry?.dispose) mesh.geometry.dispose();
  mesh.geometry = new THREE.BoxGeometry(getPlaneConstraintExtent(config), config.thickness, getPlaneConstraintExtent(config));
  return applyPlaneEquationToMesh(THREE, mesh, config);
}

export function createEquationColliderController({ THREE, scene, objects, colliders }) {
  function addPlane(rawConfig = {}) {
    if (!THREE || !scene || !objects || !colliders) return null;
    const mesh = createEquationColliderPlaneMesh(THREE, rawConfig, rawConfig);
    const colliderEnabled = rawConfig.collider !== false;
    mesh.userData.isSolid = colliderEnabled;
    mesh.userData.physicsEnabled = colliderEnabled;
    scene.add(mesh);
    objects.push(mesh);
    if (colliderEnabled) {
      const colliderRef = makePlaneColliderRef(THREE, mesh);
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }
    return mesh;
  }

  return { addPlane };
}
