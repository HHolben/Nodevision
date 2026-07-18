// Nodevision/ApplicationSystem/routes/api/lanCooperationRoutes.js
// Owner-controlled LAN cooperation state, device approvals, permissions, and chat.

import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();
const SETTINGS_FILENAME = 'LANCooperation.json';
const MAX_CHAT_MESSAGES = 300;
const ACTIVE_MS = 70 * 1000;
const DEFAULT_PERMISSIONS = Object.freeze({
  view: true,
  edit: false,
  chat: true,
});

const memory = {
  key: '',
  loaded: false,
  loading: null,
  state: null,
};

function defaultState() {
  return {
    enabled: false,
    allowRequests: true,
    defaultPermissions: { ...DEFAULT_PERMISSIONS },
    visitors: {},
    chatMessages: [],
    nextChatId: 1,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function normalizePermissions(input = {}, fallback = DEFAULT_PERMISSIONS) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    view: normalizeBoolean(source.view, fallback.view !== false),
    edit: normalizeBoolean(source.edit, fallback.edit === true),
    chat: normalizeBoolean(source.chat, fallback.chat !== false),
  };
}

function settingsPath(ctx = BASE_CONTEXT) {
  return path.join(ctx.userSettingsDir, SETTINGS_FILENAME);
}

function sanitizeToken(value, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 96) || fallback;
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
  const fromBody = body?.deviceId;
  const fromQuery = query?.deviceId;
  const direct = sanitizeToken(Array.isArray(fromHeader) ? fromHeader[0] : (fromHeader || fromBody || fromQuery));
  return direct || `fingerprint-${fingerprintForRequest(req)}`;
}

function displayNameForRequest(req, body = null) {
  const candidate = String(body?.displayName || body?.name || req?.identity?.username || '').trim();
  if (candidate) return candidate.slice(0, 80);
  const address = requestAddress(req);
  return address ? `Visitor ${address}` : 'LAN Visitor';
}

function isLocalhostRequest(req) {
  const candidates = [
    requestAddress(req),
    String(req?.socket?.remoteAddress || '').replace(/^::ffff:/, ''),
    String(req?.connection?.remoteAddress || '').replace(/^::ffff:/, ''),
  ].filter(Boolean);
  return candidates.some((item) => item === '127.0.0.1' || item === '::1' || item === 'localhost');
}

function isOwnerRequest(req) {
  return req?.identity?.role === 'admin' || isLocalhostRequest(req);
}

function isEnabledForLan(state) {
  return state?.enabled === true;
}

function normalizeVisitor(deviceId, visitor = {}, req = null, body = null) {
  const now = new Date().toISOString();
  const permissions = normalizePermissions(visitor.permissions, DEFAULT_PERMISSIONS);
  const status = visitor.banned === true
    ? 'banned'
    : ['pending', 'connected', 'rejected'].includes(visitor.status)
      ? visitor.status
      : 'pending';
  return {
    deviceId,
    displayName: String(visitor.displayName || displayNameForRequest(req, body)).slice(0, 80),
    ip: String(visitor.ip || requestAddress(req) || '').slice(0, 80),
    userAgent: String(visitor.userAgent || requestUserAgent(req) || '').slice(0, 220),
    fingerprint: String(visitor.fingerprint || (req ? fingerprintForRequest(req) : '')).slice(0, 80),
    status,
    permissions,
    whitelisted: visitor.whitelisted === true,
    banned: visitor.banned === true || status === 'banned',
    requestedAt: visitor.requestedAt || now,
    firstSeen: visitor.firstSeen || now,
    lastSeen: visitor.lastSeen || now,
    updatedAt: visitor.updatedAt || now,
  };
}

