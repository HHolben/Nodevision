// Nodevision/ApplicationSystem/public/engine/audio/SpatialAudioManager/math.mjs
// This file defines math helpers used by the Nodevision SpatialAudioManager. It normalizes vectors and computes distances and gain falloff values.

export function vec3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) return [...fallback];
  return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
}

export function distance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}

export function computeInverseSquareGain(distanceMeters, maxDistance, rolloff = 1) {
  if (distanceMeters >= maxDistance) return 0;
  const d = Math.max(0.001, distanceMeters);
  const gain = 1 / (1 + rolloff * d * d);
  return Math.max(0, Math.min(1, gain));
}

