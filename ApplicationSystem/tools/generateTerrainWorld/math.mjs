// Nodevision/ApplicationSystem/tools/generateTerrainWorld/math.mjs
// This file defines small math helpers used by the terrain generator. It provides shared interpolation utilities for noise and color calculations.

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