function normalizeState(raw = {}) {
  const state = defaultState();
  if (raw && typeof raw === 'object') {
    state.enabled = raw.enabled === true;
    state.allowRequests = raw.allowRequests !== false;
    state.defaultPermissions = normalizePermissions(raw.defaultPermissions, DEFAULT_PERMISSIONS);
    state.nextChatId = Number.isInteger(raw.nextChatId) && raw.nextChatId > 0 ? raw.nextChatId : 1;
    state.updatedAt = raw.updatedAt || state.updatedAt;

    const visitors = raw.visitors && typeof raw.visitors === 'object' ? raw.visitors : {};
    for (const [key, value] of Object.entries(visitors)) {
      const deviceId = sanitizeToken(value?.deviceId || key);
      if (!deviceId) continue;
      state.visitors[deviceId] = normalizeVisitor(deviceId, value);
    }

    if (Array.isArray(raw.chatMessages)) {
      state.chatMessages = raw.chatMessages
        .map((message) => ({
          id: Number(message?.id) || 0,
          deviceId: sanitizeToken(message?.deviceId || ''),
          displayName: String(message?.displayName || 'User').slice(0, 80),
          text: String(message?.text || '').slice(0, 1600),
          createdAt: message?.createdAt || new Date().toISOString(),
        }))
        .filter((message) => message.id > 0 && message.text)
        .slice(-MAX_CHAT_MESSAGES);
      const maxId = state.chatMessages.reduce((max, message) => Math.max(max, message.id), 0);
      state.nextChatId = Math.max(state.nextChatId, maxId + 1);
    }
  }
  return state;
}

async function loadState(ctx = BASE_CONTEXT) {
  const key = settingsPath(ctx);
  if (memory.loaded && memory.key === key && memory.state) return memory.state;
  if (memory.loading && memory.key === key) return memory.loading;

  memory.key = key;
  memory.loading = (async () => {
    try {
      const raw = await fs.readFile(key, 'utf8');
      memory.state = normalizeState(JSON.parse(raw));
    } catch (err) {
      if (err?.code !== 'ENOENT') console.warn('[lan-cooperation] Failed to load settings:', err);
      memory.state = defaultState();
    }
    memory.loaded = true;
    memory.loading = null;
    return memory.state;
  })();
  return memory.loading;
}

async function saveState(ctx = BASE_CONTEXT, state = null) {
  const activeState = state || await loadState(ctx);
  activeState.updatedAt = new Date().toISOString();
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  await fs.writeFile(settingsPath(ctx), JSON.stringify(activeState, null, 2), 'utf8');
  return activeState;
}

function touchVisitor(state, req, body = null) {
  const deviceId = deviceIdForRequest(req, body, req?.query);
  const existing = state.visitors[deviceId] || {};
  const next = normalizeVisitor(deviceId, existing, req, body);
  next.lastSeen = new Date().toISOString();
  next.ip = requestAddress(req) || next.ip;
  next.userAgent = requestUserAgent(req) || next.userAgent;
  next.fingerprint = fingerprintForRequest(req) || next.fingerprint;
  if (body?.displayName || body?.name) next.displayName = displayNameForRequest(req, body);
  state.visitors[deviceId] = next;
  return next;
}

function findVisitorForRequest(state, req) {
  const deviceId = deviceIdForRequest(req, req?.body, req?.query);
  if (state.visitors[deviceId]) return state.visitors[deviceId];
  const fingerprint = fingerprintForRequest(req);
  return Object.values(state.visitors).find((visitor) => visitor.fingerprint === fingerprint) || null;
}

function publicVisitor(visitor) {
  return {
    deviceId: visitor.deviceId,
    displayName: visitor.displayName,
    ip: visitor.ip,
    userAgent: visitor.userAgent,
    status: visitor.status,
    permissions: normalizePermissions(visitor.permissions),
    whitelisted: visitor.whitelisted === true,
    banned: visitor.banned === true,
    requestedAt: visitor.requestedAt,
    firstSeen: visitor.firstSeen,
    lastSeen: visitor.lastSeen,
    updatedAt: visitor.updatedAt,
    active: Date.now() - Date.parse(visitor.lastSeen || 0) <= ACTIVE_MS,
  };
}

