// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationColliderTool.mjs
// Shared helpers and insertion controller for mathematical collider objects.

import {
  DEFAULT_WORLD_OBJECT_MATERIAL_ID,
  materialFileForWorldObjectMaterial,
  readWorldObjectMatterState,
  readWorldObjectPhysicsMaterialId,
} from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { compileMathExpression } from "/MetaWorld/Expressions/ExpressionParser.mjs";

function parseNumber(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

const EPSILON = 0.000001;
const INFINITE_VISUAL_EXTENT = 2000;

function isIdentifierChar(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || ch === "_";
}

export function expressionUsesTimeVariable(expression = "") {
  const source = String(expression || "").toLowerCase();
  let token = "";
  const flush = () => {
    const match = token === "t" || token === "time";
    token = "";
    return match;
  };
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (isIdentifierChar(ch)) {
      token += ch;
    } else if (flush()) {
      return true;
    }
  }
  return flush();
}

function findTopLevelComparison(source = "") {
  let depth = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    const pair = source.slice(i, i + 2);
    if (pair === "<=" || pair === ">=") return { index: i, operator: pair };
    if (ch === "<" || ch === ">" || ch === "=") return { index: i, operator: ch };
  }
  return null;
}

function evaluateAxisLimitExpression(expression, timeSeconds = 0) {
  const compiler = compileMathExpression(expression, ["x", "y", "z", "t", "time"]);
  const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  const value = compiler.evaluate({ x: 0, y: 0, z: 0, t, time: t });
  return Number.isFinite(value) ? value : NaN;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function readAxisBound(raw, axis) {
  const upper = axis.toUpperCase();
  const camel = "bound" + upper;
  const useKey = "use" + upper + "Bounds";
  const boundedKey = axis + "Bounded";
  if (hasOwn(raw, camel)) return raw[camel] === true;
  if (hasOwn(raw, useKey)) return raw[useKey] === true;
  if (hasOwn(raw, boundedKey)) return raw[boundedKey] === true;
  const bounds = raw?.bounds && typeof raw.bounds === "object" ? raw.bounds : null;
  if (bounds && hasOwn(bounds, axis)) return bounds[axis] === true;
  if (hasOwn(raw, "size")) return true;
  return hasOwn(raw, axis + "min") || hasOwn(raw, axis + "max");
}

function axisBoundEnabled(config, axis) {
  return config?.["bound" + axis.toUpperCase()] === true;
}

function readAxisRange(config, axis) {
  const minKey = axis + "min";
  const maxKey = axis + "max";
  if (axisBoundEnabled(config, axis)) {
    return [Math.min(config[minKey], config[maxKey]), Math.max(config[minKey], config[maxKey])];
  }
  return [-INFINITE_VISUAL_EXTENT / 2, INFINITE_VISUAL_EXTENT / 2];
}

function normalizeInequalityOperator(value) {
  const op = String(value || "").trim().toLowerCase();
  if (["<", "<=", "lt", "lte"].includes(op)) return op === "<=" || op === "lte" ? "<=" : "<";
  if ([">", ">=", "gt", "gte"].includes(op)) return op === ">=" || op === "gte" ? ">=" : ">";
  return "";
}

function sideFromOperator(operator, fallback = "") {
  const op = normalizeInequalityOperator(operator);
  if (op.startsWith(">")) return "positive";
  if (op.startsWith("<")) return "negative";
  return fallback || "";
}

export function isEquationInequalityConfig(raw = {}) {
  return raw?.inequality === true
    || raw?.filledVolume === true
    || String(raw?.kind || "").toLowerCase().includes("inequality")
    || Boolean(normalizeInequalityOperator(raw?.operator || raw?.inequalityOperator || raw?.comparison));
}

export function parseAxisInequalityText(text, options = {}) {
  const source = String(text || "").trim();
  if (!source) return null;
  const comparison = findTopLevelComparison(source);
  if (!comparison) return null;
  const axis = source.slice(0, comparison.index).trim().toLowerCase();
  const rhsExpression = source.slice(comparison.index + comparison.operator.length).trim();
  if (!["x", "y", "z"].includes(axis) || !rhsExpression) return null;
  const timeSeconds = Number.isFinite(options?.timeSeconds) ? options.timeSeconds : 0;
  let limit = NaN;
  try {
    limit = evaluateAxisLimitExpression(rhsExpression, timeSeconds);
  } catch (_) {
    return null;
  }
  if (!Number.isFinite(limit)) return null;
  const operator = comparison.operator;
  const temporal = expressionUsesTimeVariable(rhsExpression);
  const side = sideFromOperator(operator, "negative");
  return {
    axis,
    limit,
    expression: source,
    rhsExpression,
    temporalExpression: temporal ? rhsExpression : "",
    equationTemporal: temporal,
    timeSeconds,
    operator,
    a: axis === "x" ? 1 : 0,
    b: axis === "y" ? 1 : 0,
    c: axis === "z" ? 1 : 0,
    d: -limit,
    liquidSide: side,
    waterSide: side,
    inequalitySide: side,
    inequality: operator !== "="
  };
}

export function normalizePlaneEquationConfig(raw = {}) {
  const expression = typeof raw.expression === "string" && raw.expression.trim()
    ? raw.expression.trim()
    : (typeof raw.equationExpression === "string" && raw.equationExpression.trim() ? raw.equationExpression.trim() : "");
  const parsedExpression = parseAxisInequalityText(expression);
  const temporal = raw.equationTemporal === true || parsedExpression?.equationTemporal === true || expressionUsesTimeVariable(expression);
  const timeSeconds = Number.isFinite(raw.timeSeconds) ? raw.timeSeconds : (Number.isFinite(raw.equationTimeSeconds) ? raw.equationTimeSeconds : 0);
  const hasExplicitCoefficients = hasOwn(raw, "a") || hasOwn(raw, "b") || hasOwn(raw, "c") || hasOwn(raw, "d");
  let a = parseNumber(raw.a, parsedExpression && !hasExplicitCoefficients ? parsedExpression.a : 0);
  let b = parseNumber(raw.b, parsedExpression && !hasExplicitCoefficients ? parsedExpression.b : 1);
  let c = parseNumber(raw.c, parsedExpression && !hasExplicitCoefficients ? parsedExpression.c : 0);
  let d = parseNumber(raw.d, parsedExpression && !hasExplicitCoefficients ? parsedExpression.d : 0);
  const operator = normalizeInequalityOperator(raw.operator || raw.inequalityOperator || raw.comparison || (parsedExpression?.inequality ? parsedExpression.operator : ""));
  const inequality = isEquationInequalityConfig(raw) || parsedExpression?.inequality === true;
  const side = raw.inequalitySide || raw.liquidSide || raw.equationLiquidSide || raw.waterSide || raw.equationWaterSide || parsedExpression?.inequalitySide || sideFromOperator(operator, "negative");
  if (Math.hypot(a, b, c) < 0.000001) {
    a = 0;
    b = 1;
    c = 0;
  }
  return {
    kind: inequality ? "plane-inequality" : "plane",
    a,
    b,
    c,
    d,
    inequality,
    operator,
    inequalitySide: side === "positive" ? "positive" : "negative",
    expression,
    equationTemporal: temporal,
    equationBaseExpression: raw.equationBaseExpression || raw.baseExpression || (temporal ? expression : ""),
    temporalExpression: parsedExpression?.temporalExpression || "",
    timeSeconds,
    boundX: readAxisBound(raw, "x"),
    boundY: readAxisBound(raw, "y"),
    boundZ: readAxisBound(raw, "z"),
    xmin: parseNumber(raw.xmin, Number.isFinite(Number(raw.size)) ? -Math.abs(Number(raw.size)) / 2 : -15),
    xmax: parseNumber(raw.xmax, Number.isFinite(Number(raw.size)) ? Math.abs(Number(raw.size)) / 2 : 15),
    ymin: parseNumber(raw.ymin, -15),
    ymax: parseNumber(raw.ymax, 15),
    zmin: parseNumber(raw.zmin, Number.isFinite(Number(raw.size)) ? -Math.abs(Number(raw.size)) / 2 : -15),
    zmax: parseNumber(raw.zmax, Number.isFinite(Number(raw.size)) ? Math.abs(Number(raw.size)) / 2 : 15),
    thickness: Math.max(0.02, parseNumber(raw.thickness, 0.2))
  };
}

export function resolveTemporalPlaneEquationConfig(raw = {}, timeSeconds = 0) {
  const sampleTime = Number.isFinite(timeSeconds)
    ? timeSeconds
    : (Number.isFinite(raw?.timeSeconds) ? raw.timeSeconds : (Number.isFinite(raw?.equationTimeSeconds) ? raw.equationTimeSeconds : 0));
  const base = normalizePlaneEquationConfig({ ...(raw || {}), timeSeconds: sampleTime });
  const expression = base.expression || raw?.equationExpression || raw?.expression || "";
  const parsed = expression ? parseAxisInequalityText(expression, { timeSeconds: sampleTime }) : null;
  const temporal = base.equationTemporal === true || parsed?.equationTemporal === true || expressionUsesTimeVariable(expression);
  if (!parsed || !temporal) {
    return { ...base, equationTemporal: temporal, timeSeconds: sampleTime };
  }
  const inequality = base.inequality === true || parsed.inequality === true;
  const side = raw?.inequalitySide || raw?.liquidSide || raw?.equationLiquidSide || raw?.waterSide || raw?.equationWaterSide || base.inequalitySide || parsed.inequalitySide || "negative";
  return {
    ...base,
    kind: inequality ? "plane-inequality" : "plane",
    a: parsed.a,
    b: parsed.b,
    c: parsed.c,
    d: parsed.d,
    inequality,
    operator: base.operator || parsed.operator,
    inequalitySide: side === "positive" ? "positive" : "negative",
    expression: parsed.expression,
    equationTemporal: true,
    equationBaseExpression: base.equationBaseExpression || parsed.expression,
    temporalExpression: parsed.temporalExpression || parsed.rhsExpression || "",
    timeSeconds: sampleTime
  };
}

export function getPlaneConstraintExtent(config) {
  const sx = axisBoundEnabled(config, "x") ? Math.abs((config.xmax ?? 15) - (config.xmin ?? -15)) : INFINITE_VISUAL_EXTENT;
  const sy = axisBoundEnabled(config, "y") ? Math.abs((config.ymax ?? 15) - (config.ymin ?? -15)) : INFINITE_VISUAL_EXTENT;
  const sz = axisBoundEnabled(config, "z") ? Math.abs((config.zmax ?? 15) - (config.zmin ?? -15)) : INFINITE_VISUAL_EXTENT;
  return Math.max(1, sx, sy, sz);
}

export function pointWithinPlaneConstraints(config, point, padding = 0) {
  if (!config || !point) return false;
  if (axisBoundEnabled(config, "x") && (point.x < Math.min(config.xmin, config.xmax) - padding || point.x > Math.max(config.xmin, config.xmax) + padding)) return false;
  if (axisBoundEnabled(config, "y") && (point.y < Math.min(config.ymin, config.ymax) - padding || point.y > Math.max(config.ymin, config.ymax) + padding)) return false;
  if (axisBoundEnabled(config, "z") && (point.z < Math.min(config.zmin, config.zmax) - padding || point.z > Math.max(config.zmin, config.zmax) + padding)) return false;
  return true;
}

function isPointInsideInequality(config, point) {
  const value = planeValue(config, point);
  return config.inequalitySide === "positive" ? value >= -EPSILON : value <= EPSILON;
}

function clipPolygonByInequality(THREE, polygon, config) {
  const out = [];
  if (!Array.isArray(polygon) || polygon.length === 0) return out;
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const currentInside = isPointInsideInequality(config, current);
    const previousInside = isPointInsideInequality(config, previous);
    const currentValue = planeValue(config, current);
    const previousValue = planeValue(config, previous);
    if (currentInside !== previousInside) {
      const denom = previousValue - currentValue;
      if (Math.abs(denom) > EPSILON) {
        const t = previousValue / denom;
        out.push(new THREE.Vector3(
          previous.x + (current.x - previous.x) * t,
          previous.y + (current.y - previous.y) * t,
          previous.z + (current.z - previous.z) * t
        ));
      }
    }
    if (currentInside) out.push(current.clone());
  }
  return out;
}

