// Nodevision/ApplicationSystem/public/Settings/soundSettingsModel.mjs
// This file defines shared focus background audio defaults and client-side sanitization utilities used by the sound settings UI and player modules.

export const DEFAULT_SOUND_SETTINGS = Object.freeze({
  focusAudioEnabled: false,
  volume: 0.035,
  baseMinHz: 160,
  baseMaxHz: 260,
  beatMinHz: 6,
  beatMaxHz: 12,
  changeEveryMs: 45000,
});

const LIMITS = Object.freeze({
  volume: [0, 0.15],
  baseMinHz: [80, 600],
  baseMaxHz: [80, 800],
  beatMinHz: [1, 30],
  beatMaxHz: [1, 40],
  changeEveryMs: [5000, 300000],
});

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < min) return min;
  if (numeric > max) return max;
  return numeric;
}

export function sanitizeSoundSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const merged = { ...DEFAULT_SOUND_SETTINGS, ...source };

  const settings = {
    focusAudioEnabled: Boolean(merged.focusAudioEnabled),
    volume: clampNumber(merged.volume, LIMITS.volume[0], LIMITS.volume[1], DEFAULT_SOUND_SETTINGS.volume),
    baseMinHz: clampNumber(merged.baseMinHz, LIMITS.baseMinHz[0], LIMITS.baseMinHz[1], DEFAULT_SOUND_SETTINGS.baseMinHz),
    baseMaxHz: clampNumber(merged.baseMaxHz, LIMITS.baseMaxHz[0], LIMITS.baseMaxHz[1], DEFAULT_SOUND_SETTINGS.baseMaxHz),
    beatMinHz: clampNumber(merged.beatMinHz, LIMITS.beatMinHz[0], LIMITS.beatMinHz[1], DEFAULT_SOUND_SETTINGS.beatMinHz),
    beatMaxHz: clampNumber(merged.beatMaxHz, LIMITS.beatMaxHz[0], LIMITS.beatMaxHz[1], DEFAULT_SOUND_SETTINGS.beatMaxHz),
    changeEveryMs: Math.round(
      clampNumber(merged.changeEveryMs, LIMITS.changeEveryMs[0], LIMITS.changeEveryMs[1], DEFAULT_SOUND_SETTINGS.changeEveryMs),
    ),
  };

  if (settings.baseMinHz > settings.baseMaxHz) {
    const previousMin = settings.baseMinHz;
    settings.baseMinHz = settings.baseMaxHz;
    settings.baseMaxHz = previousMin;
  }

  if (settings.beatMinHz > settings.beatMaxHz) {
    const previousMin = settings.beatMinHz;
    settings.beatMinHz = settings.beatMaxHz;
    settings.beatMaxHz = previousMin;
  }

  return settings;
}
