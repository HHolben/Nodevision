// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs
// This file defines browser-side world Save logic for the Nodevision UI. It renders interface components and handles user interactions.

import { expressionUsesTimeVariable, normalizePlaneEquationConfig } from "./equationColliderTool.mjs";
import { normalizeMetaWorldMultiplayer } from "/MetaWorld/MetaWorldMultiplayerConfig.mjs";
import {
  DEFAULT_WORLD_GAS_MATERIAL_FILE,
  DEFAULT_WORLD_GAS_MATERIAL_ID,
  DEFAULT_WORLD_OBJECT_MATERIAL_ID,
  materialFileForWorldObjectMaterial,
  readWorldObjectMatterState,
  readWorldObjectPhysicsMaterialId,
} from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";

function normalizeWorldPath(filePath) {
  if (!filePath) return "";
  const normalized = String(filePath).replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith("./")) return normalized.slice(2);
  if (normalized.startsWith("Notebook/")) return normalized.slice("Notebook/".length);
  return normalized;
}

const DEFAULT_ENVIRONMENT = {
  skyColor: "#ffffff",
  floorColor: "#d8dee4",
  backgroundMode: "color",
  backgroundImage: "",
  dayNightCycle: {
    enabled: false,
    durationSeconds: 120,
    periods: [
      { time: 0, brightness: 1 }
    ]
  },
  gasMaterialId: DEFAULT_WORLD_GAS_MATERIAL_ID,
  gasMaterialFile: DEFAULT_WORLD_GAS_MATERIAL_FILE
};

function cloneDefaultDayNightCycle() {
  return {
    enabled: false,
    durationSeconds: 120,
    periods: [
      { time: 0, brightness: 1 }
    ]
  };
}

function clampFiniteNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeDayNightPeriod(period, fallbackTime = 0) {
  const source = period && typeof period === "object" ? period : {};
  return {
    time: clampFiniteNumber(source.time ?? source.timeSeconds ?? source.at ?? source.offset, 0, Number.MAX_SAFE_INTEGER, fallbackTime),
    brightness: clampFiniteNumber(source.brightness ?? source.level ?? source.intensity, 0, 1, 1)
  };
}

function normalizeDayNightCycle(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const durationSeconds = clampFiniteNumber(source.durationSeconds ?? source.duration ?? source.cycleSeconds, 1, 86400, DEFAULT_ENVIRONMENT.dayNightCycle.durationSeconds);
  const sourcePeriods = Array.isArray(source.periods)
    ? source.periods
    : Array.isArray(source.keyframes)
      ? source.keyframes
      : [];
  const periods = sourcePeriods
    .map((period, index) => normalizeDayNightPeriod(period, index === 0 ? 0 : durationSeconds * index / Math.max(sourcePeriods.length, 1)))
    .map((period) => ({
      time: clampFiniteNumber(period.time, 0, durationSeconds, 0),
      brightness: clampFiniteNumber(period.brightness, 0, 1, 1)
    }))
    .sort((a, b) => a.time - b.time);
  return {
    enabled: source.enabled === true,
    durationSeconds,
    periods: periods.length ? periods : cloneDefaultDayNightCycle().periods
  };
}

function buildAsciiStl(vertices = []) {
  const pts = Array.isArray(vertices) ? vertices : [];
  const safePts = pts.length >= 3 ? pts : [
    { x: 0, y: 0, z: 0 },
    { x: 0.5, y: 0, z: 0 },
    { x: 0, y: 0, z: 0.5 }
  ];
  const lines = ["solid edited"];
  for (let i = 0; i < safePts.length; i += 3) {
    const a = safePts[i];
    const b = safePts[(i + 1) % safePts.length];
    const c = safePts[(i + 2) % safePts.length];
    const ax = a.x || 0, ay = a.y || 0, az = a.z || 0;
    const bx = b.x || 0, by = b.y || 0, bz = b.z || 0;
    const cx = c.x || 0, cy = c.y || 0, cz = c.z || 0;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = (uy * vz) - (uz * vy);
    const ny = (uz * vx) - (ux * vz);
    const nz = (ux * vy) - (uy * vx);
    lines.push(`  facet normal ${nx} ${ny} ${nz}`);
    lines.push("    outer loop");
    lines.push(`      vertex ${ax} ${ay} ${az}`);
    lines.push(`      vertex ${bx} ${by} ${bz}`);
    lines.push(`      vertex ${cx} ${cy} ${cz}`);
    lines.push("    endloop");
    lines.push("  endfacet");
  }
  lines.push("endsolid edited");
  return lines.join("\n");
}

