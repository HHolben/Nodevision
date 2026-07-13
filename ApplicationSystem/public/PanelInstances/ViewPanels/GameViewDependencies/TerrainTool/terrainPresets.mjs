// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainPresets.mjs
// This file defines palette presets for Meta World terrain painting and terrain metadata.

import {
  loadWorldObjectMaterialCatalog,
  readWorldObjectMatterState
} from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";

export const TERRAIN_KINDS = [
  { id: "grass", label: "Grass", color: "#3f8f46", MatterState: "solid", matterState: "solid", solid: true },
  { id: "soil", label: "Soil", color: "#6b5137", MatterState: "solid", matterState: "solid", solid: true },
  { id: "limestone", label: "Limestone", color: "#b8b59f", MatterState: "solid", matterState: "solid", solid: true },
  { id: "sand", label: "Sand", color: "#c9aa5a", MatterState: "solid", matterState: "solid", solid: true },
  { id: "snow", label: "Snow", color: "#e8eef2", MatterState: "solid", matterState: "solid", solid: true },
  { id: "lava", label: "Lava", color: "#c94b2b", MatterState: "solid", matterState: "solid", solid: true },
  { id: "gravel", label: "Gravel", color: "#8c887a", MatterState: "solid", matterState: "solid", solid: true }
];

const TERRAIN_KIND_ALIASES = new Map([
  ["path", "gravel"]
]);

export const TERRAIN_GEOMETRY_MODES = [
  { id: "voxel", label: "Voxel" },
  { id: "polygonal", label: "Polygonal" }
];

export const POLYGONAL_INSERT_SHAPES = [
  { id: "hills", label: "Hills" },
  { id: "cone", label: "Cone" },
  { id: "rectangular-prism", label: "Rectangular Prism" },
  { id: "cylinder", label: "Cylinder" },
  { id: "equation-object", label: "Equation / Inequality Object" }
];

export const TERRAIN_TEXTURES = [
  { id: "solid", label: "Solid Color" },
  { id: "speckled", label: "Speckled" },
  { id: "striated", label: "Striated" },
  { id: "cracked", label: "Cracked" },
  { id: "ripples", label: "Ripples" }
];

export const TERRAIN_BIOMES = [
  { id: "plains", label: "Plains" },
  { id: "forest", label: "Forest" },
  { id: "desert", label: "Desert" },
  { id: "tundra", label: "Tundra" },
  { id: "mountain", label: "Mountain" },
  { id: "swamp", label: "Swamp" },
  { id: "coast", label: "Coast" },
  { id: "volcanic", label: "Volcanic" }
];

export const TEMPERATURE_BANDS = [
  { id: "freezing", label: "Freezing" },
  { id: "cold", label: "Cold" },
  { id: "temperate", label: "Temperate" },
  { id: "warm", label: "Warm" },
  { id: "hot", label: "Hot" }
];

export const MOISTURE_BANDS = [
  { id: "arid", label: "Arid" },
  { id: "dry", label: "Dry" },
  { id: "balanced", label: "Balanced" },
  { id: "wet", label: "Wet" },
  { id: "saturated", label: "Saturated" }
];

function normalizedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeTerrainKindId(id) {
  const text = normalizedText(id);
  if (!text) return "";
  return TERRAIN_KIND_ALIASES.get(text.toLowerCase()) || text;
}

function sameTerrainKindId(left, right) {
  const a = normalizeTerrainKindId(left).toLowerCase();
  const b = normalizeTerrainKindId(right).toLowerCase();
  return Boolean(a && b && a === b);
}

