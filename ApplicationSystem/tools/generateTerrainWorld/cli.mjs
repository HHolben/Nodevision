// Nodevision/ApplicationSystem/tools/generateTerrainWorld/cli.mjs
// This file defines CLI argument parsing and validation for the terrain world generator. It normalizes option values and exits cleanly when users request help.

import { DEFAULTS } from "./defaults.mjs";

function usage() {
  console.log(`Usage:
  node tools/generateTerrainWorld.mjs [options]

Options:
  --output <path>           Output world HTML file (default: ${DEFAULTS.output})
  --worldName <name>        Display name for the world (default: "${DEFAULTS.worldName}")
  --tiles <int>             Number of tiles on each side of the square terrain (default: ${DEFAULTS.tiles})
  --tileSize <number>       Width/depth of each tile (default: ${DEFAULTS.tileSize})
  --minHeight <number>      Minimum tile height (default: ${DEFAULTS.minHeight})
  --maxHeight <number>      Maximum tile height (default: ${DEFAULTS.maxHeight})
  --noiseScale <number>     Terrain frequency; lower is smoother (default: ${DEFAULTS.noiseScale})
  --octaves <int>           Fractal noise octaves (default: ${DEFAULTS.octaves})
  --persistence <number>    Fractal noise amplitude falloff (default: ${DEFAULTS.persistence})
  --lacunarity <number>     Fractal noise frequency growth (default: ${DEFAULTS.lacunarity})
  --seed <text>             Seed used for deterministic terrain generation
  --colorLow <hex>          Low elevation color (default: ${DEFAULTS.colorLow})
  --colorHigh <hex>         High elevation color (default: ${DEFAULTS.colorHigh})
  --spawnHeightOffset <n>   Spawn point offset above center tile (default: ${DEFAULTS.spawnHeightOffset})
  --help                    Show this help
`);
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function normalizeParams(params) {
  const numericKeys = [
    "tiles",
    "tileSize",
    "minHeight",
    "maxHeight",
    "noiseScale",
    "octaves",
    "persistence",
    "lacunarity",
    "spawnHeightOffset"
  ];
  const normalized = { ...params };
  for (const key of numericKeys) {
    normalized[key] = Number(normalized[key]);
    if (!Number.isFinite(normalized[key])) {
      throw new Error(`Invalid number for --${key}`);
    }
  }
  normalized.tiles = Math.max(1, Math.floor(normalized.tiles));
  normalized.octaves = Math.max(1, Math.floor(normalized.octaves));
  if (normalized.maxHeight < normalized.minHeight) {
    throw new Error("--maxHeight must be >= --minHeight");
  }
  if (normalized.noiseScale <= 0) {
    throw new Error("--noiseScale must be > 0");
  }
  if (normalized.tileSize <= 0) {
    throw new Error("--tileSize must be > 0");
  }
  if (normalized.lacunarity <= 0) {
    throw new Error("--lacunarity must be > 0");
  }
  if (!isHexColor(normalized.colorLow) || !isHexColor(normalized.colorHigh)) {
    throw new Error("--colorLow and --colorHigh must be hex colors like #aabbcc");
  }
  return normalized;
}

export function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const [rawKey, maybeValue] = token.slice(2).split("=", 2);
    const key = rawKey.trim();
    if (key === "help") {
      usage();
      process.exit(0);
    }
    let value = maybeValue;
    if (value === undefined) {
      if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      value = argv[i + 1];
      i += 1;
    }
    if (!(key in out)) {
      throw new Error(`Unknown option --${key}`);
    }
    out[key] = value;
  }
  return normalizeParams(out);
}

