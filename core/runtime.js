/**
 * Nodevision Runtime
 *
 * This module defines:
 * - Where Nodevision stores data
 * - What capabilities are available
 * - How the server lifecycle is managed
 *
 * All launchers (CLI, Electron, Snap, Web) MUST go through this file.
 */

import os from "os";
import path from "path";
import fs from "fs";
import http from "http";

import { createServer } from "./server/index.js"; // your existing server entry

/* ------------------------------------------------------------------ */
/* Runtime detection                                                   */
/* ------------------------------------------------------------------ */

function detectRuntime() {
  if (process.env.ELECTRON_RUN_AS_NODE || process.versions.electron) {
    return "electron";
  }

  if (process.env.SNAP) {
    return "snap";
  }

  if (process.env.NODEVISION_BROWSER === "true") {
    return "browser";
  }

  return "node";
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

function resolveDataRoot(runtime) {
  // Explicit override always wins
  if (process.env.NODEVISION_DATA_ROOT) {
    return process.env.NODEVISION_DATA_ROOT;
  }

  switch (runtime) {
    case "snap":
      return process.env.SNAP_USER_DATA;

    case "electron":
      return path.join(
        process.env.LOCALAPPDATA || os.homedir(),
        "Nodevision"
      );

    case "browser":
    case "node":
    default:
      return path.join(os.homedir(), "Nodevision");
  }
}

/* ------------------------------------------------------------------ */
/* Capability model                                                    */
/* ------------------------------------------------------------------ */

function detectCapabilities(runtime) {
  const base = {
    filesystem: true,
    network: true,
    websocket: true,
    processControl: true,
  };

  if (runtime === "browser") {
    return {
      filesystem: false,
      network: true,
      websocket: true,
      processControl: false,
    };
  }

  return base;
}

/* ------------------------------------------------------------------ */
/* Runtime object                                                      */
/* ------------------------------------------------------------------ */

export function createRuntime(options = {}) {
  const runtime = detectRuntime();

  const dataRoot = resolveDataRoot(runtime);
  const capabilities = detectCapabilities(runtime);

  const config = {
    runtime,
    dataRoot,
    port: options.port || 3000,
    host: options.host || "127.0.0.1",
    dev: options.dev || false,
  };

  ensureDirectories(dataRoot);

  return {
    runtime,
    config,
    capabilities,

    /**
     * Start Nodevision server
     */
    async start() {
      if (!capabilities.processControl) {
        throw new Error("Runtime cannot start server");
      }

      const app = await createServer({
        dataRoot,
        runtime,
        capabilities,
        dev: config.dev,
      });

      const server = http.createServer(app);

      await new Promise((resolve) => {
        server.listen(config.port, config.host, resolve);
      });

      return {
        server,
        url: `http://${config.host}:${config.port}`,
        stop: () =>
          new Promise((resolve) => {
            server.close(resolve);
          }),
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function ensureDirectories(root) {
  const dirs = [
    root,
    path.join(root, "Notebook"),
    path.join(root, "Config"),
    path.join(root, "Cache"),
    path.join(root, "Logs"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
