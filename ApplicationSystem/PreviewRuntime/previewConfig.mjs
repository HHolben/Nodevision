// Nodevision/ApplicationSystem/PreviewRuntime/previewConfig.js
// This file defines the preview Config module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_PREVIEW_CONFIG = Object.freeze({
  // DEVELOPMENT FEATURE ONLY: executes code on the host.
  // This is NOT a sandbox. Do not expose to untrusted users.
  runner: 'local-dev',

  previewRuntimeService: {
    host: '127.0.0.1',
    port: 4010,
    basePath: '/v1',
    tokenEnv: 'NODEVISION_PREVIEW_RUNTIME_TOKEN',
  },

  workspaceRoot: path.join(os.tmpdir(), 'nodevision-preview'),
  timeoutMs: 5000,
  stdoutLimit: 100_000,
  stderrLimit: 100_000,
  sourceLimit: 256 * 1024,

  toolPaths: {
    python3: 'python3',
    javac: 'javac',
    java: 'java',
    gpp: 'g++',
  },
});

export function loadPreviewRuntimeConfig({ runtimeRoot } = {}) {
  const merged = { ...DEFAULT_PREVIEW_CONFIG };

  const envPort = Number(process.env.NODEVISION_PREVIEW_RUNTIME_PORT);
  if (Number.isFinite(envPort) && envPort > 0) merged.previewRuntimeService.port = envPort;
  if (process.env.NODEVISION_PREVIEW_RUNTIME_HOST) merged.previewRuntimeService.host = process.env.NODEVISION_PREVIEW_RUNTIME_HOST;

  if (process.env.NODEVISION_PREVIEW_WORKSPACE_ROOT) merged.workspaceRoot = process.env.NODEVISION_PREVIEW_WORKSPACE_ROOT;
  if (process.env.NODEVISION_PREVIEW_TIMEOUT_MS) merged.timeoutMs = Number(process.env.NODEVISION_PREVIEW_TIMEOUT_MS);
  if (process.env.NODEVISION_PREVIEW_STDOUT_LIMIT) merged.stdoutLimit = Number(process.env.NODEVISION_PREVIEW_STDOUT_LIMIT);
  if (process.env.NODEVISION_PREVIEW_STDERR_LIMIT) merged.stderrLimit = Number(process.env.NODEVISION_PREVIEW_STDERR_LIMIT);

  if (process.env.NODEVISION_PREVIEW_PYTHON3) merged.toolPaths.python3 = process.env.NODEVISION_PREVIEW_PYTHON3;
  if (process.env.NODEVISION_PREVIEW_JAVAC) merged.toolPaths.javac = process.env.NODEVISION_PREVIEW_JAVAC;
  if (process.env.NODEVISION_PREVIEW_JAVA) merged.toolPaths.java = process.env.NODEVISION_PREVIEW_JAVA;
  if (process.env.NODEVISION_PREVIEW_GPP) merged.toolPaths.gpp = process.env.NODEVISION_PREVIEW_GPP;

  return { ...merged, __runtimeRoot: runtimeRoot || process.env.NODEVISION_ROOT || process.cwd() };
}

export function getPreviewRuntimeBaseUrl(config) {
  const host = config.previewRuntimeService.host;
  const port = config.previewRuntimeService.port;
  const basePath = config.previewRuntimeService.basePath || '';
  return `http://${host}:${port}${basePath}`;
}
