// Nodevision MetaWorld prim schema helpers.
// Prims are declarative JSON only. No executable code is allowed.

export const NV_PRIM_TYPES = Object.freeze({
  NvEntity: "NvEntity",
  NvPlayer: "NvPlayer",
  NvNPC: "NvNPC",
  NvMob: "NvMob",
  NvAIController: "NvAIController",
  NvSpawner: "NvSpawner",
  NvSoundSource: "NvSoundSource",
  NvSoundEmitter: "NvSoundEmitter",
  NvFaction: "NvFaction",
  NvTemplate: "NvTemplate"
});

const ALLOWED_TYPES = new Set(Object.values(NV_PRIM_TYPES));
const FORBIDDEN_KEYS = new Set(["script", "onLoad", "onUpdate", "javascript", "eval"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertNoFunctionsDeep(value, path = "prim") {
  if (typeof value === "function") {
    throw new Error(`Executable value is not allowed at ${path}`);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      assertNoFunctionsDeep(value[i], `${path}[${i}]`);
    }
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k)) {
      throw new Error(`Forbidden key in prim data: ${path}.${k}`);
    }
    assertNoFunctionsDeep(v, `${path}.${k}`);
  }
}

export function validatePrim(prim) {
  if (!isPlainObject(prim)) {
    throw new Error("Prim must be an object.");
  }

  const type = String(prim.type || "");
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(`Unsupported prim type: ${type || "(missing)"}`);
  }

  if (!prim.id || typeof prim.id !== "string") {
    throw new Error("Prim id must be a non-empty string.");
  }

  if (prim.attributes && !isPlainObject(prim.attributes)) {
    throw new Error(`Prim attributes must be an object: ${prim.id}`);
  }
  if (prim.relationships && !isPlainObject(prim.relationships)) {
    throw new Error(`Prim relationships must be an object: ${prim.id}`);
  }
  if (prim.children && !Array.isArray(prim.children)) {
    throw new Error(`Prim children must be an array: ${prim.id}`);
  }
  if (prim.metadata && !isPlainObject(prim.metadata)) {
    throw new Error(`Prim metadata must be an object: ${prim.id}`);
  }

  assertNoFunctionsDeep(prim, `prim(${prim.id})`);

  return true;
}

export function validateWorldPrims(prims = []) {
  if (!Array.isArray(prims)) throw new Error("World prims must be an array.");
  const ids = new Set();
  for (const prim of prims) {
    validatePrim(prim);
    if (ids.has(prim.id)) {
      throw new Error(`Duplicate prim id: ${prim.id}`);
    }
    ids.add(prim.id);
  }
  return true;
}

export function assertUniquePrimIds(prims = []) {
  const ids = new Set();
  for (const prim of prims) {
    const id = String(prim?.id || "");
    if (!id) throw new Error("Prim id must be a non-empty string.");
    if (ids.has(id)) throw new Error(`Duplicate prim id: ${id}`);
    ids.add(id);
  }
  return true;
}

export function normalizePrim(prim) {
  return {
    id: String(prim.id),
    type: String(prim.type),
    attributes: { ...(prim.attributes || {}) },
    relationships: { ...(prim.relationships || {}) },
    children: Array.isArray(prim.children) ? [...prim.children] : [],
    metadata: { ...(prim.metadata || {}) }
  };
}
