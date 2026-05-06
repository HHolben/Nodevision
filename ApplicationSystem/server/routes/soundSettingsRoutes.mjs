// Nodevision/ApplicationSystem/server/routes/soundSettingsRoutes.mjs
// This file registers focus background audio settings endpoints so the client can load and persist sanitized sound preferences in UserSettings.

import path from "node:path";
import fsPromises from "node:fs/promises";

const DEFAULT_SOUND_SETTINGS = Object.freeze({
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

function sanitizeSoundSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const next = {
    focusAudioEnabled: Boolean(source.focusAudioEnabled),
    volume: clampNumber(source.volume, LIMITS.volume[0], LIMITS.volume[1], DEFAULT_SOUND_SETTINGS.volume),
    baseMinHz: clampNumber(source.baseMinHz, LIMITS.baseMinHz[0], LIMITS.baseMinHz[1], DEFAULT_SOUND_SETTINGS.baseMinHz),
    baseMaxHz: clampNumber(source.baseMaxHz, LIMITS.baseMaxHz[0], LIMITS.baseMaxHz[1], DEFAULT_SOUND_SETTINGS.baseMaxHz),
    beatMinHz: clampNumber(source.beatMinHz, LIMITS.beatMinHz[0], LIMITS.beatMinHz[1], DEFAULT_SOUND_SETTINGS.beatMinHz),
    beatMaxHz: clampNumber(source.beatMaxHz, LIMITS.beatMaxHz[0], LIMITS.beatMaxHz[1], DEFAULT_SOUND_SETTINGS.beatMaxHz),
    changeEveryMs: clampNumber(
      source.changeEveryMs,
      LIMITS.changeEveryMs[0],
      LIMITS.changeEveryMs[1],
      DEFAULT_SOUND_SETTINGS.changeEveryMs,
    ),
  };

  if (next.baseMinHz > next.baseMaxHz) {
    const swappedMin = next.baseMaxHz;
    next.baseMaxHz = next.baseMinHz;
    next.baseMinHz = swappedMin;
  }

  if (next.beatMinHz > next.beatMaxHz) {
    const swappedMin = next.beatMaxHz;
    next.beatMaxHz = next.beatMinHz;
    next.beatMinHz = swappedMin;
  }

  next.changeEveryMs = Math.round(next.changeEveryMs);

  return next;
}

async function loadSoundSettings(filePath) {
  try {
    const raw = await fsPromises.readFile(filePath, "utf8");
    if (!raw.trim()) return { ...DEFAULT_SOUND_SETTINGS };
    return sanitizeSoundSettings(JSON.parse(raw));
  } catch (err) {
    if (err?.code === "ENOENT") return { ...DEFAULT_SOUND_SETTINGS };
    if (err instanceof SyntaxError) {
      console.warn("Invalid SoundSettings.json; using defaults.", err.message);
      return { ...DEFAULT_SOUND_SETTINGS };
    }
    throw err;
  }
}

async function saveSoundSettings(filePath, settings) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsPromises.writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  await fsPromises.rename(tempPath, filePath);
}

export function registerSoundSettingsRoutes(app, ctx) {
  const userSettingsDir = ctx.userSettingsDir;
  const soundSettingsFile = path.join(userSettingsDir, "SoundSettings.json");

  app.get("/api/sound-settings", async (req, res) => {
    try {
      // Fixed file path under UserSettings; no request-derived path input.
      await fsPromises.mkdir(userSettingsDir, { recursive: true });
      const settings = await loadSoundSettings(soundSettingsFile);
      res.json(settings);
    } catch (err) {
      console.error("Error loading sound settings:", err);
      res.status(500).json({ error: "Failed to load sound settings" });
    }
  });

  app.post("/api/sound-settings", async (req, res) => {
    try {
      // Fixed file path under UserSettings; no request-derived path input.
      await fsPromises.mkdir(userSettingsDir, { recursive: true });
      const sanitized = sanitizeSoundSettings(req.body);
      await saveSoundSettings(soundSettingsFile, sanitized);
      res.json({ success: true, settings: sanitized });
    } catch (err) {
      console.error("Error saving sound settings:", err);
      res.status(500).json({ success: false, error: "Failed to save sound settings" });
    }
  });
}
