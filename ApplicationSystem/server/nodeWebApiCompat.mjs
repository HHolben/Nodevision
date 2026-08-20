// Nodevision/ApplicationSystem/server/nodeWebApiCompat.mjs
// This module supplies small Web API globals that newer dependencies may expect when Nodevision is running on the packaged Node runtime. It keeps compatibility shims at the server boundary instead of scattering dependency-specific guards through route modules.
import * as buffer from "node:buffer";

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
