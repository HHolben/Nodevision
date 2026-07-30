// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldLoader.mjs
// MetaWorld loader parses and validates embedded Nodevision world definitions.

const WORLD_SCRIPT_ID = "nodevision-metaworld";

function fail(message) {
  throw new Error(`MetaWorldLoader: ${message}`);
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function requireNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${label} must be a finite number`);
  }
  return value;
}

function readVector3(value, label, fallback = { x: 0, y: 0, z: 0 }) {
  const source = value ?? fallback;
  requireObject(source, label);
  return {
    x: requireNumber(source.x, `${label}.x`),
    y: requireNumber(source.y, `${label}.y`),
    z: requireNumber(source.z, `${label}.z`),
  };
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function finiteNumberArray(value, length) {
  if (!Array.isArray(value) || value.length < length) return null;
  const numbers = value.slice(0, length).map(Number);
  return numbers.every(Number.isFinite) ? numbers : null;
}

function readPatternCount(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

function isVoxelPatternDefinition(def) {
  const type = String(def?.type || "").trim().toLowerCase();
  return type === "voxel-pattern" || Boolean(def?.voxelPattern && typeof def.voxelPattern === "object");
}

function readVoxelPatternCounts(pattern = {}) {
  const source = Array.isArray(pattern.counts)
    ? pattern.counts
    : Array.isArray(pattern.dimensions)
      ? pattern.dimensions
      : Array.isArray(pattern.size)
        ? pattern.size
        : null;
  if (source && source.length >= 3) return [readPatternCount(source[0]), readPatternCount(source[1]), readPatternCount(source[2])];
  if (source && source.length >= 2) return [readPatternCount(source[0]), 1, readPatternCount(source[1])];
  const base = Number(pattern.base);
  const shape = String(pattern.shape || "").trim().toLowerCase();
  if (shape === "square" && Number.isFinite(base) && base > 0) {
    const count = readPatternCount(base);
    return [count, 1, count];
  }
  if (shape === "cube" && Number.isFinite(base) && base > 0) {
    const count = readPatternCount(base);
    return [count, count, count];
  }
  return [
    readPatternCount(pattern.x ?? pattern.width ?? pattern.columns ?? pattern.countX),
    readPatternCount(pattern.y ?? pattern.height ?? pattern.layers ?? pattern.countY),
    readPatternCount(pattern.z ?? pattern.depth ?? pattern.rows ?? pattern.countZ)
  ];
}

function readVoxelTemplateStep(template = {}) {
  const size = finiteNumberArray(template.size, 3);
  if (size && size.every((value) => value > 0)) return size.map((value) => round3(Math.abs(value)));
  const voxel = template.voxelPlacer && typeof template.voxelPlacer === "object" ? template.voxelPlacer : {};
  const voxelSize = Number(template.voxelSize ?? voxel.size);
  const safeSize = Number.isFinite(voxelSize) && voxelSize > 0 ? round3(Math.abs(voxelSize)) : 1;
  return [safeSize, safeSize, safeSize];
}

function readVoxelPatternStep(pattern = {}, template = {}) {
  const fallback = readVoxelTemplateStep(template);
  const source = pattern.step ?? pattern.spacing ?? pattern.cellSize ?? pattern.unit;
  if (Array.isArray(source) && source.length >= 3) {
    const step = source.slice(0, 3).map(Number);
    return step.every((value) => Number.isFinite(value) && value > 0) ? step.map(round3) : fallback;
  }
  if (Array.isArray(source) && source.length >= 2) {
    const x = Number(source[0]);
    const z = Number(source[1]);
    if (Number.isFinite(x) && x > 0 && Number.isFinite(z) && z > 0) return [round3(x), fallback[1], round3(z)];
  }
  const scalar = Number(source);
  if (Number.isFinite(scalar) && scalar > 0) {
    const unit = round3(scalar);
    return [unit, unit, unit];
  }
  return fallback;
}

function buildVoxelPatternTemplate(def = {}) {
  const rawTemplate = def.voxel && typeof def.voxel === "object"
    ? def.voxel
    : def.template && typeof def.template === "object"
      ? def.template
      : null;
  const template = rawTemplate ? cloneJson(rawTemplate) : cloneJson(def);
  delete template.pattern;
  delete template.voxelPattern;
  delete template.voxel;
  delete template.template;
  delete template.position;
  delete template.id;
  delete template.tag;
  delete template.name;
  if (!template.type || String(template.type).toLowerCase() === "voxel-pattern") template.type = "box";
  template.isVoxel = true;
  template.voxel = true;
  return template;
}

function inheritPatternField(clone, def, key) {
  if (clone[key] === undefined && def[key] !== undefined) clone[key] = cloneJson(def[key]);
}

function expandVoxelPatternDefinition(def, index) {
  if (!isVoxelPatternDefinition(def)) return [def];
  const pattern = def.pattern && typeof def.pattern === "object" ? def.pattern : (def.voxelPattern || {});
  const rawTemplate = def.voxel && typeof def.voxel === "object"
    ? def.voxel
    : def.template && typeof def.template === "object"
      ? def.template
      : null;
  const rawTemplatePosition = rawTemplate?.position;
  const template = buildVoxelPatternTemplate(def);
  ["color", "isSolid", "collider", "collidable", "breakable", "physicsMaterialId", "physicsMaterialFile", "MatterState", "matterState", "voxelSize", "voxelPlacer", "hidden", "visible"].forEach((key) => inheritPatternField(template, def, key));
  const counts = readVoxelPatternCounts(pattern);
  const step = readVoxelPatternStep(pattern, template);
  const basePosition = finiteNumberArray(def.position, 3) || finiteNumberArray(rawTemplatePosition, 3) || [0, 0, 0];
  const patternId = [def.id, def.tag, def.name].find((value) => typeof value === "string" && value.trim()) || "voxel-pattern-" + index;
  const expanded = [];
  for (let y = 0; y < counts[1]; y += 1) {
    for (let z = 0; z < counts[2]; z += 1) {
      for (let x = 0; x < counts[0]; x += 1) {
        const clone = cloneJson(template);
        clone.id = patternId + "-" + x + "-" + y + "-" + z;
        clone.position = [round3(basePosition[0] + x * step[0]), round3(basePosition[1] + y * step[1]), round3(basePosition[2] + z * step[2])];
        if (!Array.isArray(clone.size) || clone.size.length < 3) clone.size = step.slice();
        expanded.push(clone);
      }
    }
  }
  return expanded;
}

function expandVoxelPatternDefinitions(objects = []) {
  const expanded = [];
  for (let index = 0; index < objects.length; index += 1) {
    expanded.push(...expandVoxelPatternDefinition(objects[index], index));
  }
  return expanded;
}

export function loadMetaWorldFromDocument(doc = document) {
  const script = doc.getElementById(WORLD_SCRIPT_ID);
  if (!script) fail(`missing <script type="application/json" id="${WORLD_SCRIPT_ID}"> block`);
  if (script.type !== "application/json") fail(`world script must use type="application/json"`);

  let definition;
  try {
    definition = JSON.parse(script.textContent || "");
  } catch (err) {
    fail(`invalid JSON: ${err.message}`);
  }

  return validateMetaWorldDefinition(definition);
}

export function validateMetaWorldDefinition(definition) {
  const world = requireObject(definition, "world definition");
  if (typeof world.name !== "string" || !world.name.trim()) fail("name must be a nonempty string");
  const worldType = typeof world.worldType === "string" && world.worldType.trim()
    ? world.worldType.trim()
    : "";
  if (typeof world.type !== "string" || !world.type.trim()) fail("type must be a nonempty string");

  const physics = requireObject(world.physics ?? {}, "physics");
  const museum = requireObject(world.museum ?? {}, "museum");
  const metadata = requireObject(world.metadata ?? {}, "metadata");
  const playerRules = requireObject(world.playerRules ?? metadata.playerRules ?? {}, "playerRules");
  const environment = requireObject(world.environment ?? metadata.environment ?? {}, "environment");
  const permissions = requireObject(world.interactionPermissions ?? {}, "interactionPermissions");
  const exhibits = Array.isArray(world.exhibits) ? world.exhibits : [];
  const objects = Array.isArray(world.objects) ? world.objects : [];

  return {
    name: world.name.trim(),
    type: world.type.trim(),
    worldType,
    gravity: readVector3(world.gravity ?? physics.gravity, "gravity", { x: 0, y: -9.81, z: 0 }),
    timestep: requireNumber(world.timestep ?? physics.timestep ?? 1 / 60, "timestep"),
    spawnPosition: readVector3(world.spawnPosition, "spawnPosition", { x: 0, y: 1.7, z: 8 }),
    worldMode: typeof world.worldMode === "string" ? world.worldMode.trim() : "",
    viewMode: typeof world.viewMode === "string" ? world.viewMode.trim() : "",
    movementMode: typeof world.movementMode === "string" ? world.movementMode.trim() : "",
    metadata,
    playerRules,
    environment,
    museum: {
      size: readVector3(museum.size, "museum.size", { x: 18, y: 6, z: 14 }),
      floorColor: museum.floorColor ?? "#d9dddf",
      wallColor: museum.wallColor ?? "#f5f7f8",
      accentColor: museum.accentColor ?? "#3b82f6",
    },
    exhibits: exhibits.map((exhibit, index) => validateExhibit(exhibit, index)),
    objects: expandVoxelPatternDefinitions(objects).map((object, index) => validateWorldObject(object, index)),
    interactionPermissions: {
      allowPicking: permissions.allowPicking !== false,
      allowCameraOrbit: permissions.allowCameraOrbit !== false,
      allowSimulationControls: permissions.allowSimulationControls !== false,
    },
  };
}

function validateWorldObject(object, index) {
  requireObject(object, `objects[${index}]`);
  if (typeof object.type !== "string" || !object.type.trim()) fail(`objects[${index}].type must be a nonempty string`);
  const normalized = { ...object, type: object.type.trim() };
  if (typeof object.id === "string") normalized.id = object.id.trim();
  if (typeof object.tag === "string") normalized.tag = object.tag.trim();
  if (object.position !== undefined) {
    if (!Array.isArray(object.position) || object.position.length < 3) {
      fail(`objects[${index}].position must be an array with x, y, z`);
    }
    normalized.position = object.position.slice(0, 3).map((value, partIndex) => {
      return requireNumber(value, `objects[${index}].position[${partIndex}]`);
    });
  }
  if (object.size !== undefined) {
    if (!Array.isArray(object.size) || object.size.length === 0) {
      fail(`objects[${index}].size must be a nonempty array`);
    }
    normalized.size = object.size.map((value, partIndex) => {
      return requireNumber(value, `objects[${index}].size[${partIndex}]`);
    });
  }
  return normalized;
}

function validateExhibit(exhibit, index) {
  requireObject(exhibit, `exhibits[${index}]`);
  if (typeof exhibit.id !== "string" || !exhibit.id.trim()) fail(`exhibits[${index}].id must be a nonempty string`);
  if (typeof exhibit.type !== "string" || !exhibit.type.trim()) fail(`exhibits[${index}].type must be a nonempty string`);
  if (typeof exhibit.title !== "string" || !exhibit.title.trim()) fail(`exhibits[${index}].title must be a nonempty string`);
  return {
    ...exhibit,
    id: exhibit.id.trim(),
    type: exhibit.type.trim(),
    title: exhibit.title.trim(),
    position: readVector3(exhibit.position, `exhibits[${index}].position`),
    parameters: requireObject(exhibit.parameters ?? {}, `exhibits[${index}].parameters`),
  };
}
