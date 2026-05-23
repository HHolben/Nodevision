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
    objects: objects.map((object, index) => validateWorldObject(object, index)),
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
