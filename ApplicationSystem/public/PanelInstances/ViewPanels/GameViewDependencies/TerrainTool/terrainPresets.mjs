// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainPresets.mjs
// This file defines palette presets for Meta World terrain painting and terrain metadata.

export const TERRAIN_KINDS = [
  { id: "grass", label: "Grass", color: "#3f8f46" },
  { id: "soil", label: "Soil", color: "#6b5137" },
  { id: "stone", label: "Stone", color: "#77736a" },
  { id: "sand", label: "Sand", color: "#c9aa5a" },
  { id: "snow", label: "Snow", color: "#e8eef2" },
  { id: "water", label: "Water", color: "#2f83b7", solid: false },
  { id: "lava", label: "Lava", color: "#c94b2b" },
  { id: "path", label: "Path", color: "#8c7651" }
];

export const TERRAIN_GEOMETRY_MODES = [
  { id: "voxel", label: "Voxel" },
  { id: "polygonal", label: "Polygonal" }
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

export function terrainKindById(id) {
  return TERRAIN_KINDS.find((entry) => entry.id === id) || TERRAIN_KINDS[0];
}

export function resolveTerrainColor({ kind, biome, temperature, moisture, elevation } = {}) {
  let color = terrainKindById(kind).color;
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
