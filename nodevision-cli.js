import { spawn } from "node:child_process";
import * as buffer from "node:buffer";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function ensureNodeWebApiGlobals() {
  const NativeBlob = buffer.Blob;
  const NativeFile = buffer.File;

  if (typeof globalThis.Blob === "undefined" && typeof NativeBlob === "function") {
    globalThis.Blob = NativeBlob;
  }

  if (typeof globalThis.File === "undefined") {
    if (typeof NativeFile === "function") {
      globalThis.File = NativeFile;
    } else if (typeof globalThis.Blob === "function") {
      globalThis.File = class NodevisionFile extends globalThis.Blob {
        constructor(parts, name, options = {}) {
          super(parts, options);
          this.name = String(name || "");
          this.lastModified = Number(options.lastModified) || Date.now();
        }
      };
    }
  }
}

function getRuntimeRoot() {
  if (process.env.NODEVISION_ROOT) {
    return process.env.NODEVISION_ROOT;
  }

  if (typeof process.pkg !== "undefined") {
    return path.dirname(process.execPath);
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

async function loadCreateRuntime() {
  ensureNodeWebApiGlobals();
  const runtimeRoot = getRuntimeRoot();
  const runtimePath = path.resolve(runtimeRoot, "ApplicationSystem/core/runtime.js");

  if (!existsSync(runtimePath)) {
    throw new Error(
      `Missing ApplicationSystem runtime at: ${runtimePath}\n` +
        `Run from a Nodevision folder that contains ./ApplicationSystem, or set NODEVISION_ROOT.`,
    );
  }

  const mod = await import(pathToFileURL(runtimePath).href);
  if (typeof mod?.createRuntime !== "function") {
    throw new Error(`Invalid runtime module (createRuntime not found): ${runtimePath}`);
  }
  return mod.createRuntime;
}

function openUrl(targetUrl) {
  const options = { stdio: "ignore", detached: true };

  if (process.platform === "darwin") {
    spawn("open", [targetUrl], options).unref();
    return;
  }

  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", targetUrl], {
      ...options,
      windowsVerbatimArguments: true,
    }).unref();
    return;
  }

  const localXdgOpen = path.join(path.dirname(process.execPath), "xdg-open");
  const opener = existsSync(localXdgOpen) ? localXdgOpen : "xdg-open";
  spawn(opener, [targetUrl], options).unref();
}

async function main() {
  try {
    if (!process.env.NODEVISION_ROOT) {
      process.env.NODEVISION_ROOT = getRuntimeRoot();
    }

    const createRuntime = await loadCreateRuntime();
    const runtime = createRuntime({
      port: 3000,
      host: "127.0.0.1",
      dev: false,
    });
    const instance = await runtime.start();
    console.log("Nodevision running at", instance.url);
    openUrl(instance.url);
  } catch (err) {
    console.error("[nodevision-cli] Failed to start Nodevision:", err);
    process.exit(1);
  }
}

main();
