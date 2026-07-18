// Nodevision/ApplicationSystem/routes/api/metaWorldMultiplayerRoutes.js
// Ephemeral MetaWorld multiplayer presence sessions for local/LAN collaboration.

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServerContext } from '../../shared/serverContext.mjs';
import { validateAndNormalizePath } from '../../server/pathUtils.mjs';
import { getLanCooperationAccess } from './lanCooperationRoutes.js';

const BASE_CONTEXT = createServerContext();
const ACTIVE_MS = 12 * 1000;
const RETAIN_MS = 60 * 1000;
const MAX_PLAYERS_PER_WORLD = 48;

const sessions = new Map();

function nowIso() {
  return new Date().toISOString();
}

function clampFiniteNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function sanitizeToken(value, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 128) || fallback;
}

function requestAddress(req) {
  return String(req?.ip || req?.socket?.remoteAddress || req?.connection?.remoteAddress || '')
    .replace(/^::ffff:/, '')
    .trim();
}

function requestUserAgent(req) {
  return String(req?.headers?.['user-agent'] || '').slice(0, 220);
}

function fingerprintForRequest(req) {
  const hash = crypto.createHash('sha256');
  hash.update(requestAddress(req));
  hash.update('|');
  hash.update(requestUserAgent(req));
  return hash.digest('hex').slice(0, 24);
}

function deviceIdForRequest(req, body = null, query = null) {
  const fromHeader = req?.headers?.['x-nodevision-lan-device-id'];
  const direct = Array.isArray(fromHeader) ? fromHeader[0] : (fromHeader || body?.deviceId || query?.deviceId);
  return sanitizeToken(direct, `fingerprint-${fingerprintForRequest(req)}`);
}

function playerIdForRequest(req, body = null, query = null) {
  const fromHeader = req?.headers?.['x-nodevision-metaworld-player-id'];
  const direct = Array.isArray(fromHeader) ? fromHeader[0] : (fromHeader || body?.playerId || query?.playerId);
  return sanitizeToken(direct, `metaworld-${deviceIdForRequest(req, body, query)}`);
}

function displayNameForRequest(req, body = null) {
  const candidate = String(body?.displayName || body?.name || req?.identity?.username || '').trim();
  if (candidate) return candidate.slice(0, 80);
  const address = requestAddress(req);
  return address ? `Player ${address}` : 'MetaWorld Player';
}

function normalizeNotebookPath(rawPath = '') {
  const text = String(rawPath || '')
    .replace(/\0/g, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\//, '')
    .replace(/^Notebook\//i, '');
  const markerIndex = text.indexOf('/Notebook/');
  const scopedText = markerIndex !== -1 ? text.slice(markerIndex + '/Notebook/'.length) : text;
  const normalized = path.posix.normalize(scopedText);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized === '..') return '';
  return normalized;
}

async function resolveWorldKey(ctx, rawPath) {
  const worldPath = normalizeNotebookPath(rawPath);
  if (!worldPath) {
    const err = new Error('World path is required');
    err.status = 400;
    throw err;
  }
  const fullPath = validateAndNormalizePath(worldPath, ctx.notebookDir);
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      const err = new Error('World path must reference a file');
      err.status = 400;
      throw err;
    }
  } catch (err) {
    if (err?.status) throw err;
    if (err?.code === 'ENOENT') {
      const missing = new Error('World file not found');
      missing.status = 404;
      throw missing;
    }
    throw err;
  }
  return worldPath;
}

function normalizePosition(position = {}) {
  const source = Array.isArray(position)
    ? { x: position[0], y: position[1], z: position[2] }
    : (position && typeof position === 'object' ? position : {});
  return {
    x: clampFiniteNumber(source.x, -1000000, 1000000, 0),
    y: clampFiniteNumber(source.y, -1000000, 1000000, 1.75),
    z: clampFiniteNumber(source.z, -1000000, 1000000, 0),
  };
}

function normalizeRotation(rotation = {}) {
  const source = rotation && typeof rotation === 'object' ? rotation : {};
  return {
    yaw: clampFiniteNumber(source.yaw ?? source.y, -Math.PI * 8, Math.PI * 8, 0),
    pitch: clampFiniteNumber(source.pitch ?? source.x, -Math.PI * 2, Math.PI * 2, 0),
    roll: clampFiniteNumber(source.roll ?? source.z, -Math.PI * 2, Math.PI * 2, 0),
  };
}

function normalizePose(rawPose = {}) {
  const source = rawPose && typeof rawPose === 'object' ? rawPose : {};
  return {
    position: normalizePosition(source.position),
    rotation: normalizeRotation(source.rotation),
    mode: String(source.mode || '').slice(0, 32),
    cameraMode: String(source.cameraMode || '').slice(0, 32),
    playerHeight: clampFiniteNumber(source.playerHeight, 0.5, 3, 1.75),
  };
}