function buildEnvironmentMeta(movementState) {
  const env = movementState?.environment || {};
  return {
    skyColor: env.skyColor || DEFAULT_ENVIRONMENT.skyColor,
    floorColor: env.floorColor || DEFAULT_ENVIRONMENT.floorColor,
    backgroundMode: env.backgroundMode || (env.backgroundImage ? "image" : "color"),
    backgroundImage: env.backgroundImage || "",
    floorImage: env.floorImage || "",
    dayNightCycle: normalizeDayNightCycle(env.dayNightCycle ?? DEFAULT_ENVIRONMENT.dayNightCycle),
    gasMaterialId: env.gasMaterialId || DEFAULT_ENVIRONMENT.gasMaterialId,
    gasMaterialFile: env.gasMaterialFile || DEFAULT_ENVIRONMENT.gasMaterialFile
  };
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function vec3(v) {
  return [round3(v.x), round3(v.y), round3(v.z)];
}

function getMeshType(mesh) {
  const hint = String(mesh?.userData?.nvType || "").toLowerCase();
  if (hint === "portal") return "portal";
  if (hint === "spawn") return "spawn";
  if (hint === "functionsurface") return "functionSurface";
  if (hint === "functioncurve") return "functionCurve";
  if (hint === "parametriccurve") return "parametricCurve";
  if (
    hint === "box"
    || hint === "sphere"
    || hint === "cylinder"
    || hint === "cone"
    || hint === "pyramid"
    || hint === "torus"
    || hint === "math-function"
    || hint === "equation-collider-plane"
    || hint === "equation-inequality"
    || hint === "console"
    || hint === "button"
    || hint === "object-file"
    || hint === "image-plane"
    || hint === "terrain-surface"
  ) return hint;
  const gType = mesh?.geometry?.type;
  if (gType === "BoxGeometry") return "box";
  if (gType === "SphereGeometry") return "sphere";
  if (gType === "CylinderGeometry") return "cylinder";
  if (gType === "ConeGeometry") return mesh?.geometry?.parameters?.radialSegments === 4 ? "pyramid" : "cone";
  if (gType === "TorusGeometry") return "torus";
  return null;
}

function getGeometryShape(mesh) {
  const gType = mesh?.geometry?.type;
  if (gType === "BoxGeometry") return "box";
  if (gType === "SphereGeometry") return "sphere";
  if (gType === "CylinderGeometry") return "cylinder";
  if (gType === "ConeGeometry") return mesh?.geometry?.parameters?.radialSegments === 4 ? "pyramid" : "cone";
  if (gType === "TorusGeometry") return "torus";
  return "box";
}

function materialColorHex(mesh) {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (mat?.color?.isColor) return `#${mat.color.getHexString()}`;
  return "#888888";
}

function materialMeta(mesh) {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mat) return {};
  const out = {};
  if (mat.transparent === true) out.opacity = Number.isFinite(mat.opacity) ? round3(mat.opacity) : 0.65;
  if (mat.emissive?.isColor && mat.emissive.getHex() !== 0) out.emissive = `#${mat.emissive.getHexString()}`;
  if (Number.isFinite(mat.emissiveIntensity) && mat.emissiveIntensity !== 1) out.emissiveIntensity = round3(mat.emissiveIntensity);
  return out;
}

function physicsMaterialMeta(mesh, def = {}) {
  const userData = mesh?.userData || {};
  const liquid = readWorldObjectMatterState(userData, readWorldObjectMatterState(def, userData.isWater === true || def.isWater === true || def.materialType === "water" ? "liquid" : "")) === "liquid";
  const fallback = liquid
    ? (userData.physicsMaterialId || def.physicsMaterialId || "water")
    : (def.isSolid === true || userData.isSolid === true || userData.physicsEnabled === true ? DEFAULT_WORLD_OBJECT_MATERIAL_ID : "");
  const defMaterialId = readWorldObjectPhysicsMaterialId(def, fallback);
  const materialId = readWorldObjectPhysicsMaterialId(userData, defMaterialId);
  if (!materialId) return {};
  const out = { physicsMaterialId: materialId };
  if (typeof userData.physicsMaterialFile === "string" && userData.physicsMaterialFile) out.physicsMaterialFile = userData.physicsMaterialFile;
  else if (typeof def.physicsMaterialFile === "string" && def.physicsMaterialFile) out.physicsMaterialFile = def.physicsMaterialFile;
  else out.physicsMaterialFile = materialFileForWorldObjectMaterial(materialId);
  return out;
}

