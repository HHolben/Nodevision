// Nodevision/start-servers.js
// Purpose: Launch the Nodevision runtime controller

import * as buffer from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function main() {
  ensureNodeWebApiGlobals();

  if (!process.env.NODEVISION_ROOT) {
    process.env.NODEVISION_ROOT = path.dirname(fileURLToPath(import.meta.url));
  }

  const { createRuntime } = await import("./ApplicationSystem/core/runtime.js");
  const runtime = createRuntime({
    dev: true,
  });
  await runtime.start();
}

main().catch((err) => {
  console.error("[start-servers] Failed to start runtime:", err);
  process.exitCode = 1;
});