function ownerVisitorForRequest(req) {
  const now = new Date().toISOString();
  return {
    deviceId: deviceIdForRequest(req, req?.body, req?.query),
    displayName: req?.identity?.username || 'Server Owner',
    ip: requestAddress(req),
    userAgent: requestUserAgent(req),
    status: 'connected',
    permissions: { view: true, edit: true, chat: true },
    whitelisted: true,
    banned: false,
    requestedAt: now,
    firstSeen: now,
    lastSeen: now,
    updatedAt: now,
    active: true,
  };
}

function transientVisitorForRequest(req, status = 'new') {
  const now = new Date().toISOString();
  return {
    deviceId: deviceIdForRequest(req, req?.body, req?.query),
    displayName: req?.identity?.username || displayNameForRequest(req),
    ip: requestAddress(req),
    userAgent: requestUserAgent(req),
    status,
    permissions: { view: false, edit: false, chat: false },
    whitelisted: false,
    banned: false,
    requestedAt: null,
    firstSeen: now,
    lastSeen: now,
    updatedAt: now,
    active: true,
  };
}

function currentVisitorForStatus(state, req) {
  const visitor = findVisitorForRequest(state, req);
  if (!visitor) return { visitor: transientVisitorForRequest(req), changed: false };
  visitor.lastSeen = new Date().toISOString();
  visitor.ip = requestAddress(req) || visitor.ip;
  visitor.userAgent = requestUserAgent(req) || visitor.userAgent;
  visitor.fingerprint = fingerprintForRequest(req) || visitor.fingerprint;
  return { visitor, changed: true };
}

function portFromContext(ctx = BASE_CONTEXT) {
  const value = Number(ctx?.actualPort || ctx?.port || process.env.PORT || 3000);
  return Number.isInteger(value) && value > 0 ? value : 3000;
}

function hostFromContext(ctx = BASE_CONTEXT) {
  return String(ctx?.host || ctx?.hostname || ctx?.listenHost || process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
}

function networkUrls(ctx = BASE_CONTEXT, req = null) {
  const host = hostFromContext(ctx);
  const port = portFromContext(ctx);
  const protocol = String(req?.protocol || 'http').replace(/:$/, '');
  const urls = [];
  const add = (label, address, kind = 'lan') => {
    const clean = String(address || '').trim();
    if (!clean) return;
    const wrapped = clean.includes(':') && !clean.startsWith('[') ? `[${clean}]` : clean;
    const url = `${protocol}://${wrapped}:${port}/`;
    if (!urls.some((entry) => entry.url === url)) urls.push({ label, address: clean, url, kind });
  };

  if (host === '0.0.0.0' || host === '::') {
    for (const [name, entries] of Object.entries(os.networkInterfaces() || {})) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || entry.internal === true) continue;
        if (entry.family === 'IPv4') add(name, entry.address, 'lan');
      }
    }
  } else {
    add('Configured host', host, isLocalHostText(host) ? 'loopback' : 'lan');
  }

  add('This device', 'localhost', 'loopback');
  return urls;
}