function stableTerrainClone(terrain = {}) {
  const clone = {};
  for (const [key, value] of Object.entries(terrain || {})) {
    if (key === "tileKey" || key === "paintedAt" || key === "generator" || key === "radius" || key === "brushShape") continue;
    clone[key] = value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
  }
  return clone;
}

function terrainMergeKey(def) {
  if (!def?.terrain || def.type !== "box" || !Array.isArray(def.size) || def.size.length < 3) return null;
  const [sx, sy, sz] = def.size.map(Number);
  if (![sx, sy, sz].every(Number.isFinite) || sx <= 0 || sy <= 0 || sz <= 0) return null;
  const terrain = stableTerrainClone(def.terrain);
  delete terrain.composed;
  delete terrain.composedTiles;
  const offsetX = ((Number(def.position?.[0] || 0) % sx) + sx) % sx;
  const offsetZ = ((Number(def.position?.[2] || 0) % sz) + sz) % sz;
  return JSON.stringify({
    type: def.type,
    color: def.color || "#888888",
    opacity: Number.isFinite(def.opacity) ? round3(def.opacity) : null,
    emissive: def.emissive || null,
    emissiveIntensity: Number.isFinite(def.emissiveIntensity) ? round3(def.emissiveIntensity) : null,
    isSolid: def.isSolid === true,
    isWater: def.isWater === true,
    hidden: def.hidden === true,
    sizeY: round3(sy),
    positionY: round3(def.position?.[1] || 0),
    baseTileX: round3(sx),
    baseTileZ: round3(sz),
    offsetX: round3(offsetX),
    offsetZ: round3(offsetZ),
    terrain
  });
}

function terrainCellKey(gx, gz) {
  return String(gx) + ":" + String(gz);
}

function compactTerrainGroup(entries) {
  const remaining = new Map();
  for (const entry of entries) {
    const [sx, , sz] = entry.def.size.map(Number);
    const gx = Math.round(Number(entry.def.position?.[0] || 0) / sx);
    const gz = Math.round(Number(entry.def.position?.[2] || 0) / sz);
    const key = terrainCellKey(gx, gz);
    if (!remaining.has(key)) remaining.set(key, { ...entry, gx, gz, sx, sz });
  }

  const compacted = [];
  const sortedCells = () => Array.from(remaining.values()).sort((a, b) => (a.gz - b.gz) || (a.gx - b.gx));

  while (remaining.size > 0) {
    const start = sortedCells()[0];
    let width = 1;
    while (remaining.has(terrainCellKey(start.gx + width, start.gz))) width += 1;

    let depth = 1;
    let canGrow = true;
    while (canGrow) {
      for (let dx = 0; dx < width; dx += 1) {
        if (!remaining.has(terrainCellKey(start.gx + dx, start.gz + depth))) {
          canGrow = false;
          break;
        }
      }
      if (canGrow) depth += 1;
    }

    for (let dz = 0; dz < depth; dz += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        remaining.delete(terrainCellKey(start.gx + dx, start.gz + dz));
      }
    }

    const source = start.def;
    if (width === 1 && depth === 1) {
      compacted.push(source);
      continue;
    }

    const merged = JSON.parse(JSON.stringify(source));
    merged.size = [
      round3(start.sx * width),
      round3(source.size[1]),
      round3(start.sz * depth)
    ];
    merged.position = [
      round3(Number(source.position[0] || 0) + ((width - 1) * start.sx) / 2),
      source.position[1],
      round3(Number(source.position[2] || 0) + ((depth - 1) * start.sz) / 2)
    ];
    merged.terrain = {
      ...stableTerrainClone(source.terrain),
      composed: true,
      composedTiles: [width, depth],
      tileSize: round3(start.sx)
    };
    compacted.push(merged);
  }

  return compacted;
}

function compactTerrainDefinitions(defs = []) {
  const passthrough = [];
  const groups = new Map();

  for (const def of defs) {
    const key = terrainMergeKey(def);
    if (!key) {
      passthrough.push(def);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ def });
  }

  const compactedTerrain = [];
  for (const entries of groups.values()) {
    compactedTerrain.push(...compactTerrainGroup(entries));
  }

  return passthrough.concat(compactedTerrain);
}

