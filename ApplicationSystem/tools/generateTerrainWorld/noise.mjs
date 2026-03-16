// Nodevision/ApplicationSystem/tools/generateTerrainWorld/noise.mjs
// This file defines 2D value noise and fractal noise functions for terrain height generation. It produces smooth deterministic noise fields based on a seed string.

import { xmur3 } from "./random.mjs";
import { lerp } from "./math.mjs";

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

export function fractalNoise2D(x, y, params) {
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

