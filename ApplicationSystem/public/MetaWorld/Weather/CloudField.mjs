// Nodevision/ApplicationSystem/public/MetaWorld/Weather/CloudField.mjs
// This module samples stable large atmospheric regions as coherent clusters of cloud lobes independently of terrain and illumination.
import { hash, noise } from '../ProceduralVoxelWorld/SeededVoxelNoise.mjs';
export const CLOUD_REGION_SIZE = 128;
export const CLOUD_REGION_RADIUS = 3;
export function cloudRegion(rx, rz, state) {
  const lobes = [], seed = state.seed;
  if (!state.enabled || state.cloudCoverage === 0) return lobes;
  for (let i = 0; i < 6; i++) {
    const random = n => hash(rx * 67 + i * 11 + n, rz * 71 + n, seed);
    const x = (rx + random(1)) * CLOUD_REGION_SIZE;
    const z = (rz + random(2)) * CLOUD_REGION_SIZE;
    const field = noise(x / 320, z / 320, seed ^ 884239);
    if (field < 1 - state.cloudCoverage) continue;
    const width = 12 + random(3) * 22, depth = 10 + random(4) * 18;
    const height = Math.min((state.cloudTopAltitude - state.cloudBaseAltitude) / 2, 5 + random(5) * 9);
    const y = state.cloudBaseAltitude + height + random(6) * Math.max(0, state.cloudTopAltitude - state.cloudBaseAltitude - height * 2);
    for (let l = 0; l < 5; l++) {
      const angle = l * Math.PI * 2 / 5;
      lobes.push({ position: [x + Math.cos(angle) * width * .55, y, z + Math.sin(angle) * depth * .55],
        scale: [width * (.65 + random(10 + l) * .25), height * (.7 + random(20 + l) * .3), depth * .75] });
    }
  }
  return lobes;
}
export function cloudOffset(state, time) {
  return state.wind.map(speed => speed * time);
}