function serializeMesh(mesh) {
  if (!mesh?.isMesh) return null;
  const type = getMeshType(mesh);
  if (!type) return null;

  if (mesh.userData?.metaWorldExpressionLayer === true || ["functionSurface", "functionCurve", "parametricCurve"].includes(type)) {
    const source = mesh.userData?.expressionLayerDefinition && typeof mesh.userData.expressionLayerDefinition === "object"
      ? mesh.userData.expressionLayerDefinition
      : {};
    const def = JSON.parse(JSON.stringify(source));
    def.id = def.id || mesh.userData?.expressionLayerId || mesh.userData?.metaWorldLayerId || mesh.uuid;
    def.type = type;
    def.position = vec3(mesh.position);
    def.visible = mesh.visible !== false;
    return def;
  }

  const def = {
    type,
    position: vec3(mesh.position),
    color: materialColorHex(mesh),
    isSolid: mesh.userData?.isSolid === true
  };

  const g = mesh.geometry;
  const sx = Math.abs(mesh.scale?.x || 1);
  const sy = Math.abs(mesh.scale?.y || 1);
  const sz = Math.abs(mesh.scale?.z || 1);

  const shape = type === "portal" || type === "spawn" ? getGeometryShape(mesh) : type;

  if (type === "math-function") {
    const props = mesh.userData?.mathFunctionProperties || {};
    def.equation = typeof props.equation === "string" ? props.equation : "Math.sin(x)";
    const rawResolution = Number.isFinite(props.resolution) ? props.resolution : 96;
    def.resolution = Math.max(16, Math.min(192, Math.floor(rawResolution)));
    def.limits = Array.isArray(props.limits) ? props.limits.slice(0, 2).map(round3) : [-8, 8];
    def.collider = props.collider !== false;
  } else if (type === "equation-collider-plane" || type === "equation-inequality") {
    const props = normalizePlaneEquationConfig(mesh.userData?.equationCollider || {});
    const inequality = type === "equation-inequality" || props.inequality === true;
    const expression = mesh.userData?.equationExpression || props.expression || "";
    const temporal = mesh.userData?.equationTemporal === true || props.equationTemporal === true || expressionUsesTimeVariable(expression);
    const operator = mesh.userData?.equationInequalityOperator || props.operator || "";
    const inequalitySide = mesh.userData?.equationInequalitySide || props.inequalitySide || "negative";
    def.equationCollider = {
      kind: inequality ? "plane-inequality" : "plane",
      a: round3(props.a),
      b: round3(props.b),
      c: round3(props.c),
      d: round3(props.d),
      xmin: round3(props.xmin),
      xmax: round3(props.xmax),
      ymin: round3(props.ymin),
      ymax: round3(props.ymax),
      zmin: round3(props.zmin),
      zmax: round3(props.zmax),
      thickness: round3(props.thickness),
      boundX: props.boundX === true,
      boundY: props.boundY === true,
      boundZ: props.boundZ === true,
      inequality,
      operator,
      inequalitySide,
      expression,
      equationTemporal: temporal || undefined,
      equationBaseExpression: temporal ? expression : undefined
    };
    if (inequality) {
      def.inequality = true;
      def.operator = operator;
      def.inequalitySide = inequalitySide;
      def.equationExpression = expression;
    }
    if (temporal) {
      def.equationTemporal = true;
      def.equationBaseExpression = expression;
    }
    const matterState = readWorldObjectMatterState(mesh.userData || {}, readWorldObjectMatterState(def));
    const liquid = matterState === "liquid";
    if (matterState) def.MatterState = matterState;
    def.isLiquid = liquid || undefined;
    def.collider = liquid || inequality ? false : (mesh.userData?.colliderRef ? true : false);
    def.isSolid = liquid || inequality ? false : mesh.userData?.isSolid !== false;
    if (liquid) {
      def.equationLiquidSide = mesh.userData?.equationLiquidSide || mesh.userData?.equationWaterSide || "negative";
      def.equationLiquidInfinite = mesh.userData?.equationLiquidInfinite !== false && mesh.userData?.equationWaterInfinite !== false;
    }
  } else if (type === "console") {
    const props = mesh.userData?.consoleProperties || {};
    def.collider = props.collider !== false;
    if (typeof props.objectFile === "string" && props.objectFile) def.objectFile = props.objectFile;
    if (typeof props.linkedObject === "string" && props.linkedObject) def.linkedObject = props.linkedObject;
    if (props.inputs && typeof props.inputs === "object") def.inputs = props.inputs;
    if (props.outputs && typeof props.outputs === "object") def.outputs = props.outputs;
    if (props.metaWorldDemo && typeof props.metaWorldDemo === "object") def.metaWorldDemo = props.metaWorldDemo;
    const p = g?.parameters || {};
    def.size = [
      round3((p.width ?? 1) * sx),
      round3((p.height ?? 1) * sy),
      round3((p.depth ?? 1) * sz)
    ];
  } else if (type === "button") {
    const p = g?.parameters || {};
    def.size = [
      round3((p.radiusTop ?? p.radius ?? 0.22) * Math.max(sx, sz)),
      round3((p.height ?? 0.12) * sy)
    ];
  } else if (type === "object-file") {
    const p = g?.parameters || {};
    def.size = [
      round3((p.width ?? 1) * sx),
      round3((p.height ?? 1) * sy),
      round3((p.depth ?? 1) * sz)
    ];
    if (typeof mesh.userData?.objectFilePath === "string" && mesh.userData.objectFilePath) {
      def.objectFile = mesh.userData.objectFilePath;
    }
  } else if (type === "image-plane") {
    const p = g?.parameters || {};
    def.size = [
      round3((p.width ?? 2) * sx),
      round3((p.height ?? 2) * sy)
    ];
    if (typeof mesh.userData?.imageFilePath === "string" && mesh.userData.imageFilePath) {
      def.imageFile = mesh.userData.imageFilePath;
    }
  } else if (type === "terrain-surface") {
    const terrain = mesh.userData?.terrain || {};
    def.size = [
      round3(Number(terrain.width) || 1),
      round3(Number(terrain.depth) || 1)
    ];
    def.columns = Math.max(1, Math.floor(Number(terrain.columns) || 1));
    def.rows = Math.max(1, Math.floor(Number(terrain.rows) || 1));
    def.tileSize = round3(Number(terrain.tileSize) || 1);
    def.texture = terrain.texture || "solid";
    def.kind = terrain.kind || "grass";
    if (Array.isArray(terrain.heights)) def.heights = terrain.heights.map(round3);
    if (Array.isArray(terrain.vertexColors)) def.vertexColors = terrain.vertexColors.slice();
  } else if (shape === "box") {
    const p = g?.parameters || {};
    def.size = [
      round3((p.width ?? 1) * sx),
      round3((p.height ?? 1) * sy),
      round3((p.depth ?? 1) * sz)
    ];
  } else if (shape === "sphere") {
    const p = g?.parameters || {};
    const scale = Math.max(sx, sy, sz);
    def.size = [round3((p.radius ?? 0.5) * scale)];
  } else if (shape === "cylinder") {
    const p = g?.parameters || {};
    const rScale = Math.max(sx, sz);
    def.size = [
      round3((p.radiusTop ?? p.radius ?? 0.5) * rScale),
      round3((p.height ?? 1) * sy)
    ];
  } else if (shape === "cone" || shape === "pyramid") {
    const p = g?.parameters || {};
    const rScale = Math.max(sx, sz);
    def.size = [
      round3((p.radius ?? 0.5) * rScale),
      round3((p.height ?? 1) * sy)
    ];
  } else if (shape === "torus") {
    const p = g?.parameters || {};
    const rScale = Math.max(sx, sz);
    def.size = [
      round3((p.radius ?? 1) * rScale),
      round3((p.tube ?? 0.25) * rScale)
    ];
  }

  Object.assign(def, materialMeta(mesh));
  Object.assign(def, physicsMaterialMeta(mesh, def));

  const savedMatterState = readWorldObjectMatterState(mesh.userData || {}, readWorldObjectMatterState(def));
  if (savedMatterState) def.MatterState = savedMatterState;
  if (savedMatterState === "liquid") {
    def.isLiquid = true;
    def.isSolid = false;
  }
  if (mesh.visible === false) def.hidden = true;
  if (mesh.userData?.useAction) def.useAction = mesh.userData.useAction;
  if (typeof mesh.userData?.tag === "string" && mesh.userData.tag) def.tag = mesh.userData.tag;
  if (typeof mesh.userData?.spawnId === "string" && mesh.userData.spawnId) def.spawnId = mesh.userData.spawnId;
  if (Number.isFinite(mesh.userData?.spawnYaw)) def.spawnYaw = mesh.userData.spawnYaw;
  if (mesh.userData?.terrain && typeof mesh.userData.terrain === "object") {
    def.terrain = JSON.parse(JSON.stringify(mesh.userData.terrain));
  }

  if (type === "spawn") {
    def.type = "spawn";
    def.shape = shape;
    def.isSolid = false;
  }

  if (mesh.userData?.isPortal === true || type === "portal") {
    def.type = "portal";
    def.shape = shape;
    def.isSolid = mesh.userData?.isSolid === true;
    if (typeof mesh.userData?.portalDestinationMode === "string" && mesh.userData.portalDestinationMode) {
      def.portalDestinationMode = mesh.userData.portalDestinationMode;
      def.destinationMode = mesh.userData.portalDestinationMode;
    }
    if (typeof mesh.userData?.portalLinkedPortalId === "string" && mesh.userData.portalLinkedPortalId) def.linkedPortalId = mesh.userData.portalLinkedPortalId;
    if (typeof mesh.userData?.portalTarget === "string" && mesh.userData.portalTarget) def.targetWorld = mesh.userData.portalTarget;
    if (mesh.userData?.portalSameWorld === true) def.sameWorld = true;
    if (Array.isArray(mesh.userData?.portalSpawn) && mesh.userData.portalSpawn.length >= 3) def.spawn = mesh.userData.portalSpawn.slice(0, 3).map(round3);
    if (typeof mesh.userData?.portalSpawnPoint === "string" && mesh.userData.portalSpawnPoint) def.spawnPoint = mesh.userData.portalSpawnPoint;
    if (Number.isFinite(mesh.userData?.portalSpawnYaw)) def.spawnYaw = mesh.userData.portalSpawnYaw;
    if (Number.isFinite(mesh.userData?.portalCooldownMs)) def.cooldownMs = mesh.userData.portalCooldownMs;
  }

  return def;
}