function normalizeHexColor(value, fallback = "#777777") {
  const text = normalizedText(value);
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function terrainFallbackById(id) {
  const normalized = normalizeTerrainKindId(id);
  return TERRAIN_KINDS.find((entry) => sameTerrainKindId(entry.id, normalized)) || null;
}

export function terrainKindById(id, options = TERRAIN_KINDS) {
  const normalized = normalizeTerrainKindId(id);
  const list = Array.isArray(options) && options.length ? options : TERRAIN_KINDS;
  return list.find((entry) => sameTerrainKindId(entry?.id, normalized))
    || terrainFallbackById(normalized)
    || list[0]
    || TERRAIN_KINDS[0];
}

export function isLiquidTerrainKind(entry = {}) {
  return readWorldObjectMatterState(entry) === "liquid" || entry?.isLiquid === true;
}

export function terrainMaterialOptionFromCatalogEntry(entry = {}) {
  const materialDefinition = entry.materialDefinition && typeof entry.materialDefinition === "object"
    ? entry.materialDefinition
    : {};
  const id = normalizeTerrainKindId(entry.materialId || entry.id || entry.materialName || entry.displayName);
  if (!id) return null;
  const fallback = terrainFallbackById(id);
  const matterState = readWorldObjectMatterState(entry, readWorldObjectMatterState(materialDefinition, fallback?.MatterState || fallback?.matterState || ""));
  const isLiquid = matterState === "liquid";
  const colliderSolid = materialDefinition?.collider?.solid;
  const color = normalizeHexColor(entry.color || materialDefinition?.rendering?.color || fallback?.color, fallback?.color || "#777777");
  const label = entry.displayName || entry.materialName || fallback?.label || id;

  return {
    id,
    label,
    color,
    solid: isLiquid ? false : colliderSolid !== false,
    MatterState: matterState || undefined,
    matterState,
    isLiquid,
    physicsMaterialId: entry.materialId || id,
    physicsMaterialFile: entry.materialFile || "",
    materialName: entry.materialName || label
  };
}

export async function loadTerrainMaterialOptions(options = {}) {
  const catalog = await loadWorldObjectMaterialCatalog(options);
  const seen = new Set();
  const materialOptions = catalog
    .map((entry) => terrainMaterialOptionFromCatalogEntry(entry))
    .filter((entry) => {
      const id = entry?.id || "";
      const key = id.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return materialOptions.length > 0 ? materialOptions : TERRAIN_KINDS.slice();
}

function hexToRgb(hex) {
  const parsed = Number.parseInt(String(hex || "#777777").replace("#", ""), 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255
  };
}

function rgbToHex({ r, g, b }) {
  const value = (Math.max(0, Math.min(255, Math.round(r))) << 16)
    | (Math.max(0, Math.min(255, Math.round(g))) << 8)
    | Math.max(0, Math.min(255, Math.round(b)));
  return `#${value.toString(16).padStart(6, "0")}`;
}

function mixColor(base, tint, amount) {
  const a = hexToRgb(base);
  const b = hexToRgb(tint);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount
  });
}

export function resolveTerrainColor({ kind, biome, temperature, moisture, elevation, materialOptions = null } = {}) {
  let color = terrainKindById(kind, materialOptions).color;
  if (biome === "forest") color = mixColor(color, "#1f5e3a", 0.22);
  if (biome === "desert") color = mixColor(color, "#d9b25e", 0.28);
  if (biome === "tundra") color = mixColor(color, "#dce9ec", 0.32);
  if (biome === "swamp") color = mixColor(color, "#34482f", 0.28);
  if (biome === "volcanic") color = mixColor(color, "#302928", 0.34);
  if (temperature === "freezing" || temperature === "cold") color = mixColor(color, "#dbe9f0", 0.18);
  if (temperature === "hot") color = mixColor(color, "#d18945", 0.16);
  if (moisture === "wet" || moisture === "saturated") color = mixColor(color, "#2f6f73", 0.14);
  if (moisture === "arid") color = mixColor(color, "#d6bd7a", 0.16);
  if (Number.isFinite(elevation) && elevation > 3) color = mixColor(color, "#e8e2cf", Math.min(0.22, elevation / 28));
  return color;
}
