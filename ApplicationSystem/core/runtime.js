// Nodevision/ApplicationSystem/core/runtime.js
// This file defines the runtime module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
import http from 'node:http';
import path from 'node:path';
import createApp from '../server.mjs';
import {
  createServerContext,
  ensureServerDirectories,
} from '../shared/serverContext.mjs';
import { createPhpServerSupervisor } from '../server/phpServerSupervisor.mjs';
import {
  RUNTIME_DEFAULTS,
  normalizeRuntimeHost,
  normalizeRuntimePort,
  readRuntimeConfigFile,
  resolveRuntimeNetworkConfig,
} from './runtimeNetworkConfig.mjs';
import { startMqttServerFromEnv } from '../MessageBroker/MQTT/MqttTcpServer.mjs';
import { getBroker } from '../MessageBroker/BrokerSingleton.mjs';
import { startMqttCsvLoggers } from '../MessageBroker/MQTTCsvLogger.mjs';

function detectRuntimeType(config) {
  if (config.runtimeType) return config.runtimeType;
  if (process.env.NODEVISION_RUNTIME) return process.env.NODEVISION_RUNTIME;
  if (process.versions?.electron) return 'electron';
  if (config.dev) return 'development';
  return process.env.NODE_ENV || 'production';
}

export function createRuntime(options = {}) {
  const runtimeConfig = options && typeof options === 'object' ? options : {};

  const envFlag = (name) => {
    if (!(name in process.env)) return null;
    const raw = String(process.env[name] || '').trim().toLowerCase();
    if (raw === '') return null;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;
    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    return null;
  };

  const runtimeRoot = runtimeConfig.runtimeRoot ?? process.env.NODEVISION_ROOT;
  const fileConfig = readRuntimeConfigFile(runtimeRoot);
  const resolvedNetwork = resolveRuntimeNetworkConfig({
    runtimeConfig,
    config: fileConfig.values,
  });

  const defaults = RUNTIME_DEFAULTS;
  const normalizedConfig = {
    ...defaults,
    ...runtimeConfig,
    port: resolvedNetwork.port,
    host: resolvedNetwork.host,
    dev: runtimeConfig?.dev ?? defaults.dev,
    portFallback: runtimeConfig?.portFallback ?? defaults.portFallback,
    portFallbackMaxAttempts: Number(runtimeConfig?.portFallbackMaxAttempts ?? defaults.portFallbackMaxAttempts),
    phpEnabled: runtimeConfig?.phpEnabled ?? envFlag('NODEVISION_PHP_ENABLED') ?? defaults.phpEnabled,
    phpHost: resolvedNetwork.phpHost,
    phpPort: resolvedNetwork.phpPort,
    phpPortFallbackMaxAttempts: Number(
      runtimeConfig?.phpPortFallbackMaxAttempts ??
        process.env.NODEVISION_PHP_PORT_FALLBACK_MAX_ATTEMPTS ??
        defaults.phpPortFallbackMaxAttempts,
    ),
    resolvedConfigPath: fileConfig.path,
    mqttCsvLoggersEnabled: runtimeConfig?.mqttCsvLoggersEnabled ?? envFlag('NODEVISION_MQTT_CSV_LOGGERS_ENABLED') ?? false,
  };
  normalizedConfig.port = normalizeRuntimePort(normalizedConfig.port, defaults.port);
  normalizedConfig.host = normalizeRuntimeHost(normalizedConfig.host, defaults.host);
  normalizedConfig.dev = Boolean(normalizedConfig.dev);
  normalizedConfig.portFallback = Boolean(normalizedConfig.portFallback);
  normalizedConfig.portFallbackMaxAttempts = Number.isFinite(normalizedConfig.portFallbackMaxAttempts)
    ? Math.max(1, Math.floor(normalizedConfig.portFallbackMaxAttempts))
    : defaults.portFallbackMaxAttempts;
  normalizedConfig.phpEnabled = Boolean(normalizedConfig.phpEnabled);
  normalizedConfig.phpHost = normalizeRuntimeHost(normalizedConfig.phpHost, defaults.phpHost);
  normalizedConfig.phpPort = normalizeRuntimePort(normalizedConfig.phpPort, defaults.phpPort);
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

  const ctx = createServerContext(runtimeRoot ? { runtimeRoot } : {});
  ensureServerDirectories(ctx);

  let server = null;
  let mqttServer = null;
  let mqttCsvCleanup = null;
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
          candidateServer.listen(candidatePort, config.host, () => {
            console.log(`Nodevision listening on http://${config.host}:${candidatePort}`);
            resolve();
          });
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

    console.log(`[runtime] Node host=${config.host} port=${config.port}`);
    if (config.phpEnabled) {
      console.log(`[runtime] PHP host=${config.phpHost} port=${config.phpPort}`);
    } else {
      console.log('[runtime] PHP server disabled');
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
    process.env.PORT = String(listening.port);

    try {
      mqttServer = await startMqttServerFromEnv({ runtimeRoot });
    } catch (err) {
      console.warn('Failed to start MQTT broker:', err?.message || err);
    }

    if (config.mqttCsvLoggersEnabled) {
      try {
        mqttCsvCleanup = await startMqttCsvLoggers({
          broker: getBroker(),
          notebookDir: ctx.notebookDir,
          settingsDir: path.join(ctx.runtimeRoot, 'ServerSettings'),
        });
        console.log(`MQTT CSV loggers enabled: ${Number(mqttCsvCleanup?.count || 0)}`);
      } catch (err) {
        console.warn('Failed to start MQTT CSV loggers:', err?.message || err);
      }
    }

    const baseUrl = `http://${config.host}:${listening.port}`;
    console.log(`Nodevision ${runtimeMeta.type} runtime ready at ${baseUrl}`);
    runtimeInstance = {
      server,
      url: baseUrl,
      port: listening.port,
      mqtt: mqttServer?.status?.() || null,
      php: phpSupervisor.status(),
      stop,
    };
    return runtimeInstance;
  }

  async function stop() {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      server = null;
    }
    if (mqttCsvCleanup) {
      try {
        mqttCsvCleanup();
      } catch {}
      mqttCsvCleanup = null;
    }
    if (mqttServer) {
      try {
        await mqttServer.stop();
      } catch {}
      mqttServer = null;
    }
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
