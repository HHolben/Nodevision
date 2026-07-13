// Nodevision/ApplicationSystem/public/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs
// Shared identifiers for MetaWorld world-object material JSON records.

export const WORLD_OBJECT_MATERIAL_LIBRARY_PATH = "/MetaWorld/Materials";
export const WORLD_OBJECT_MATERIAL_CATALOG_PATH = "/MetaWorld/Materials.csv";
export const DEFAULT_WORLD_OBJECT_MATERIAL_ID = "PhysicsSolid";
export const DEFAULT_WORLD_OBJECT_MATERIAL_FILE = WORLD_OBJECT_MATERIAL_LIBRARY_PATH + "/Solids/PhysicsSolid.json";
export const DEFAULT_WORLD_GAS_MATERIAL_ID = "WhiteOxygenatedAir";
export const DEFAULT_WORLD_GAS_MATERIAL_FILE = WORLD_OBJECT_MATERIAL_LIBRARY_PATH + "/Gasses/WhiteOxygenatedAir.json";

const DEFAULT_WORLD_OBJECT_MATERIAL_ROWS = [
  { MaterialName: "Physics Solid", MaterialJSONfile: "Materials/Solids/PhysicsSolid.json" },
  { MaterialName: "Physics Frictionless", MaterialJSONfile: "Materials/Solids/PhysicsFrictionless.json" },
  { MaterialName: "Grass", MaterialJSONfile: "Materials/Solids/grass.json" },
  { MaterialName: "Soil", MaterialJSONfile: "Materials/Solids/soil.json" },
  { MaterialName: "Limestone", MaterialJSONfile: "Materials/Solids/limestone.json" },
  { MaterialName: "Sand", MaterialJSONfile: "Materials/Solids/sand.json" },
  { MaterialName: "Snow", MaterialJSONfile: "Materials/Solids/snow.json" },
  { MaterialName: "Lava", MaterialJSONfile: "Materials/Solids/lava.json" },
  { MaterialName: "Gravel", MaterialJSONfile: "Materials/Solids/gravel.json" },
  { MaterialName: "Andesite", MaterialJSONfile: "Materials/Solids/andesite.json" },
  { MaterialName: "Basalt", MaterialJSONfile: "Materials/Solids/basalt.json" },
  { MaterialName: "Claystone", MaterialJSONfile: "Materials/Solids/claystone.json" },
  { MaterialName: "Chalk", MaterialJSONfile: "Materials/Solids/chalk.json" },
  { MaterialName: "Quartzite", MaterialJSONfile: "Materials/Solids/quartzite.json" },
  { MaterialName: "Marble", MaterialJSONfile: "Materials/Solids/marble.json" },
  { MaterialName: "Schist", MaterialJSONfile: "Materials/Solids/schist.json" },
  { MaterialName: "Slate", MaterialJSONfile: "Materials/Solids/slate.json" },
  { MaterialName: "Obsidian", MaterialJSONfile: "Materials/Solids/obsidian.json" },
  { MaterialName: "Pit Foam Block", MaterialJSONfile: "Materials/Solids/PitFoamBlock.json" },
  { MaterialName: "Bouncy Rubber", MaterialJSONfile: "Materials/Solids/BouncyRubber.json" },
  { MaterialName: "Water", MaterialJSONfile: "Materials/Liquids/water.json" },
  { MaterialName: "Lake Water", MaterialJSONfile: "Materials/Liquids/lakewater.json" },
  { MaterialName: "Salt Water", MaterialJSONfile: "Materials/Liquids/saltwater.json" },
  { MaterialName: "Slime", MaterialJSONfile: "Materials/Liquids/slime.json" },
  { MaterialName: "Quicksand", MaterialJSONfile: "Materials/Liquids/quicksand.json" },
  { MaterialName: "Mud", MaterialJSONfile: "Materials/Liquids/mud.json" },
  { MaterialName: "Bog Water", MaterialJSONfile: "Materials/Liquids/bogwater.json" },
  { MaterialName: "Honey", MaterialJSONfile: "Materials/Liquids/honey.json" },
  { MaterialName: "Milk", MaterialJSONfile: "Materials/Liquids/milk.json" },
  { MaterialName: "Tea", MaterialJSONfile: "Materials/Liquids/tea.json" },
  { MaterialName: "Petroleum", MaterialJSONfile: "Materials/Liquids/petroleum.json" },
  { MaterialName: "White Oxygenated Air", MaterialJSONfile: "Materials/Gasses/WhiteOxygenatedAir.json" },
  { MaterialName: "Earth Troposphere", MaterialJSONfile: "Materials/Gasses/EarthTroposphere.json" },
  { MaterialName: "Hydrogen", MaterialJSONfile: "Materials/Gasses/hydrogen.json" },
  { MaterialName: "Helium", MaterialJSONfile: "Materials/Gasses/helium.json" },
  { MaterialName: "Vacuum", MaterialJSONfile: "Materials/Gasses/vacuum.json" },
];

