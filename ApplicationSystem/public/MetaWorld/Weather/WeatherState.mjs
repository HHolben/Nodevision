// Nodevision/ApplicationSystem/public/MetaWorld/Weather/WeatherState.mjs
// This module normalizes declarative weather configuration and derives a separate deterministic seed without consuming terrain randomness.
import { hash } from '../ProceduralVoxelWorld/SeededVoxelNoise.mjs';
export const CLOUD_DEFAULTS = Object.freeze({ cloudCoverage: .55, cloudBaseAltitude: 80, cloudTopAltitude: 115, wind: [2, .5] });
const finite = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function deriveWeatherSeed(worldSeed = 0) {
  return Math.floor(hash(271, 919, Number(worldSeed) >>> 0) * 4294967295) >>> 0;
}
export function normalizeWeather(config = {}, worldSeed = 0) {
  const source = config && typeof config === 'object' ? config : {};
  const base = finite(source.cloudBaseAltitude, CLOUD_DEFAULTS.cloudBaseAltitude, -10000, 10000);
  const top = finite(source.cloudTopAltitude, Math.max(base + 1, CLOUD_DEFAULTS.cloudTopAltitude), base + 1, base + 1000);
  return {
    enabled: source.enabled !== false,
    seed: Number.isInteger(source.seed) ? source.seed >>> 0 : deriveWeatherSeed(worldSeed),
    cloudCoverage: finite(source.cloudCoverage, CLOUD_DEFAULTS.cloudCoverage, 0, 1),
    cloudBaseAltitude: base,
    cloudTopAltitude: top,
    wind: [0, 1].map(i => finite(source.wind?.[i], CLOUD_DEFAULTS.wind[i], -100, 100))
  };
}
export function weatherDefinition(world = {}) {
  const terrain = world.objects?.find(object => object.generator?.seed !== undefined);
  return normalizeWeather(world.metadata?.weather ?? world.weather, world.metadata?.seed ?? world.seed ?? world.worldSeed ?? terrain?.generator.seed ?? 0);
}