function serializeLight(light) {
  if (!light?.isLight) return null;
  let lightType = "point";
  if (light.isAmbientLight) lightType = "ambient";
  else if (light.isDirectionalLight) lightType = "directional";
  else if (light.isSpotLight) lightType = "spot";
  else if (light.isHemisphereLight) lightType = "hemisphere";
  return {
    type: "light",
    lightType,
    position: vec3(light.position),
    color: light.color?.isColor ? `#${light.color.getHexString()}` : "#ffffff",
    intensity: Number.isFinite(light.intensity) ? round3(light.intensity) : 1
  };
}

function buildWorldDefinition({
  existingWorldDefinition,
  objects,
  lights,
  movementState
}) {
  const existing = existingWorldDefinition && typeof existingWorldDefinition === "object"
    ? JSON.parse(JSON.stringify(existingWorldDefinition))
    : {};

  const objectArray = objects || [];
  const rawMeshDefs = objectArray
    .map(serializeMesh)
    .filter(Boolean);
  const meshDefs = compactTerrainDefinitions(rawMeshDefs);
  const lightDefs = (lights || [])
    .map(serializeLight)
    .filter(Boolean);

  const shouldFallbackToExistingObjects = meshDefs.length === 0
    && objectArray.length > 0
    && Array.isArray(existing.objects)
    && existing.objects.length > 0;
  if (shouldFallbackToExistingObjects) {
    console.warn("[worldSave] Retaining previously saved objects because serialization returned 0 meshes after environment update.");
  }

  const finalMeshDefs = shouldFallbackToExistingObjects ? existing.objects : meshDefs;
  const worldRules = movementState?.worldRules || {};
  const environment = buildEnvironmentMeta(movementState);
  const multiplayer = normalizeMetaWorldMultiplayer(movementState?.multiplayer || existing?.metadata?.multiplayer || existing?.multiplayer || {});
  const temporalState = movementState?.temporal || window.VRWorldContext?.temporalController?.getSettings?.() || existing?.metadata?.temporal || {};
  const temporal = {
    staticTimeEnabled: temporalState.staticTimeEnabled === true,
    staticTimeSeconds: Number.isFinite(temporalState.staticTimeSeconds) ? round3(temporalState.staticTimeSeconds) : 0,
    timeScale: Number.isFinite(temporalState.timeScale) ? round3(temporalState.timeScale) : 1,
    samplingRateHz: Number.isFinite(temporalState.samplingRateHz) ? round3(temporalState.samplingRateHz) : 10
  };
  const metadata = {
    ...(existing.metadata || {}),
    source: existing?.metadata?.source || "GameView",
    lastSavedAt: new Date().toISOString(),
    playerRules: {
      allowFly: worldRules.allowFly === true,
      allowRoll: worldRules.allowRoll === true,
      allowPitch: worldRules.allowPitch === true,
      allowPlace: worldRules.allowPlace === true,
      allowBreak: worldRules.allowBreak === true,
      allowInspect: worldRules.allowInspect === true,
      allowToolUse: worldRules.allowToolUse === true,
      allowSave: worldRules.allowSave === true
    },
    environment,
    temporal,
    multiplayer
  };

  return {
    ...existing,
    worldMode: movementState?.worldMode === "2d" ? "2d" : "3d",
    environment,
    multiplayer,
    metadata,
    objects: finalMeshDefs.concat(lightDefs)
  };
}