function pushPolygonTriangles(positions, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return;
  const first = polygon[0];
  for (let i = 1; i < polygon.length - 1; i += 1) {
    const a = first;
    const b = polygon[i];
    const c = polygon[i + 1];
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
}

function uniquePlanePoints(points) {
  const seen = new Set();
  const out = [];
  points.forEach((point) => {
    const key = [point.x, point.y, point.z].map((value) => Math.round(value * 1000000)).join(":");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(point);
  });
  return out;
}

function makeInequalityVolumeGeometry(THREE, rawConfig = {}) {
  const config = resolveTemporalPlaneEquationConfig(rawConfig, rawConfig?.timeSeconds);
  const [xmin, xmax] = readAxisRange(config, "x");
  const [ymin, ymax] = readAxisRange(config, "y");
  const [zmin, zmax] = readAxisRange(config, "z");
  const corners = [
    new THREE.Vector3(xmin, ymin, zmin),
    new THREE.Vector3(xmax, ymin, zmin),
    new THREE.Vector3(xmax, ymax, zmin),
    new THREE.Vector3(xmin, ymax, zmin),
    new THREE.Vector3(xmin, ymin, zmax),
    new THREE.Vector3(xmax, ymin, zmax),
    new THREE.Vector3(xmax, ymax, zmax),
    new THREE.Vector3(xmin, ymax, zmax)
  ];
  const faceIndices = [
    [0, 1, 2, 3],
    [4, 7, 6, 5],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0]
  ];
  const polygons = faceIndices
    .map((indices) => clipPolygonByInequality(THREE, indices.map((idx) => corners[idx]), config))
    .filter((polygon) => polygon.length >= 3);

  const edgeIndices = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];
  const capPoints = [];
  edgeIndices.forEach(([aIdx, bIdx]) => {
    const a = corners[aIdx];
    const b = corners[bIdx];
    const av = planeValue(config, a);
    const bv = planeValue(config, b);
    if (Math.abs(av) <= EPSILON) capPoints.push(a.clone());
    if (Math.abs(bv) <= EPSILON) capPoints.push(b.clone());
    if ((av < -EPSILON && bv > EPSILON) || (av > EPSILON && bv < -EPSILON)) {
      const t = av / (av - bv);
      capPoints.push(new THREE.Vector3(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        a.z + (b.z - a.z) * t
      ));
    }
  });
  const uniqueCapPoints = uniquePlanePoints(capPoints);
  if (uniqueCapPoints.length >= 3) {
    const normal = new THREE.Vector3(config.a, config.b, config.c).normalize();
    const center = uniqueCapPoints.reduce((acc, point) => acc.add(point), new THREE.Vector3()).divideScalar(uniqueCapPoints.length);
    const reference = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(reference, normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    uniqueCapPoints.sort((a, b) => {
      const av = a.clone().sub(center);
      const bv = b.clone().sub(center);
      return Math.atan2(av.dot(bitangent), av.dot(tangent)) - Math.atan2(bv.dot(bitangent), bv.dot(tangent));
    });
    if (config.inequalitySide === "positive") uniqueCapPoints.reverse();
    polygons.push(uniqueCapPoints);
  }

  const positions = [];
  polygons.forEach((polygon) => pushPolygonTriangles(positions, polygon));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function applyPlaneEquationToMesh(THREE, mesh, rawConfig = {}) {
  if (!THREE || !mesh) return null;
  const config = resolveTemporalPlaneEquationConfig(rawConfig, rawConfig?.timeSeconds);
  mesh.userData.equationTimeSeconds = config.timeSeconds || 0;
  mesh.userData.equationTemporal = config.equationTemporal === true;
  mesh.userData.equationBaseExpression = config.equationBaseExpression || (config.equationTemporal ? config.expression : "");
  if (config.inequality === true) {
    if (mesh.geometry?.dispose) mesh.geometry.dispose();
    mesh.geometry = makeInequalityVolumeGeometry(THREE, config);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity?.();
    mesh.scale.set(1, 1, 1);
    mesh.userData.equationCollider = config;
    mesh.userData.equationExpression = config.expression;
    mesh.userData.equationInequalityOperator = config.operator;
    mesh.userData.equationInequalitySide = config.inequalitySide;
    mesh.userData.nvType = "equation-inequality";
    mesh.name = "Equation Inequality Volume";
    return config;
  }
  const normal = new THREE.Vector3(config.a, config.b, config.c);
  const normalLength = Math.max(0.000001, normal.length());
  normal.divideScalar(normalLength);
  const point = normal.clone().multiplyScalar(-config.d / normalLength);

  mesh.position.copy(point);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  mesh.scale.set(1, 1, 1);
  mesh.userData.equationCollider = config;
  mesh.userData.equationExpression = config.expression;
  mesh.userData.equationInequalityOperator = config.operator;
  mesh.userData.equationInequalitySide = config.inequalitySide;
  mesh.userData.nvType = "equation-collider-plane";
  mesh.name = "Equation Object Plane";
  return config;
}

export function makePlaneColliderRef(THREE, mesh, rawConfig = mesh?.userData?.equationCollider || {}) {
  const config = resolveTemporalPlaneEquationConfig(rawConfig, rawConfig?.timeSeconds);
  return {
    type: "equation-plane",
    target: mesh || null,
    materialId: readWorldObjectPhysicsMaterialId(mesh?.userData || rawConfig, DEFAULT_WORLD_OBJECT_MATERIAL_ID),
    equation: config,
    thickness: config.thickness,
    normal: THREE ? new THREE.Vector3(config.a, config.b, config.c).normalize() : null
  };
}

function normalizeWaterSide(value) {
  const side = String(value || "negative").toLowerCase();
  if (["positive", "greater", "gt", ">", ">=", "above"].includes(side)) return "positive";
  return "negative";
}

function isLiquidEquationMaterial(options = {}) {
  return readWorldObjectMatterState(options) === "liquid";
}

function planeValue(config, point) {
  return (config.a * (Number(point?.x) || 0))
    + (config.b * (Number(point?.y) || 0))
    + (config.c * (Number(point?.z) || 0))
    + config.d;
}

export function makePlaneWaterVolumeRef(THREE, mesh, rawConfig = mesh?.userData?.equationCollider || {}, options = {}) {
  const config = resolveTemporalPlaneEquationConfig(rawConfig, rawConfig?.timeSeconds);
  const side = normalizeWaterSide(options.side || mesh?.userData?.equationLiquidSide || mesh?.userData?.equationWaterSide || config.inequalitySide);
  const infinite = options.infinite !== false && mesh?.userData?.equationLiquidInfinite !== false && mesh?.userData?.equationWaterInfinite !== false;
  return {
    type: "equation-liquid",
    target: mesh || null,
    equation: config,
    side,
    infinite,
    buoyancyScale: Number.isFinite(options.buoyancyScale) ? options.buoyancyScale : 1,
    containsPoint(point) {
      if (!point || mesh?.visible === false) return false;
      const eq = resolveTemporalPlaneEquationConfig(mesh?.userData?.equationCollider || this.equation || config, mesh?.userData?.equationTimeSeconds ?? this.equation?.timeSeconds ?? config.timeSeconds ?? 0);
      if (this.infinite !== true && !pointWithinPlaneConstraints(eq, point, 0)) return false;
      const value = planeValue(eq, point);
      return this.side === "positive" ? value >= 0 : value <= 0;
    }
  };
}

export function syncPlaneWaterVolumeRef(THREE, waterVolumes, mesh, rawConfig = mesh?.userData?.equationCollider || {}, options = {}) {
  if (!Array.isArray(waterVolumes) || !mesh) return null;
  const existing = mesh.userData?.waterVolumeRef || null;
  const shouldHaveLiquid = mesh.userData?.isLiquid === true || mesh.userData?.isWater === true || options.liquid === true || options.water === true || isLiquidEquationMaterial(rawConfig) || isLiquidEquationMaterial(mesh.userData || {});
  if (!shouldHaveLiquid) {
    if (existing) {
      const idx = waterVolumes.indexOf(existing);
      if (idx !== -1) waterVolumes.splice(idx, 1);
      delete mesh.userData.waterVolumeRef;
    }
    return null;
  }
  const ref = existing || makePlaneWaterVolumeRef(THREE, mesh, rawConfig, options);
  ref.target = mesh;
  ref.equation = resolveTemporalPlaneEquationConfig(rawConfig, rawConfig?.timeSeconds);
  ref.side = normalizeWaterSide(options.side || mesh.userData.equationLiquidSide || mesh.userData.equationWaterSide || ref.equation.inequalitySide);
  ref.infinite = options.infinite !== false && mesh.userData.equationLiquidInfinite !== false && mesh.userData.equationWaterInfinite !== false;
  ref.buoyancyScale = Number.isFinite(options.buoyancyScale) ? options.buoyancyScale : ref.buoyancyScale || 1;
  if (!waterVolumes.includes(ref)) waterVolumes.push(ref);
  mesh.userData.waterVolumeRef = ref;
  return ref;
}

export function syncPlaneColliderRef(THREE, mesh) {
  const ref = mesh?.userData?.colliderRef;
  if (!ref || ref.type !== "equation-plane") return;
  const config = resolveTemporalPlaneEquationConfig(mesh.userData?.equationCollider || {}, mesh.userData?.equationTimeSeconds || 0);
  ref.equation = config;
  ref.thickness = config.thickness;
  ref.target = mesh;
  if (THREE) ref.normal = new THREE.Vector3(config.a, config.b, config.c).normalize();
}

export function getPlaneRayIntersection(THREE, mesh, ray, minDistance = 0.05) {
  if (!THREE || !mesh || !ray) return null;
  const config = resolveTemporalPlaneEquationConfig(mesh.userData?.equationCollider || {}, mesh.userData?.equationTimeSeconds || 0);
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
  const config = resolveTemporalPlaneEquationConfig(rawConfig, rawConfig?.timeSeconds);
  const inequalityEnabled = config.inequality === true;
  const isLiquidMaterial = isLiquidEquationMaterial(materialOptions) || isLiquidEquationMaterial(rawConfig);
  const baseColor = materialOptions.color || (isLiquidMaterial ? "#2f83b7" : "#61d6d6");
  const opacity = Number.isFinite(materialOptions.opacity) ? materialOptions.opacity : (isLiquidMaterial ? 0.48 : 0.34);
  const material = isLiquidMaterial
    ? new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
    : new THREE.MeshStandardMaterial({
      color: baseColor,
      transparent: true,
      opacity,
      depthWrite: false,
      emissive: materialOptions.emissive || "#113838",
      emissiveIntensity: Number.isFinite(materialOptions.emissiveIntensity) ? materialOptions.emissiveIntensity : 0.18,
      side: THREE.DoubleSide
    });
  const mesh = new THREE.Mesh(
    inequalityEnabled ? makeInequalityVolumeGeometry(THREE, config) : new THREE.BoxGeometry(getPlaneConstraintExtent(config), config.thickness, getPlaneConstraintExtent(config)),
    material
  );
  mesh.name = inequalityEnabled ? "Equation Inequality Volume" : "Equation Object Plane";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.nvType = inequalityEnabled ? "equation-inequality" : "equation-collider-plane";
  mesh.userData.isSolid = true;
  mesh.userData.physicsEnabled = true;
  mesh.userData.breakable = false;
  applyPlaneEquationToMesh(THREE, mesh, config);
  return mesh;
}

export function resizeEquationColliderPlaneMesh(THREE, mesh, rawConfig = {}) {
  if (!THREE || !mesh) return null;
  const config = resolveTemporalPlaneEquationConfig(rawConfig, rawConfig?.timeSeconds);
  if (mesh.geometry?.dispose) mesh.geometry.dispose();
  mesh.geometry = new THREE.BoxGeometry(getPlaneConstraintExtent(config), config.thickness, getPlaneConstraintExtent(config));
  return applyPlaneEquationToMesh(THREE, mesh, config);
}

export function createEquationColliderController({ THREE, scene, objects, colliders, waterVolumes }) {
  function addPlane(rawConfig = {}) {
    if (!THREE || !scene || !objects || !colliders) return null;
    const timeSeconds = Number.isFinite(rawConfig.timeSeconds) ? rawConfig.timeSeconds : (window.VRWorldContext?.temporalController?.getTimeSeconds?.() ?? 0);
    const timedConfig = { ...rawConfig, timeSeconds };
    const mesh = createEquationColliderPlaneMesh(THREE, timedConfig, rawConfig);
    const config = resolveTemporalPlaneEquationConfig(timedConfig, timeSeconds);
    const materialId = readWorldObjectPhysicsMaterialId(rawConfig, DEFAULT_WORLD_OBJECT_MATERIAL_ID);
    const materialFile = rawConfig.physicsMaterialFile || materialFileForWorldObjectMaterial(materialId);
    const matterState = readWorldObjectMatterState(rawConfig);
    const liquidEnabled = isLiquidEquationMaterial(rawConfig);
    const colliderEnabled = !liquidEnabled && config.inequality !== true && rawConfig.collider !== false;
    mesh.userData.physicsMaterialId = materialId;
    mesh.userData.physicsMaterialFile = materialFile;
    mesh.userData.materialName = rawConfig.materialName || materialId;
    mesh.userData.MatterState = matterState || "";
    mesh.userData.matterState = matterState || "";
    mesh.userData.isLiquid = liquidEnabled;
    mesh.userData.isWater = false;
    delete mesh.userData.materialType;
    delete mesh.userData.equationWaterSide;
    delete mesh.userData.equationWaterInfinite;
    if (liquidEnabled) {
      mesh.userData.equationLiquidSide = normalizeWaterSide(rawConfig.liquidSide || rawConfig.equationLiquidSide || rawConfig.waterSide || rawConfig.equationWaterSide || config.inequalitySide);
      mesh.userData.equationLiquidInfinite = rawConfig.liquidInfinite !== false && rawConfig.equationLiquidInfinite !== false && rawConfig.waterInfinite !== false && rawConfig.equationWaterInfinite !== false;
    } else {
      delete mesh.userData.equationLiquidSide;
      delete mesh.userData.equationLiquidInfinite;
    }
    mesh.userData.isSolid = colliderEnabled;
    mesh.userData.physicsEnabled = colliderEnabled;
    scene.add(mesh);
    objects.push(mesh);
    if (colliderEnabled) {
      const colliderRef = makePlaneColliderRef(THREE, mesh);
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }
    if (liquidEnabled) {
      syncPlaneWaterVolumeRef(THREE, waterVolumes, mesh, mesh.userData.equationCollider, {
        liquid: true,
        side: mesh.userData.equationLiquidSide,
        infinite: mesh.userData.equationLiquidInfinite,
        buoyancyScale: Number.isFinite(rawConfig.buoyancyScale) ? rawConfig.buoyancyScale : 1
      });
    }
    return mesh;
  }


  return { addPlane };
}
