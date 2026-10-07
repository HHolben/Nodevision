// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/AstronomyConfig.mjs
// This module defines explicit Earth-analogue astronomy defaults without deriving bodies or observer coordinates from atmosphere.
export const MIDWEST_OBSERVER = Object.freeze({ latitude: 40, longitude: -90 });
export function earthSandboxAstronomy() {
  return { model: 'earth', clock: { mode: 'system-local', timeScale: 1 }, observer: { ...MIDWEST_OBSERVER },
    bodies: [{ id: 'sun', type: 'sun', intensity: 2 }, { id: 'moon', type: 'moon' }], stars: { enabled: true } };
}
export function normalizeAstronomy(value) {
  if (!value || value.model !== 'earth' || value.enabled === false) return null;
  const observer = value.observer || MIDWEST_OBSERVER;
  if (!Number.isFinite(observer.latitude) || Math.abs(observer.latitude) > 90 || !Number.isFinite(observer.longitude) || Math.abs(observer.longitude) > 180) return null;
  const clock = value.clock || {};
  if (!['system-local', 'fixed', 'saved'].includes(clock.mode || 'system-local')) return null;
  return { ...value, observer: { ...observer }, clock: { ...clock, mode: clock.mode || 'system-local' },
    bodies: (value.bodies || []).filter(b => b.enabled !== false && ['sun', 'moon'].includes(b.type)).slice(0, 8), stars: { enabled: value.stars?.enabled === true } };
}
