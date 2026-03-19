// Nodevision/ApplicationSystem/core/runtime.js
// This file defines the runtime module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
import http from 'node:http';
import createApp from '../server.mjs';
import {
  createServerContext,
  ensureServerDirectories,
} from '../shared/serverContext.mjs';
import { createPhpServerSupervisor } from '../server/phpServerSupervisor.mjs';

function detectRuntimeType(config) {
  if (config.runtimeType) return config.runtimeType;
  if (process.env.NODEVISION_RUNTIME) return process.env.NODEVISION_RUNTIME;
  if (process.versions?.electron) return 'electron';
  if (config.dev) return 'development';
  return process.env.NODE_ENV || 'production';
}

export function createRuntime(options = {}) {
  const envFlag = (name) => {
    if (!(name in process.env)) return null;
    const raw = String(process.env[name] || '').trim().toLowerCase();
    if (raw === '') return null;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;
    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    return null;
  };

  const defaults = {
    port: 3000,
    host: '127.0.0.1',
    dev: false,
    portFallback: true,
    portFallbackMaxAttempts: 25,
    phpEnabled: true,
    phpHost: '127.0.0.1',
    phpPort: 8080,
    phpPortFallbackMaxAttempts: 25,
  };
  const normalizedConfig = {
    ...defaults,
    ...options,
    port: Number(options.port ?? defaults.port),
    host: options.host || defaults.host,
    dev: options?.dev ?? defaults.dev,
    portFallback: options?.portFallback ?? defaults.portFallback,
    portFallbackMaxAttempts: Number(options?.portFallbackMaxAttempts ?? defaults.portFallbackMaxAttempts),
    phpEnabled: options?.phpEnabled ?? envFlag('NODEVISION_PHP_ENABLED') ?? defaults.phpEnabled,
    phpHost: options?.phpHost ?? process.env.NODEVISION_PHP_HOST ?? defaults.phpHost,
    phpPort: Number(options?.phpPort ?? process.env.NODEVISION_PHP_PORT ?? defaults.phpPort),
    phpPortFallbackMaxAttempts: Number(
      options?.phpPortFallbackMaxAttempts ??
        process.env.NODEVISION_PHP_PORT_FALLBACK_MAX_ATTEMPTS ??
        defaults.phpPortFallbackMaxAttempts,
    ),
  };
  normalizedConfig.port = Number.isFinite(normalizedConfig.port)
    ? Math.max(1, Math.floor(normalizedConfig.port))
    : defaults.port;
  normalizedConfig.dev = Boolean(normalizedConfig.dev);
  normalizedConfig.portFallback = Boolean(normalizedConfig.portFallback);
  normalizedConfig.portFallbackMaxAttempts = Number.isFinite(normalizedConfig.portFallbackMaxAttempts)
    ? Math.max(1, Math.floor(normalizedConfig.portFallbackMaxAttempts))
    : defaults.portFallbackMaxAttempts;
  normalizedConfig.phpEnabled = Boolean(normalizedConfig.phpEnabled);
  normalizedConfig.phpPort = Number.isFinite(normalizedConfig.phpPort)
    ? Math.max(1, Math.floor(normalizedConfig.phpPort))
    : defaults.phpPort;
  normalizedConfig.phpPortFallbackMaxAttempts = Number.isFinite(normalizedConfig.phpPortFallbackMaxAttempts)
    ? Math.max(1, Math.floor(normalizedConfig.phpPortFallbackMaxAttempts))
    : defaults.phpPortFallbackMaxAttempts;
  const runtimeType = detectRuntimeType(normalizedConfig);
  const runtimeMeta = {
    type: runtimeType,
    dev: normalizedConfig.dev,
    createdAt: new Date().toISOString(),
  };
  const config = { ...normalizedConfig, runtimeType };

  const ctx = createServerContext({ runtimeRoot: process.env.NODEVISION_ROOT });
  ensureServerDirectories(ctx);

  let server = null;
  let runtimeInstance = null;
  const phpSupervisor = createPhpServerSupervisor(ctx, {
    enabled: config.phpEnabled,
    host: config.phpHost,
    port: config.phpPort,
    portFallbackMaxAttempts: config.phpPortFallbackMaxAttempts,
  });

  async function listenWithFallback(app) {
    const preferred = config.port;
    const attempts = config.portFallback ? config.portFallbackMaxAttempts : 1;
    let lastErr = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidatePort = preferred + attempt;
      const candidateServer = http.createServer(app);
      try {
        await new Promise((resolve, reject) => {
          candidateServer.once('error', reject);
          candidateServer.listen(candidatePort, config.host, () => resolve());
        });
        if (candidatePort !== preferred) {
          console.warn(`Nodevision port ${preferred} is in use; using ${candidatePort} instead.`);
        }
        return { server: candidateServer, port: candidatePort };
      } catch (err) {
        lastErr = err;
        try {
          candidateServer.close(() => {});
        } catch {}
        if (err?.code === 'EADDRINUSE' && attempt < attempts - 1) continue;
        throw err;
      }
    }

    throw lastErr || new Error('Failed to start Nodevision server.');
  }

  async function start() {
    if (runtimeInstance) {
      return runtimeInstance;
    }

    try {
      const phpResult = await phpSupervisor.start();
      if (phpResult?.ok && phpResult?.url) {
        config.phpProxyTarget = phpResult.url;
      }
    } catch (err) {
      console.warn('Failed to start PHP server:', err?.message || err);
    }

    const app = await createApp(config);

    const listening = await listenWithFallback(app);
    server = listening.server;
    config.actualPort = listening.port;

    const baseUrl = `http://${config.host}:${listening.port}`;
    console.log(`Nodevision ${runtimeMeta.type} runtime listening on ${baseUrl}`);
    runtimeInstance = {
      server,
      url: baseUrl,
      port: listening.port,
      php: phpSupervisor.status(),
      stop,
    };
    return runtimeInstance;
  }

  async function stop() {
    if (!server) return;
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    server = null;
    runtimeInstance = null;
    try {
      await phpSupervisor.stop();
    } catch {}
  }

  return {
    runtime: runtimeMeta,
    config,
    start,
    stop,
  };
}
