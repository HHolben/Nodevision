import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import createApp from '../server.js';

const HOME_DIR = os.homedir();
const NODEVISION_ROOT = path.join(HOME_DIR, 'Nodevision');
const REQUIRED_DIRS = [
  NODEVISION_ROOT,
  path.join(NODEVISION_ROOT, 'Notebook'),
  path.join(NODEVISION_ROOT, 'Config'),
  path.join(NODEVISION_ROOT, 'Cache'),
  path.join(NODEVISION_ROOT, 'Logs'),
];

function ensureDirectories() {
  for (const dir of REQUIRED_DIRS) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function detectRuntimeType(config) {
  if (config.runtimeType) return config.runtimeType;
  if (process.env.NODEVISION_RUNTIME) return process.env.NODEVISION_RUNTIME;
  if (process.versions?.electron) return 'electron';
  if (config.dev) return 'development';
  return process.env.NODE_ENV || 'production';
}

export function createRuntime(options = {}) {
  const defaults = { port: 3000, host: '127.0.0.1', dev: false };
  const normalizedConfig = {
    ...defaults,
    ...options,
    port: Number(options.port ?? defaults.port),
    host: options.host || defaults.host,
    dev: options?.dev ?? defaults.dev,
  };
  normalizedConfig.port = Number.isFinite(normalizedConfig.port)
    ? Math.max(1, Math.floor(normalizedConfig.port))
    : defaults.port;
  normalizedConfig.dev = Boolean(normalizedConfig.dev);
  const runtimeType = detectRuntimeType(normalizedConfig);
  const runtimeMeta = {
    type: runtimeType,
    dev: normalizedConfig.dev,
    createdAt: new Date().toISOString(),
  };
  const config = { ...normalizedConfig, runtimeType };
  const baseUrl = `http://${config.host}:${config.port}`;

  ensureDirectories();

  let server = null;
  let runtimeInstance = null;

  async function start() {
    if (runtimeInstance) {
      return runtimeInstance;
    }
    const app = await createApp(config);
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, () => {
        console.log(
          `Nodevision ${runtimeMeta.type} runtime listening on http://${config.host}:${config.port}`,
        );
        resolve();
      });
    });
    runtimeInstance = {
      server,
      url: baseUrl,
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
  }

  return {
    runtime: runtimeMeta,
    config,
    start,
    stop,
  };
}
