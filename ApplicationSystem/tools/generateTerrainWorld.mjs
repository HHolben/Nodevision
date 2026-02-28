import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULTS = {
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

function parseArgs(argv) {
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

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seedInt) {
  let t = seedInt >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRandom(seedText) {
  const hash = xmur3(seedText);
  return mulberry32(hash());
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function hash2D(x, y, seed) {
  const str = `${seed}:${x}:${y}`;
  const hash = xmur3(str);
  return hash() / 4294967295;
}

function valueNoise2D(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smoothStep(x - x0);
  const sy = smoothStep(y - y0);

  const n00 = hash2D(x0, y0, seed);
  const n10 = hash2D(x1, y0, seed);
  const n01 = hash2D(x0, y1, seed);
  const n11 = hash2D(x1, y1, seed);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

function fractalNoise2D(x, y, params) {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let maxAmp = 0;

  for (let i = 0; i < params.octaves; i += 1) {
    const noise = valueNoise2D(x * frequency, y * frequency, `${params.seed}:${i}`);
    total += noise * amplitude;
    maxAmp += amplitude;
    amplitude *= params.persistence;
    frequency *= params.lacunarity;
  }

  return maxAmp > 0 ? total / maxAmp : 0;
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16)
  };
}

function rgbToHex(rgb) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`;
}

function blendHex(lowHex, highHex, t) {
  const a = hexToRgb(lowHex);
  const b = hexToRgb(highHex);
  return rgbToHex({
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t)
  });
}

function buildTerrainWorld(params) {
  const objects = [];
  const side = params.tiles;
  const halfSpan = (side * params.tileSize) / 2;
  let centerHeight = params.minHeight;

  for (let ix = 0; ix < side; ix += 1) {
    for (let iz = 0; iz < side; iz += 1) {
      const noiseX = ix * params.noiseScale;
      const noiseZ = iz * params.noiseScale;
      const noise = fractalNoise2D(noiseX, noiseZ, params);
      const h = lerp(params.minHeight, params.maxHeight, noise);

      const x = -halfSpan + params.tileSize * 0.5 + ix * params.tileSize;
      const z = -halfSpan + params.tileSize * 0.5 + iz * params.tileSize;
      const y = h / 2;
      const colorT = (h - params.minHeight) / Math.max(1e-9, params.maxHeight - params.minHeight);
      const color = blendHex(params.colorLow, params.colorHigh, colorT);

      objects.push({
        type: "box",
        position: [x, y, z],
        size: [params.tileSize, h, params.tileSize],
        color,
        isSolid: true,
        tag: "terrain"
      });

      if (ix === Math.floor(side / 2) && iz === Math.floor(side / 2)) {
        centerHeight = h;
      }
    }
  }

  objects.push({
    type: "box",
    position: [0, centerHeight + params.spawnHeightOffset, 0],
    size: [0.8, 1.8, 0.8],
    color: "#f5f5f5",
    isSolid: false,
    tag: "spawn",
    spawnId: "terrain_spawn",
    spawnYaw: 0
  });

  return {
    worldMode: "3d",
    metadata: {
      generator: "tools/generateTerrainWorld.mjs",
      generatedAt: new Date().toISOString(),
      params: {
        tiles: params.tiles,
        tileSize: params.tileSize,
        minHeight: params.minHeight,
        maxHeight: params.maxHeight,
        noiseScale: params.noiseScale,
        octaves: params.octaves,
        persistence: params.persistence,
        lacunarity: params.lacunarity,
        seed: params.seed
      }
    },
    objects
  };
}

function buildHtmlDocument(worldName, worldDefinition) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(worldName)}</title>
</head>
<body>
  <h1>${escapeHtml(worldName)}</h1>
  <p>Procedurally generated terrain world.</p>

  <script type="application/json">
${JSON.stringify(worldDefinition, null, 2)}
  </script>
</body>
</html>
`;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function main() {
  const params = parseArgs(process.argv.slice(2));
  // Burn one random value from seed to make deterministic runs easier to verify if needed.
  createSeededRandom(params.seed)();
  const world = buildTerrainWorld(params);
  const html = buildHtmlDocument(params.worldName, world);
  const outputPath = resolve(params.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, "utf8");
  console.log(`Generated terrain world: ${outputPath}`);
  console.log(`Tiles: ${params.tiles} x ${params.tiles} (${params.tiles * params.tiles} total)`);
}

main();