function colorForPlayer(playerId = '') {
  let hash = 0;
  for (let i = 0; i < playerId.length; i += 1) {
    hash = ((hash << 5) - hash + playerId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 72%, 58%)`;
}

function getSession(worldPath) {
  let session = sessions.get(worldPath);
  if (!session) {
    session = {
      worldPath,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      players: new Map(),
    };
    sessions.set(worldPath, session);
  }
  return session;
}

function publicPlayer(player) {
  return {
    playerId: player.playerId,
    deviceId: player.deviceId,
    displayName: player.displayName,
    color: player.color,
    pose: player.pose,
    joinedAt: player.joinedAt,
    lastSeen: player.lastSeen,
    active: Date.now() - Date.parse(player.lastSeen || 0) <= ACTIVE_MS,
  };
}

function pruneSession(session, retainMs = RETAIN_MS) {
  const cutoff = Date.now() - retainMs;
  for (const [playerId, player] of session.players.entries()) {
    if (Date.parse(player.lastSeen || 0) < cutoff) {
      session.players.delete(playerId);
    }
  }
}

function pruneAllSessions() {
  for (const [worldPath, session] of sessions.entries()) {
    pruneSession(session);
    if (session.players.size === 0 && Date.parse(session.updatedAt || 0) < Date.now() - RETAIN_MS) {
      sessions.delete(worldPath);
    }
  }
}

function activePlayers(session, excludePlayerId = '') {
  pruneSession(session, ACTIVE_MS);
  return Array.from(session.players.values())
    .filter((player) => player.playerId !== excludePlayerId)
    .map(publicPlayer);
}

function upsertPlayer(session, req, body = {}) {
  pruneSession(session);
  const playerId = playerIdForRequest(req, body, req?.query || {});
  const deviceId = deviceIdForRequest(req, body, req?.query || {});
  const existing = session.players.get(playerId) || {};
  const currentTime = nowIso();
  const player = {
    playerId,
    deviceId,
    displayName: displayNameForRequest(req, body),
    color: existing.color || colorForPlayer(playerId),
    pose: normalizePose(body.pose || existing.pose || {}),
    ip: requestAddress(req),
    userAgent: requestUserAgent(req),
    joinedAt: existing.joinedAt || currentTime,
    lastSeen: currentTime,
  };
  if (session.players.size >= MAX_PLAYERS_PER_WORLD && !session.players.has(playerId)) {
    const oldest = Array.from(session.players.values())
      .sort((a, b) => Date.parse(a.lastSeen || 0) - Date.parse(b.lastSeen || 0))[0];
    if (oldest) session.players.delete(oldest.playerId);
  }
  session.players.set(playerId, player);
  session.updatedAt = currentTime;
  return player;
}

async function ensureLanAccess(req, res, ctx) {
  const access = await getLanCooperationAccess(req, ctx, 'view', { touch: false });
  if (access.ok) return true;
  res.status(access.status || 403).json({
    ok: false,
    error: access.error || 'LAN view permission required for MetaWorld multiplayer',
  });
  return false;
}

function sendError(res, err, fallback = 'MetaWorld multiplayer request failed') {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  return res.status(status).json({ ok: false, error: err?.message || fallback });
}

export default function createMetaWorldMultiplayerRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();

  router.get('/meta-world/multiplayer/status', async (req, res) => {
    try {
      if (!(await ensureLanAccess(req, res, ctx))) return;
      const worldPath = await resolveWorldKey(ctx, req.query?.worldPath);
      const session = getSession(worldPath);
      res.json({
        ok: true,
        worldPath,
        serverTime: Date.now(),
        activeMs: ACTIVE_MS,
        players: activePlayers(session, playerIdForRequest(req, null, req.query || {})),
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/meta-world/multiplayer/join', async (req, res) => {
    try {
      if (!(await ensureLanAccess(req, res, ctx))) return;
      const worldPath = await resolveWorldKey(ctx, req.body?.worldPath);
      const session = getSession(worldPath);
      const player = upsertPlayer(session, req, req.body || {});
      res.json({
        ok: true,
        worldPath,
        player: publicPlayer(player),
        serverTime: Date.now(),
        activeMs: ACTIVE_MS,
        players: activePlayers(session, player.playerId),
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/meta-world/multiplayer/heartbeat', async (req, res) => {
    try {
      if (!(await ensureLanAccess(req, res, ctx))) return;
      const worldPath = await resolveWorldKey(ctx, req.body?.worldPath);
      const session = getSession(worldPath);
      const player = upsertPlayer(session, req, req.body || {});
      const includeSnapshot = req.body?.includeSnapshot === true;
      res.json({
        ok: true,
        worldPath,
        player: publicPlayer(player),
        serverTime: Date.now(),
        activeMs: ACTIVE_MS,
        players: includeSnapshot ? activePlayers(session, player.playerId) : undefined,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/meta-world/multiplayer/snapshot', async (req, res) => {
    try {
      if (!(await ensureLanAccess(req, res, ctx))) return;
      const worldPath = await resolveWorldKey(ctx, req.query?.worldPath);
      const session = getSession(worldPath);
      res.json({
        ok: true,
        worldPath,
        serverTime: Date.now(),
        activeMs: ACTIVE_MS,
        players: activePlayers(session, playerIdForRequest(req, null, req.query || {})),
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/meta-world/multiplayer/leave', async (req, res) => {
    try {
      if (!(await ensureLanAccess(req, res, ctx))) return;
      const worldPath = await resolveWorldKey(ctx, req.body?.worldPath);
      const session = getSession(worldPath);
      session.players.delete(playerIdForRequest(req, req.body || {}, req.query || {}));
      session.updatedAt = nowIso();
      pruneAllSessions();
      res.json({ ok: true, worldPath, players: activePlayers(session) });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

export const __metaWorldMultiplayerInternals = {
  normalizeNotebookPath,
  normalizePose,
  playerIdForRequest,
  deviceIdForRequest,
  activePlayers,
};
