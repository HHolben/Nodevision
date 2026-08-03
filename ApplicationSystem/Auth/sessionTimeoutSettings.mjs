// Nodevision/ApplicationSystem/Auth/sessionTimeoutSettings.mjs
// This module manages configurable session timeout limits and persists timeout settings for Nodevision authentication sessions.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../shared/serverContext.mjs';

const ctx = createServerContext();
const DATA_DIR = ctx.accountsDataDir;
const SESSION_SETTINGS_FILE = path.join(DATA_DIR, 'sessionSettings.json');
export const MIN_SESSION_TIMEOUT_SECONDS = 60;
export const MAX_SESSION_TIMEOUT_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_SESSION_TIMEOUT_SECONDS = normalizeSessionTimeoutSeconds(
  process.env.NODEVISION_SESSION_TTL_SECONDS,
  60 * 60
);

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function normalizeSessionTimeoutSeconds(value, fallback = DEFAULT_SESSION_TIMEOUT_SECONDS) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(
    MAX_SESSION_TIMEOUT_SECONDS,
    Math.max(MIN_SESSION_TIMEOUT_SECONDS, Math.round(seconds))
  );
}

function timeoutSecondsFromSettings(raw, fallback = DEFAULT_SESSION_TIMEOUT_SECONDS) {
  if (!raw || typeof raw !== "object") return normalizeSessionTimeoutSeconds(raw, fallback);
  const minuteValue = raw.timeoutMinutes == null ? null : Number(raw.timeoutMinutes) * 60;
  return normalizeSessionTimeoutSeconds(raw.timeoutSeconds ?? minuteValue, fallback);
}

export async function getSessionTimeoutSettings() {
  try {
    const raw = await fs.readFile(SESSION_SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      timeoutSeconds: timeoutSecondsFromSettings(parsed),
      defaultTimeoutSeconds: DEFAULT_SESSION_TIMEOUT_SECONDS,
      minTimeoutSeconds: MIN_SESSION_TIMEOUT_SECONDS,
      maxTimeoutSeconds: MAX_SESSION_TIMEOUT_SECONDS,
    };
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("Invalid sessionSettings.json; using defaults.", err.message);
    }
    return {
      timeoutSeconds: DEFAULT_SESSION_TIMEOUT_SECONDS,
      defaultTimeoutSeconds: DEFAULT_SESSION_TIMEOUT_SECONDS,
      minTimeoutSeconds: MIN_SESSION_TIMEOUT_SECONDS,
      maxTimeoutSeconds: MAX_SESSION_TIMEOUT_SECONDS,
    };
  }
}

export async function updateSessionTimeoutSettings(raw = {}) {
  const current = await getSessionTimeoutSettings();
  const timeoutSeconds = timeoutSecondsFromSettings(raw, current.timeoutSeconds);
  const settings = {
    timeoutSeconds,
    updatedAt: new Date().toISOString(),
  };
  await ensureDataDir();
  const tempPath = `${SESSION_SETTINGS_FILE}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, SESSION_SETTINGS_FILE);
  return {
    timeoutSeconds,
    defaultTimeoutSeconds: DEFAULT_SESSION_TIMEOUT_SECONDS,
    minTimeoutSeconds: MIN_SESSION_TIMEOUT_SECONDS,
    maxTimeoutSeconds: MAX_SESSION_TIMEOUT_SECONDS,
  };
}
