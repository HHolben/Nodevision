// Nodevision/ApplicationSystem/PreviewRuntime/localDevRunner.js
// This file defines the local Dev Runner module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

function detectJavaMainClassName(sourcePath, fallbackClassName) {
  return fs
    .readFile(sourcePath, 'utf8')
    .then((src) => {
      const m1 = src.match(/^[ \t]*public[ \t]+(?:final[ \t]+)?class[ \t]+([A-Za-z_][A-Za-z0-9_]*)/m);
      if (m1) return m1[1];
      const m2 = src.match(/^[ \t]*class[ \t]+([A-Za-z_][A-Za-z0-9_]*)/m);
      if (m2) return m2[1];
      return fallbackClassName;
    })
    .catch(() => fallbackClassName);
}

function createCappedCollector(maxBytes) {
  let size = 0;
  const chunks = [];
  return {
    write(chunk) {
      if (!chunk || chunk.length === 0) return;
      if (size >= maxBytes) return; // keep draining but discard
      const remaining = maxBytes - size;
      const slice = chunk.length <= remaining ? chunk : chunk.subarray(0, remaining);
      chunks.push(slice);
      size += slice.length;
    },
    toString() {
      return Buffer.concat(chunks).toString('utf8');
    },
    truncated() {
      return size >= maxBytes;
    },
  };
}

async function runCommand({ cmd, args, cwd, stdinText, timeoutMs, signal, maxStdoutBytes, maxStderrBytes }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    const stdout = createCappedCollector(maxStdoutBytes);
    const stderr = createCappedCollector(maxStderrBytes);
    let finished = false;
    let timedOut = false;

    const killChild = () => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
      } catch {
        try { child.kill('SIGKILL'); } catch {}
      }
    };

    const onAbort = () => {
      killChild();
      timedOut = true;
    };
    if (signal) {
      if (signal.aborted) onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.stdout.on('data', (chunk) => stdout.write(chunk));
    child.stderr.on('data', (chunk) => stderr.write(chunk));
    child.on('error', (err) => reject(err));

    const timer = setTimeout(() => {
      timedOut = true;
      killChild();
    }, Math.max(1, Math.floor(timeoutMs)));

    child.on('exit', (code, sig) => {
      if (finished) return;
      finished = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      clearTimeout(timer);
      resolve({
        ok: (code ?? 1) === 0 && !timedOut,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: code ?? null,
        timedOut,
      });
    });

    if (stdinText) child.stdin.write(stdinText);
    child.stdin.end();
  });
}

export class LocalDevRunner {
  constructor({ config } = {}) {
    this.runner = 'local-dev';
    this.config = config;
  }

  // DEVELOPMENT-ONLY: Runs notebook code on the host (no sandbox).
  async run({ language, sourcePath, timeoutMs }, { signal }) {
    const cwd = path.dirname(sourcePath);
    const fileName = path.basename(sourcePath);

    const maxStdout = this.config.stdoutLimit;
    const maxStderr = this.config.stderrLimit;
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : this.config.timeoutMs;

    if (language === 'python') {
      return await runCommand({
        cmd: this.config.toolPaths.python3,
        args: [fileName],
        cwd,
        stdinText: '',
        timeoutMs: timeout,
        signal,
        maxStdoutBytes: maxStdout,
        maxStderrBytes: maxStderr,
      });
    }

    if (language === 'java') {
      const classFallback = fileName.replace(/\.java$/i, '');
      const compile = await runCommand({
        cmd: this.config.toolPaths.javac,
        args: [fileName],
        cwd,
        stdinText: '',
        timeoutMs: timeout,
        signal,
        maxStdoutBytes: maxStdout,
        maxStderrBytes: maxStderr,
      });
      if (compile.timedOut) return compile;
      if (compile.exitCode !== 0) return compile;

      const className = await detectJavaMainClassName(sourcePath, classFallback);
      let run = await runCommand({
        cmd: this.config.toolPaths.java,
        args: [className],
        cwd,
        stdinText: '',
        timeoutMs: timeout,
        signal,
        maxStdoutBytes: maxStdout,
        maxStderrBytes: maxStderr,
      });
      if (run.exitCode !== 0 && className !== classFallback) {
        run = await runCommand({
          cmd: this.config.toolPaths.java,
          args: [classFallback],
          cwd,
          stdinText: '',
          timeoutMs: timeout,
          signal,
          maxStdoutBytes: maxStdout,
          maxStderrBytes: maxStderr,
        });
      }
      return run;
    }

    if (language === 'cpp') {
      const outBin = path.join(cwd, 'program');
      const compile = await runCommand({
        cmd: this.config.toolPaths.gpp,
        args: [fileName, '-o', outBin],
        cwd,
        stdinText: '',
        timeoutMs: timeout,
        signal,
        maxStdoutBytes: maxStdout,
        maxStderrBytes: maxStderr,
      });
      if (compile.timedOut) return compile;
      if (compile.exitCode !== 0) return compile;
      return await runCommand({
        cmd: outBin,
        args: [],
        cwd,
        stdinText: '',
        timeoutMs: timeout,
        signal,
        maxStdoutBytes: maxStdout,
        maxStderrBytes: maxStderr,
      });
    }

    throw new Error(`Unsupported language: ${language}`);
  }
}
