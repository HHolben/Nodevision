// Nodevision/ApplicationSystem/Auth/sessionManager.mjs
// This file defines session Manager authentication logic for the Nodevision server. It manages user identity and secures session operations.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { logEvent } from './authLogger.mjs';
import { createServerContext } from '../shared/serverContext.mjs';

const ctx = createServerContext();
const DATA_DIR = ctx.accountsDataDir;
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
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

async function loadSessions() {
  try {
    const raw = await fs.readFile(SESSIONS_FILE, 'utf8');
    if (!raw.trim()) {
      return {};
    }
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

async function saveSessions(sessions) {
  await ensureDataDir();
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
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

export async function cleanupExpiredSessions() {
  const sessions = await loadSessions();
  const now = Math.floor(Date.now() / 1000);
  let modified = false;

  for (const [token, session] of Object.entries(sessions)) {
    if (session.expires <= now) {
      delete sessions[token];
      modified = true;
      await logEvent('SESSION_EXPIRED', {
        identityId: session.identityId,
        role: session.role,
      });
    }
  }

  if (modified) {
    await saveSessions(sessions);
  }
}

export async function createSession(identity) {
  await cleanupExpiredSessions();
  const sessions = await loadSessions();
  const now = Math.floor(Date.now() / 1000);
  const token = crypto.randomUUID();
  const timeoutSettings = await getSessionTimeoutSettings();
  const entry = {
    identityId: identity.id,
    username: identity.username,
    type: identity.type,
    role: identity.role,
    created: now,
    lastActivity: now,
    expires: now + timeoutSettings.timeoutSeconds,
  };
  sessions[token] = entry;
  await saveSessions(sessions);
  await logEvent('SESSION_CREATED', {
    identityId: identity.id,
    role: identity.role,
  });
  return {
    token,
    expires: entry.expires,
    timeoutSeconds: timeoutSettings.timeoutSeconds,
  };
}

export async function validateSession(token) {
  if (!token) {
    return null;
  }

  const sessions = await loadSessions();
  const session = sessions[token];
  if (!session) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.expires <= now) {
    delete sessions[token];
    await saveSessions(sessions);
    await logEvent('SESSION_EXPIRED', {
      identityId: session.identityId,
      role: session.role,
    });
    return null;
  }

  return session;
}

export async function touchSession(token) {
  if (!token) {
    return null;
  }

  const sessions = await loadSessions();
  const session = sessions[token];
  if (!session) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.expires <= now) {
    delete sessions[token];
    await saveSessions(sessions);
    await logEvent('SESSION_EXPIRED', {
      identityId: session.identityId,
      role: session.role,
    });
    return null;
  }

  const timeoutSettings = await getSessionTimeoutSettings();
  session.lastActivity = now;
  session.expires = now + timeoutSettings.timeoutSeconds;
  sessions[token] = session;
  await saveSessions(sessions);
  return {
    ...session,
    timeoutSeconds: timeoutSettings.timeoutSeconds,
  };
}


export async function deleteSession(token) {
  if (!token) {
    return;
  }

  const sessions = await loadSessions();
  const session = sessions[token];
  if (!session) {
    return;
  }

  delete sessions[token];
  await saveSessions(sessions);
  await logEvent('LOGOUT', {
    identityId: session.identityId,
    role: session.role,
  });
}
