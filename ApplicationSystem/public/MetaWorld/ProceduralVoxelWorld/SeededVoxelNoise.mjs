// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/SeededVoxelNoise.mjs
// This module provides coordinate-derived hashing and smooth value noise shared by terrain and procedural features.
export function hash(x, z, seed) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const smooth = t => t * t * (3 - 2 * t);
  const a = smooth(x - ix), b = smooth(z - iz);
  const mix = (p, q, t) => p + (q - p) * t;
  return mix(mix(hash(ix, iz, seed), hash(ix + 1, iz, seed), a),
    mix(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), a), b);
}