function isLocalHostText(value) {
  const host = String(value || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function settingsSummary(state, ctx, req) {
  const host = hostFromContext(ctx);
  const loopbackOnly = isLocalHostText(host);
  return {
    enabled: state.enabled === true,
    allowRequests: state.allowRequests !== false,
    defaultPermissions: normalizePermissions(state.defaultPermissions),
    listening: {
      host,
      port: portFromContext(ctx),
      listensOnAllInterfaces: host === '0.0.0.0' || host === '::',
      loopbackOnly,
    },
    urls: networkUrls(ctx, req),
    warning: loopbackOnly
      ? 'Nodevision is currently bound to loopback. Enable a 0.0.0.0 host in the launcher or server config before LAN devices can reach it.'
      : '',
  };
}

function activeUsers(state) {
  return Object.values(state.visitors)
    .filter((visitor) => visitor.status === 'connected' && visitor.banned !== true)
    .filter((visitor) => Date.now() - Date.parse(visitor.lastSeen || 0) <= ACTIVE_MS)
    .map(publicVisitor);
}

function ensureOwner(req, res) {
  if (isOwnerRequest(req)) return true;
  res.status(403).json({ ok: false, error: 'Server owner permissions required' });
  return false;
}

function visitorCan(visitor, permission) {
  if (!visitor || visitor.banned === true || visitor.status !== 'connected') return false;
  return visitor.permissions?.[permission] === true;
}

export async function getLanCooperationAccess(req, ctx = BASE_CONTEXT, permission = 'view', options = {}) {
  const state = await loadState(ctx);
  if (!isEnabledForLan(state)) return { ok: true, state, reason: 'LAN cooperation disabled' };
  if (isOwnerRequest(req)) return { ok: true, state, reason: 'server owner' };
  const visitor = findVisitorForRequest(state, req);
  if (!visitor) return { ok: false, state, visitor: null, status: 403, error: 'This device has not been approved for LAN cooperation' };
  if (visitor.banned === true) return { ok: false, state, visitor, status: 403, error: 'This device is banned from LAN cooperation' };
  if (!visitorCan(visitor, permission)) return { ok: false, state, visitor, status: 403, error: `LAN ${permission} permission required` };
  if (options.touch !== false) {
    visitor.lastSeen = new Date().toISOString();
    saveState(ctx, state).catch((err) => console.warn('[lan-cooperation] Failed to update visitor heartbeat:', err));
  }
  return { ok: true, state, visitor, reason: 'approved visitor' };
}

export function requireLanViewPermission(ctx = BASE_CONTEXT) {
  return async (req, res, next) => {
    try {
      const access = await getLanCooperationAccess(req, ctx, 'view');
      if (access.ok) return next();
      return res.status(access.status || 403).json({ ok: false, error: access.error || 'LAN view permission required' });
    } catch (err) {
      console.error('[lan-cooperation] View permission check failed:', err);
      return res.status(500).json({ ok: false, error: 'LAN cooperation permission check failed' });
    }
  };
}

export async function rejectIfLanWriteDenied(req, res, ctx = BASE_CONTEXT) {
  try {
    const access = await getLanCooperationAccess(req, ctx, 'edit');
    if (access.ok) return false;
    res.status(access.status || 403).json({ ok: false, error: access.error || 'LAN edit permission required' });
    return true;
  } catch (err) {
    console.error('[lan-cooperation] Write permission check failed:', err);
    res.status(500).json({ ok: false, error: 'LAN cooperation permission check failed' });
    return true;
  }
}

export default function createLanCooperationRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();

  router.get('/lan-cooperation/status', async (req, res) => {
    try {
      const state = await loadState(ctx);
      const owner = isOwnerRequest(req);
      const current = owner ? { visitor: ownerVisitorForRequest(req), changed: false } : currentVisitorForStatus(state, req);
      const visitor = current.visitor;
      if (!owner && current.changed) await saveState(ctx, state);
      res.json({
        ok: true,
        owner,
        session: req.identity ? {
          id: req.identity.id,
          username: req.identity.username,
          role: req.identity.role,
          type: req.identity.type,
        } : null,
        currentVisitor: publicVisitor(visitor),
        settings: settingsSummary(state, ctx, req),
        activeUsers: activeUsers(state),
        visitors: owner ? Object.values(state.visitors).map(publicVisitor) : [],
      });
    } catch (err) {
      console.error('[lan-cooperation] Status failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to load LAN cooperation status' });
    }
  });

  router.post('/lan-cooperation/settings', async (req, res) => {
    if (!ensureOwner(req, res)) return;
    try {
      const state = await loadState(ctx);
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'enabled')) {
        state.enabled = req.body.enabled === true;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'allowRequests')) {
        state.allowRequests = req.body.allowRequests !== false;
      }
      if (req.body?.defaultPermissions) {
        state.defaultPermissions = normalizePermissions(req.body.defaultPermissions, state.defaultPermissions);
      }
      await saveState(ctx, state);
      res.json({ ok: true, settings: settingsSummary(state, ctx, req), visitors: Object.values(state.visitors).map(publicVisitor) });
    } catch (err) {
      console.error('[lan-cooperation] Save settings failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to save LAN cooperation settings' });
    }
  });

  router.post('/lan-cooperation/request-access', async (req, res) => {
    try {
      const state = await loadState(ctx);
      if (state.allowRequests === false && !isOwnerRequest(req)) {
        return res.status(403).json({ ok: false, error: 'LAN access requests are turned off' });
      }
      const visitor = touchVisitor(state, req, req.body || {});
      if (visitor.banned === true) {
        await saveState(ctx, state);
        return res.status(403).json({ ok: false, error: 'This device is banned from LAN cooperation', visitor: publicVisitor(visitor) });
      }
      if (visitor.whitelisted === true || isOwnerRequest(req)) {
        visitor.status = 'connected';
        visitor.permissions = normalizePermissions(visitor.permissions, state.defaultPermissions);
      } else if (visitor.status !== 'connected') {
        visitor.status = 'pending';
        visitor.permissions = normalizePermissions(req.body?.requestedPermissions, state.defaultPermissions);
        visitor.requestedAt = new Date().toISOString();
      }
      visitor.updatedAt = new Date().toISOString();
      await saveState(ctx, state);
      res.json({ ok: true, visitor: publicVisitor(visitor), settings: settingsSummary(state, ctx, req) });
    } catch (err) {
      console.error('[lan-cooperation] Request access failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to request LAN cooperation access' });
    }
  });

  router.post('/lan-cooperation/visitors/:deviceId/decision', async (req, res) => {
    if (!ensureOwner(req, res)) return;
    try {
      const state = await loadState(ctx);
      const deviceId = sanitizeToken(req.params.deviceId);
      const visitor = state.visitors[deviceId];
      if (!visitor) return res.status(404).json({ ok: false, error: 'Visitor not found' });
      const action = String(req.body?.action || '').toLowerCase();
      if (action !== 'approve' && action !== 'reject') {
        return res.status(400).json({ ok: false, error: 'Action must be approve or reject' });
      }
      visitor.status = action === 'approve' ? 'connected' : 'rejected';
      visitor.permissions = normalizePermissions(req.body?.permissions || visitor.permissions, state.defaultPermissions);
      visitor.banned = false;
      visitor.updatedAt = new Date().toISOString();
      await saveState(ctx, state);
      res.json({ ok: true, visitor: publicVisitor(visitor), visitors: Object.values(state.visitors).map(publicVisitor) });
    } catch (err) {
      console.error('[lan-cooperation] Visitor decision failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to update visitor decision' });
    }
  });

  router.patch('/lan-cooperation/visitors/:deviceId/permissions', async (req, res) => {
    if (!ensureOwner(req, res)) return;
    try {
      const state = await loadState(ctx);
      const deviceId = sanitizeToken(req.params.deviceId);
      const visitor = state.visitors[deviceId];
      if (!visitor) return res.status(404).json({ ok: false, error: 'Visitor not found' });
      visitor.permissions = normalizePermissions(req.body?.permissions, visitor.permissions);
      visitor.updatedAt = new Date().toISOString();
      await saveState(ctx, state);
      res.json({ ok: true, visitor: publicVisitor(visitor), visitors: Object.values(state.visitors).map(publicVisitor) });
    } catch (err) {
      console.error('[lan-cooperation] Permission update failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to update visitor permissions' });
    }
  });

  router.post('/lan-cooperation/visitors/:deviceId/whitelist', async (req, res) => {
    if (!ensureOwner(req, res)) return;
    try {
      const state = await loadState(ctx);
      const deviceId = sanitizeToken(req.params.deviceId);
      const visitor = state.visitors[deviceId];
      if (!visitor) return res.status(404).json({ ok: false, error: 'Visitor not found' });
      visitor.whitelisted = req.body?.whitelisted !== false;
      if (visitor.whitelisted && visitor.banned) visitor.banned = false;
      if (visitor.whitelisted && visitor.status !== 'connected') visitor.status = 'connected';
      visitor.updatedAt = new Date().toISOString();
      await saveState(ctx, state);
      res.json({ ok: true, visitor: publicVisitor(visitor), visitors: Object.values(state.visitors).map(publicVisitor) });
    } catch (err) {
      console.error('[lan-cooperation] Whitelist update failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to update whitelist' });
    }
  });

  router.post('/lan-cooperation/visitors/:deviceId/ban', async (req, res) => {
    if (!ensureOwner(req, res)) return;
    try {
      const state = await loadState(ctx);
      const deviceId = sanitizeToken(req.params.deviceId);
      const visitor = state.visitors[deviceId];
      if (!visitor) return res.status(404).json({ ok: false, error: 'Visitor not found' });
      visitor.banned = req.body?.banned !== false;
      visitor.status = visitor.banned ? 'banned' : 'rejected';
      if (visitor.banned) visitor.whitelisted = false;
      visitor.updatedAt = new Date().toISOString();
      await saveState(ctx, state);
      res.json({ ok: true, visitor: publicVisitor(visitor), visitors: Object.values(state.visitors).map(publicVisitor) });
    } catch (err) {
      console.error('[lan-cooperation] Ban update failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to update ban' });
    }
  });

  router.get('/lan-cooperation/chat', async (req, res) => {
    try {
      const access = await getLanCooperationAccess(req, ctx, 'chat');
      if (!access.ok) {
        return res.status(access.status || 403).json({ ok: false, error: access.error || 'LAN chat permission required' });
      }
      if (access.state?.enabled !== true && !isOwnerRequest(req)) {
        return res.status(403).json({ ok: false, error: 'LAN cooperation is off' });
      }
      const state = access.state;
      const since = Number(req.query?.since || 0);
      const messages = state.chatMessages.filter((message) => message.id > since);
      res.json({ ok: true, messages, activeUsers: activeUsers(state), nextChatId: state.nextChatId });
    } catch (err) {
      console.error('[lan-cooperation] Chat load failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to load LAN chat' });
    }
  });

  router.post('/lan-cooperation/chat', async (req, res) => {
    try {
      const access = await getLanCooperationAccess(req, ctx, 'chat');
      if (!access.ok) {
        return res.status(access.status || 403).json({ ok: false, error: access.error || 'LAN chat permission required' });
      }
      if (access.state?.enabled !== true && !isOwnerRequest(req)) {
        return res.status(403).json({ ok: false, error: 'LAN cooperation is off' });
      }
      const state = access.state;
      const visitor = access.visitor || (isOwnerRequest(req) ? ownerVisitorForRequest(req) : touchVisitor(state, req, req.body || {}));
      const text = String(req.body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 1600);
      if (!text) return res.status(400).json({ ok: false, error: 'Message text is required' });
      const message = {
        id: state.nextChatId++,
        deviceId: visitor?.deviceId || deviceIdForRequest(req, req.body || {}, req.query || {}),
        displayName: req.identity?.username || visitor?.displayName || displayNameForRequest(req, req.body || {}),
        text,
        createdAt: new Date().toISOString(),
      };
      state.chatMessages.push(message);
      state.chatMessages = state.chatMessages.slice(-MAX_CHAT_MESSAGES);
      await saveState(ctx, state);
      res.json({ ok: true, message, messages: [message], activeUsers: activeUsers(state) });
    } catch (err) {
      console.error('[lan-cooperation] Chat post failed:', err);
      res.status(500).json({ ok: false, error: 'Failed to send LAN chat message' });
    }
  });

  return router;
}