const CANONICAL_MATERIAL_IDS = new Map([
  ["water", "water"],
  ["physicsfrictionless", "PhysicsFrictionless"],
  ["physics frictionless", "PhysicsFrictionless"],
  ["physicssolid", "PhysicsSolid"],
  ["physics solid", "PhysicsSolid"],
  ["pitfoamblock", "PitFoamBlock"],
  ["pit foam block", "PitFoamBlock"],
  ["bouncyrubber", "BouncyRubber"],
  ["bouncy rubber", "BouncyRubber"],
  ["whiteoxygenatedair", "WhiteOxygenatedAir"],
  ["white oxygenated air", "WhiteOxygenatedAir"],
  ["earthtroposphere", "EarthTroposphere"],
  ["earth troposphere", "EarthTroposphere"],
  ["vacuum", "vacuum"],
  ["lake water", "lakewater"],
  ["salt water", "saltwater"],
  ["bog water", "bogwater"]
]);

function stripMaterialFileName(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  const fileName = text.split("/").pop() || text;
  return fileName.replace(/\.json$/i, "").trim();
}

function normalizeCatalogMaterialFile(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  if (/^https?:\/\//i.test(text) || text.startsWith("/")) return text;
  const relative = text.replace(/^\.\//, "");
  if (relative.startsWith("MetaWorld/")) return "/" + relative;
  if (relative.includes("/")) return "/MetaWorld/" + relative;
  return WORLD_OBJECT_MATERIAL_LIBRARY_PATH + "/" + relative;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "");

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === "\"" && source[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else if (ch === "\"") {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  const [headerRow, ...dataRows] = Array.isArray(rows) ? rows : [];
  const headers = Array.isArray(headerRow) ? headerRow.map((header) => String(header || "").trim()) : [];
  if (headers.length === 0) return [];
  return dataRows
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim()))
    .map((row) => {
      const out = {};
      headers.forEach((header, index) => {
        if (header) out[header] = String(row[index] || "").trim();
      });
      return out;
    });
}

function readCsvField(row, names) {
  for (const name of names) {
    if (typeof row?.[name] === "string" && row[name].trim()) return row[name].trim();
  }
  const lowered = new Map(Object.entries(row || {}).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    const value = lowered.get(String(name).toLowerCase());
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeCatalogEntry(row) {
  const materialName = readCsvField(row, ["MaterialName", "materialName", "name", "displayName"]);
  const materialJSONfile = readCsvField(row, ["MaterialJSONfile", "MaterialJSONFile", "materialJSONfile", "materialJsonFile", "file"]);
  const materialFile = normalizeCatalogMaterialFile(materialJSONfile);
  const materialId = normalizeWorldObjectMaterialId(materialFile, materialName);
  const matterState = normalizeWorldObjectMatterState(readCsvField(row, ["MatterState", "matterState", "stateOfMatter"]));
  return {
    materialName: materialName || materialId || materialJSONfile,
    materialJSONfile,
    materialFile,
    materialId,
    matterState,
  };
}

function fallbackWorldObjectMaterialCatalog() {
  return DEFAULT_WORLD_OBJECT_MATERIAL_ROWS.map(normalizeCatalogEntry);
}

let materialCatalogPromise = null;

export function normalizeWorldObjectMaterialId(value, fallback = "") {
  const raw = stripMaterialFileName(value);
  if (!raw) return stripMaterialFileName(fallback);
  return CANONICAL_MATERIAL_IDS.get(raw.toLowerCase()) || raw;
}

let defaultWorldObjectMaterialFileMap = null;

function defaultMaterialFilesById() {
  if (defaultWorldObjectMaterialFileMap) return defaultWorldObjectMaterialFileMap;
  defaultWorldObjectMaterialFileMap = new Map();
  DEFAULT_WORLD_OBJECT_MATERIAL_ROWS.forEach((row) => {
    const materialFile = normalizeCatalogMaterialFile(row.MaterialJSONfile);
    const materialId = normalizeWorldObjectMaterialId(materialFile, row.MaterialName);
    if (materialId && materialFile) defaultWorldObjectMaterialFileMap.set(materialId.toLowerCase(), materialFile);
    const displayId = normalizeWorldObjectMaterialId(row.MaterialName, "");
    if (displayId && materialFile) defaultWorldObjectMaterialFileMap.set(displayId.toLowerCase(), materialFile);
  });
  return defaultWorldObjectMaterialFileMap;
}

export function materialFileForWorldObjectMaterial(value) {
  const id = normalizeWorldObjectMaterialId(value, "");
  if (!id) return "";
  const mapped = defaultMaterialFilesById().get(id.toLowerCase());
  return mapped || WORLD_OBJECT_MATERIAL_LIBRARY_PATH + "/" + id + ".json";
}

export function normalizeWorldObjectMatterState(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function readWorldObjectMatterState(def = {}, fallback = "") {
  const candidates = [
    def?.MatterState,
    def?.matterState,
    def?.stateOfMatter,
    def?.material?.MatterState,
    def?.material?.matterState,
    def?.collider?.MatterState,
    def?.collider?.matterState,
    def?.collider?.state,
  ];
  for (const candidate of candidates) {
    const state = normalizeWorldObjectMatterState(candidate);
    if (state) return state;
  }
  if (def?.isWater === true || def?.isLiquid === true || def?.water === true || def?.liquid === true) return "liquid";
  return normalizeWorldObjectMatterState(fallback);
}

export function isLiquidWorldObjectMaterial(def = {}) {
  return readWorldObjectMatterState(def) === "liquid";
}

export function parseWorldObjectMaterialCsv(text) {
  return rowsToObjects(parseCsvRows(text))
    .map(normalizeCatalogEntry)
    .filter((entry) => entry.materialName && entry.materialFile);
}

async function loadCatalogMaterialDefinition(entry, fetcher, cacheMode) {
  if (!entry?.materialFile || typeof fetcher !== "function") return null;
  try {
    const response = await fetcher(entry.materialFile, { cache: cacheMode });
    if (!response?.ok) throw new Error("HTTP " + (response?.status || "error"));
    return await response.json();
  } catch (err) {
    console.warn("World object material JSON failed to load:", entry.materialFile, err);
    return null;
  }
}

function readWorldObjectMaterialColor(def = {}) {
  const candidates = [
    def?.defaultColor,
    def?.rendering?.color,
    def?.color,
    def?.material?.color,
    def?.terrain?.color
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function enrichMaterialCatalogEntry(entry, materialDefinition = null) {
  const matterState = readWorldObjectMatterState(materialDefinition || {}, entry.matterState);
  const color = readWorldObjectMaterialColor(materialDefinition || {});
  return {
    ...entry,
    displayName: materialDefinition?.displayName || entry.materialName,
    matterState,
    MatterState: matterState || undefined,
    color: color || undefined,
    materialDefinition: materialDefinition || undefined,
  };
}

async function enrichMaterialCatalog(entries, fetcher, cacheMode) {
  if (typeof fetcher !== "function") return entries.map((entry) => enrichMaterialCatalogEntry(entry));
  return Promise.all(entries.map(async (entry) => {
    const materialDefinition = await loadCatalogMaterialDefinition(entry, fetcher, cacheMode);
    return enrichMaterialCatalogEntry(entry, materialDefinition);
  }));
}

export async function loadWorldObjectMaterialCatalog(options = {}) {
  const force = options.force === true;
  if (!force && materialCatalogPromise) return materialCatalogPromise;

  materialCatalogPromise = (async () => {
    const fetcher = options.fetch || globalThis.fetch;
    const cacheMode = force ? "reload" : "no-cache";
    let entries = fallbackWorldObjectMaterialCatalog();
    if (typeof fetcher === "function") {
      try {
        const response = await fetcher(WORLD_OBJECT_MATERIAL_CATALOG_PATH, { cache: cacheMode });
        if (!response?.ok) throw new Error("HTTP " + (response?.status || "error"));
        const parsed = parseWorldObjectMaterialCsv(await response.text());
        if (parsed.length > 0) entries = parsed;
      } catch (err) {
        console.warn("World object material catalog failed to load:", err);
      }
    }
    return enrichMaterialCatalog(entries, fetcher, cacheMode);
  })();

  return materialCatalogPromise;
}

function pushIfString(target, value) {
  if (typeof value === "string" && value.trim()) target.push(value.trim());
}

export function readWorldObjectPhysicsMaterialId(def = {}, fallback = "") {
  const candidates = [];
  pushIfString(candidates, def?.physicsMaterialId);
  pushIfString(candidates, def?.physicsMaterial);
  pushIfString(candidates, def?.worldObjectMaterialId);
  pushIfString(candidates, def?.colliderMaterialId);
  pushIfString(candidates, def?.collider?.materialId);

  const material = def?.material;
  if (typeof material === "string") {
    pushIfString(candidates, material);
  } else if (material && typeof material === "object") {
    pushIfString(candidates, material.physicsMaterialId);
    pushIfString(candidates, material.id);
    pushIfString(candidates, material.name);
  }

  const directMaterialType = typeof def?.materialType === "string" ? def.materialType.trim().toLowerCase() : "";
  if (directMaterialType === "water") candidates.push("water");

  for (const candidate of candidates) {
    const normalized = normalizeWorldObjectMaterialId(candidate, "");
    if (normalized) return normalized;
  }
  return normalizeWorldObjectMaterialId(fallback, "");
}

export function applyDefaultWorldObjectPhysicsMaterial(def = {}, { force = false } = {}) {
  if (!def || typeof def !== "object") return def;
  const existing = readWorldObjectPhysicsMaterialId(def, "");
  const materialId = !force && existing ? existing : DEFAULT_WORLD_OBJECT_MATERIAL_ID;
  def.physicsMaterialId = materialId;
  if (!def.physicsMaterialFile || force) {
    def.physicsMaterialFile = materialFileForWorldObjectMaterial(materialId);
  }
  return def;
}
