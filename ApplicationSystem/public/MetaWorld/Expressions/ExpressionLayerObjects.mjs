// Nodevision/ApplicationSystem/public/MetaWorld/Expressions/ExpressionLayerObjects.mjs
// This module converts MetaWorld expression layer data into Three.js objects. The renderer rebuilds generated geometry and reports expression errors without crashing the editor.

import { parseExpressionLayerExpression } from "./ExpressionParser.mjs";

const DEFAULT_DOMAIN = {
  x: [-10, 10],
  y: [-10, 10],
  t: [0, Math.PI * 6],
  resolution: 80,
};

function clampNumber(value, fallback, min = -Infinity, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readRange(value, fallback) {
  if (!Array.isArray(value) || value.length < 2) return [...fallback];
  const a = clampNumber(value[0], fallback[0]);
  const b = clampNumber(value[1], fallback[1]);
  return a === b ? [...fallback] : [Math.min(a, b), Math.max(a, b)];
}

export function createDefaultExpressionLayer(overrides = {}) {
  const id = overrides.id || `expr_surface_${Date.now().toString(36)}`;
  return {
    id,
    type: overrides.type || "functionSurface",
    name: overrides.name || "Expression Surface",
    visible: overrides.visible !== false,
    locked: overrides.locked === true,
    expression: overrides.expression || "z = sin(x) * cos(y)",
    domain: {
      x: readRange(overrides.domain?.x, DEFAULT_DOMAIN.x),
      y: readRange(overrides.domain?.y, DEFAULT_DOMAIN.y),
      t: readRange(overrides.domain?.t, DEFAULT_DOMAIN.t),
      resolution: clampNumber(overrides.domain?.resolution, DEFAULT_DOMAIN.resolution, 8, 160),
    },
    material: {
      color: overrides.material?.color || "#44aa88",
      wireframe: overrides.material?.wireframe === true,
    },
    collider: {
      enabled: overrides.collider?.enabled === true,
      type: overrides.collider?.type || "none",
    },
    position: Array.isArray(overrides.position) ? overrides.position.slice(0, 3) : [0, 0, 0],
  };
}

export function normalizeExpressionLayer(layer = {}) {
  return createDefaultExpressionLayer(layer);
}

function createMaterial(THREE, layer) {
  return new THREE.MeshStandardMaterial({
    color: layer.material?.color || "#44aa88",
    wireframe: layer.material?.wireframe === true,
    side: THREE.DoubleSide,
    roughness: 0.64,
    metalness: 0.04,
  });
}

function createSurfaceObject(THREE, layer, parsed) {
  const domain = layer.domain || {};
  const [xMin, xMax] = readRange(domain.x, DEFAULT_DOMAIN.x);
  const [yMin, yMax] = readRange(domain.y, DEFAULT_DOMAIN.y);
  const resolution = Math.floor(clampNumber(domain.resolution, DEFAULT_DOMAIN.resolution, 8, 160));
  const positions = [];
  const indices = [];

  for (let yi = 0; yi <= resolution; yi += 1) {
    const y = yMin + ((yMax - yMin) * yi) / resolution;
    for (let xi = 0; xi <= resolution; xi += 1) {
      const x = xMin + ((xMax - xMin) * xi) / resolution;
      let z = parsed.compiler.evaluate({ x, y, z: 0, t: 0, time: 0 });
      if (!Number.isFinite(z)) z = 0;
      positions.push(x, z, y);
    }
  }

  const stride = resolution + 1;
  for (let yi = 0; yi < resolution; yi += 1) {
    for (let xi = 0; xi < resolution; xi += 1) {
      const a = yi * stride + xi;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, createMaterial(THREE, layer));
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function createCurveObject(THREE, layer, parsed) {
  const domain = layer.domain || {};
  const [xMin, xMax] = readRange(domain.x, DEFAULT_DOMAIN.x);
  const resolution = Math.floor(clampNumber(domain.resolution, DEFAULT_DOMAIN.resolution, 8, 240));
  const points = [];
  for (let i = 0; i <= resolution; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / resolution;
    const y = parsed.compiler.evaluate({ x, y: 0, z: 0, t: 0, time: 0 });
    if (Number.isFinite(y)) points.push(new THREE.Vector3(x, y, 0));
  }
  if (points.length < 2) throw new Error("Curve produced fewer than two finite points.");
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, Math.max(8, points.length - 1), 0.045, 10, false);
  return new THREE.Mesh(geometry, createMaterial(THREE, layer));
}

function createParametricCurveObject(THREE, layer, parsed) {
  const domain = layer.domain || {};
  const [tMin, tMax] = readRange(domain.t, DEFAULT_DOMAIN.t);
  const resolution = Math.floor(clampNumber(domain.resolution, DEFAULT_DOMAIN.resolution, 8, 240));
  const points = [];
  for (let i = 0; i <= resolution; i += 1) {
    const t = tMin + ((tMax - tMin) * i) / resolution;
    const x = parsed.compilers.x.evaluate({ x: 0, y: 0, z: 0, t, time: 0 });
    const y = parsed.compilers.y.evaluate({ x: 0, y: 0, z: 0, t, time: 0 });
    const z = parsed.compilers.z.evaluate({ x: 0, y: 0, z: 0, t, time: 0 });
    if ([x, y, z].every(Number.isFinite)) points.push(new THREE.Vector3(x, z, y));
  }
  if (points.length < 2) throw new Error("Parametric curve produced fewer than two finite points.");
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, Math.max(8, points.length - 1), 0.045, 10, false);
  return new THREE.Mesh(geometry, createMaterial(THREE, layer));
}

export function disposeExpressionObject(object3d) {
  if (!object3d) return;
  object3d.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((mat) => mat?.dispose?.());
    else node.material?.dispose?.();
  });
  object3d.geometry?.dispose?.();
  if (Array.isArray(object3d.material)) object3d.material.forEach((mat) => mat?.dispose?.());
  else object3d.material?.dispose?.();
}

export function createExpressionLayerObject(THREE, rawLayer = {}) {
  const layer = normalizeExpressionLayer(rawLayer);
  const parsed = parseExpressionLayerExpression(layer.expression);
  layer.type = parsed.kind;
  let object3d = null;
  if (parsed.kind === "functionSurface") object3d = createSurfaceObject(THREE, layer, parsed);
  else if (parsed.kind === "functionCurve") object3d = createCurveObject(THREE, layer, parsed);
  else if (parsed.kind === "parametricCurve") object3d = createParametricCurveObject(THREE, layer, parsed);
  else throw new Error(`Unsupported expression layer kind ${parsed.kind}`);

  object3d.name = layer.name || layer.id;
  object3d.position.set(...(Array.isArray(layer.position) ? layer.position : [0, 0, 0]));
  object3d.visible = layer.visible !== false;
  object3d.userData.nvType = layer.type;
  object3d.userData.metaWorldExpressionLayer = true;
  object3d.userData.expressionLayerId = layer.id;
  object3d.userData.isSolid = layer.collider?.enabled === true;
  object3d.userData.breakable = layer.locked !== true;
  object3d.userData.placedByPlayer = true;
  layer.error = "";
  return { object3d, layer, parsedKind: parsed.kind };
}
