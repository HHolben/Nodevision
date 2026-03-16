import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function safeTrim(text) {
  return String(text || '').trim();
}

function tokenFilePath(ctx) {
  return path.join(ctx.configDir, 'previewRuntime.token');
}

async function readTokenFromFile(ctx) {
  try {
    const token = await fs.readFile(tokenFilePath(ctx), 'utf8');
    return safeTrim(token);
  } catch {
    return '';
  }
}

async function writeTokenToFile(ctx, token) {
  const t = safeTrim(token);
  if (!t) throw new Error('token is required');
  await fs.mkdir(ctx.configDir, { recursive: true });
  await fs.writeFile(tokenFilePath(ctx), `${t}\n`, { encoding: 'utf8', mode: 0o600 });
}

function resolvePreviewRuntimeScript(ctx) {
  return path.join(ctx.applicationSystemRoot, 'PreviewRuntime', 'previewRuntimeServer.js');
}

export function createPreviewRuntimeSupervisor(ctx, { logger = console } = {}) {
  let child = null;
  let lastStartAt = null;

  function status() {
    return {
      running: Boolean(child && child.exitCode == null),
      pid: child?.pid ?? null,
      lastStartAt,
      tokenFile: tokenFilePath(ctx),
      scriptPath: resolvePreviewRuntimeScript(ctx),
      url: `http://127.0.0.1:4010/v1`,
    };
  }

  async function setToken(token) {
    await writeTokenToFile(ctx, token);
    return { ok: true };
  }

  async function getToken() {
    const envToken = safeTrim(process.env.NODEVISION_PREVIEW_RUNTIME_TOKEN);
    if (envToken) return envToken;
    return await readTokenFromFile(ctx);
  }

  async function stop() {
    if (!child) return { ok: true, stopped: false };
    try {
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          child.kill('SIGTERM');
        }
      } else {
        child.kill('SIGTERM');
      }
    } catch {}
    child = null;
    return { ok: true, stopped: true };
  }

  async function start() {
    if (child && child.exitCode == null) {
      return { ok: true, started: false, ...status() };
    }

    const token = await getToken();
    if (!token) throw new Error('Preview Runtime token not set (set via UI or NODEVISION_PREVIEW_RUNTIME_TOKEN)');

    const scriptPath = resolvePreviewRuntimeScript(ctx);
    const cmd = process.env.NODEVISION_PREVIEW_RUNTIME_NODE || (typeof process.pkg !== 'undefined' ? 'node' : process.execPath);

    const env = {
      ...process.env,
      NODEVISION_ROOT: ctx.runtimeRoot,
      NODEVISION_PREVIEW_RUNTIME_TOKEN: token,
    };

    const proc = spawn(cmd, [scriptPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    proc.stdout.on('data', (chunk) => {
      logger.log?.(`[PreviewRuntime child] ${String(chunk).trimEnd()}`);
    });
    proc.stderr.on('data', (chunk) => {
      logger.warn?.(`[PreviewRuntime child] ${String(chunk).trimEnd()}`);
    });
    proc.on('exit', (code, signal) => {
      logger.warn?.('[PreviewRuntime child] exited', { code, signal });
      if (child === proc) child = null;
    });
    proc.on('error', (err) => {
      logger.error?.('[PreviewRuntime child] error', { error: String(err?.message || err) });
      if (child === proc) child = null;
    });

    child = proc;
    lastStartAt = new Date().toISOString();
    return { ok: true, started: true, ...status() };
  }

  async function restart() {
    await stop();
    return await start();
  }

  return {
    status,
    setToken,
    getToken,
    start,
    stop,
    restart,
  };
}