function makeWorldDefinitionScript(worldDefinition) {
  return `<script id="nodevision-metaworld" type="application/json" data-nodevision-meta-world>
${JSON.stringify(worldDefinition, null, 2)}
</script>`;
}

function injectWorldDefinitionIntoHtml(html, worldDefinition) {
  const scriptBlock = makeWorldDefinitionScript(worldDefinition);
  const scriptPatterns = [
    /<script\b(?=[^>]*\bdata-nodevision-meta-world\b)[^>]*>[\s\S]*?<\/script>/i,
    /<script\b(?=[^>]*\bid=["']nodevision-metaworld["'])[^>]*>[\s\S]*?<\/script>/i,
    /<script\b(?=[^>]*\btype=["']application\/json["'])[^>]*>[\s\S]*?<\/script>/i
  ];

  for (const pattern of scriptPatterns) {
    if (pattern.test(html)) return html.replace(pattern, scriptBlock);
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${scriptBlock}
</body>`);
  }
  return `${html}
${scriptBlock}
`;
}

export async function saveCurrentWorldFile({
  state,
  movementState,
  objects,
  lights
}) {
  const currentMode = String(movementState?.playerMode || "survival").toLowerCase();
  if (currentMode !== "creative") {
    alert("World saving is only available in Creative mode.");
    return false;
  }

  const worldPath = normalizeWorldPath(state?.currentWorldPath || window.selectedFilePath || "");
  if (!worldPath) {
    alert("No world file is selected.");
    return false;
  }

  // STL save path: write vertices as an STL file.
  if (worldPath.toLowerCase().endsWith(".stl")) {
    const vertices = movementState?.stlVertices || [];
    const stlContent = buildAsciiStl(vertices);
    try {
      const saveRes = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: worldPath, sourcePath: worldPath, content: stlContent })
      });
      const payload = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !payload?.success) {
        throw new Error(payload?.error || `${saveRes.status} ${saveRes.statusText}`);
      }
      return true;
    } catch (err) {
      console.error("Failed to save STL:", err);
      alert(`Failed to save STL: ${err.message}`);
      return false;
    }
  }

  const worldDefinition = buildWorldDefinition({
    existingWorldDefinition: state?.currentWorldDefinition || window.VRWorldContext?.currentWorldDefinition || null,
    objects,
    lights,
    movementState
  });

  let existingHtml = "";
  try {
    const res = await fetch(`/Notebook/${encodeURI(worldPath)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    existingHtml = await res.text();
  } catch (err) {
    console.error("Failed to load current world HTML before save:", err);
    alert(`Failed to read world file before save: ${err.message}`);
    return false;
  }

  const updatedHtml = injectWorldDefinitionIntoHtml(existingHtml, worldDefinition);

  try {
    const saveRes = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: worldPath, sourcePath: worldPath, content: updatedHtml })
    });
    const payload = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok || !payload?.success) {
      throw new Error(payload?.error || `${saveRes.status} ${saveRes.statusText}`);
    }
    if (state) state.currentWorldDefinition = JSON.parse(JSON.stringify(worldDefinition));
    if (window.VRWorldContext) window.VRWorldContext.currentWorldDefinition = JSON.parse(JSON.stringify(worldDefinition));
    return true;
  } catch (err) {
    console.error("Failed to save world HTML:", err);
    alert(`Failed to save world: ${err.message}`);
    return false;
  }
}
