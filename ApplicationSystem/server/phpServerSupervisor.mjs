// Nodevision/ApplicationSystem/server/phpServerSupervisor.mjs
// This file manages a local PHP built-in web server used for PHP deployments and /php proxy routing.

import net from 'node:net';
import { spawn } from 'node:child_process';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortAvailable(host, port) {
  return await new Promise((resolve) => {
    const tester = net.createServer();
    tester.unref();
    tester.once('error', () => resolve(false));
    tester.listen({ host, port, exclusive: true }, () => {
      tester.close(() => resolve(true));
    });
  });
}

function killProcessTree(proc) {
  if (!proc) return;
  try {
    if (proc.pid) {
      try {
        process.kill(-proc.pid, 'SIGTERM');
        return;
      } catch {}
      try {
        process.kill(proc.pid, 'SIGTERM');
        return;
      } catch {}
    }
  } catch {}
  try {
    proc.kill('SIGTERM');
  } catch {}
}

export function createPhpServerSupervisor(
  ctx,
  {
    enabled = true,
    host = '127.0.0.1',
    port = 8080,
    portFallbackMaxAttempts = 25,
    phpCommand = 'php',
    logger = console,
  } = {},
) {
  let child = null;
  let actualPort = null;
  let lastStartAt = null;

  function status() {
    return {
      enabled: Boolean(enabled),
      running: Boolean(child && child.exitCode == null),
      pid: child?.pid ?? null,
      requestedPort: port,
      port: actualPort,
      host,
      url: actualPort ? `http://${host}:${actualPort}` : null,
      docRoot: ctx?.notebookDir ?? null,
      lastStartAt,
    };
  }

  async function start() {
    if (!enabled) return { ok: true, started: false, disabled: true, ...status() };
    if (child && child.exitCode == null) return { ok: true, started: false, ...status() };

    const docRoot = ctx?.notebookDir;
    if (!docRoot) throw new Error('Missing ctx.notebookDir for PHP server docroot');

    const maxAttempts = Math.max(1, Number(portFallbackMaxAttempts) || 1);
    const basePort = Math.max(1, Number(port) || 8080);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidatePort = basePort + attempt;
      const available = await isPortAvailable(host, candidatePort);
      if (!available) continue;

      let spawnError = null;
      const args = ['-S', `${host}:${candidatePort}`, '-t', docRoot];
      const proc = spawn(phpCommand, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
        env: process.env,
      });

      proc.once('error', (err) => {
        spawnError = err;
      });

      proc.stdout?.on('data', (chunk) => {
        const msg = String(chunk).trimEnd();
        if (msg) logger.log?.(`[php] ${msg}`);
      });
      proc.stderr?.on('data', (chunk) => {
        const msg = String(chunk).trimEnd();
        if (msg) logger.warn?.(`[php] ${msg}`);
      });
      proc.on('exit', (code, signal) => {
        logger.warn?.('[php] exited', { code, signal });
        if (child === proc) {
          child = null;
          actualPort = null;
        }
      });

      await sleep(150);
      if (spawnError) {
        if (spawnError?.code === 'ENOENT') {
          throw new Error(`PHP command not found: ${phpCommand}`);
        }
        killProcessTree(proc);
        continue;
      }
      if (proc.exitCode != null) {
        killProcessTree(proc);
        continue;
      }

      if (candidatePort !== basePort) {
        logger.warn?.(`PHP port ${basePort} is in use; using ${candidatePort} instead.`);
      }

      child = proc;
      actualPort = candidatePort;
      lastStartAt = new Date().toISOString();
      return { ok: true, started: true, ...status() };
    }

    return { ok: false, started: false, error: 'No available PHP port found', ...status() };
  }

  async function stop() {
    if (!child) return { ok: true, stopped: false, ...status() };
    const proc = child;
    child = null;
    actualPort = null;
    killProcessTree(proc);
    return { ok: true, stopped: true, ...status() };
  }

  return { start, stop, status };
}
