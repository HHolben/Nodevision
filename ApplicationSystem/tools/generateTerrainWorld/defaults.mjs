// Nodevision/ApplicationSystem/tools/generateTerrainWorld/defaults.mjs
// This file defines default parameter values for the terrain world generator CLI. It centralizes configuration so other modules can validate and format consistent options.

export const DEFAULTS = {
  output: "Notebook/GeneratedTerrainWorld.html",
  worldName: "Generated Terrain World",
  tiles: 32,
  tileSize: 1,
  minHeight: 0.4,
  maxHeight: 6,
  noiseScale: 0.08,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  seed: "nodevision-terrain",
  colorLow: "#2f6f3f",
  colorHigh: "#d8cc98",
  spawnHeightOffset: 2
};

