// Nodevision/ApplicationSystem/routes/api/scad.js
// This file defines the scad API route handler for the Nodevision server. It validates requests and sends responses for scad operations.

import express from "express";
import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createServerContext } from "../../shared/serverContext.mjs";

const BASE_CONTEXT = createServerContext();
const OPENSCAD_ENV_KEYS = ["NODEVISION_OPENSCAD_BIN", "OPENSCAD_BIN"];
const OPENSCAD_BINARY_NAMES = process.platform === "win32" ? ["openscad.exe", "openscad"] : ["openscad"];
const FLATPAK_SPAWN_PATHS = ["/usr/bin/flatpak-spawn", "flatpak-spawn"];

function configuredOpenSCADBin(ctx = {}) {
  const fromContext = ctx.openscadBin || ctx.openSCADBin;
  if (fromContext) return String(fromContext).trim();
  for (const key of OPENSCAD_ENV_KEYS) {
    if (process.env[key]) return String(process.env[key]).trim();
  }
  return "";
}

function hasPathSeparator(value) {
  return String(value || "").includes("/") || String(value || "").includes("\\");
}

function resolveConfiguredPath(value, ctx = {}) {
  if (path.isAbsolute(value)) return value;
  return path.resolve(ctx.runtimeRoot || process.cwd(), value);
}

function commandSpec(command, options = {}) {
  return {
    command,
    argsPrefix: Array.isArray(options.argsPrefix) ? options.argsPrefix : [],
    configured: options.configured || "",
    searched: Array.isArray(options.searched) ? options.searched : [],
    flatpakAvailable: !!options.flatpakAvailable,
    flatpakRuntime: !!options.flatpakRuntime,
  };
}

function displayCommand(spec = {}) {
  return [spec.command, ...(spec.argsPrefix || [])].filter(Boolean).join(" ");
}

async function canRunFile(filePath) {
  try {
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    if (process.platform !== "win32") return false;
  }

  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function pathCandidatesForCommand(command) {
  const pathValue = process.env.PATH || "";
  return pathValue
    .split(path.delimiter)
    .map((dir) => dir.trim())
    .filter(Boolean)
    .map((dir) => path.join(dir, command));
}

async function resolveFlatpakSpawnPath() {
  for (const candidate of FLATPAK_SPAWN_PATHS) {
    if (hasPathSeparator(candidate)) {
      if (await canRunFile(candidate)) return candidate;
      continue;
    }

    for (const pathCandidate of pathCandidatesForCommand(candidate)) {
      if (await canRunFile(pathCandidate)) return pathCandidate;
    }
  }
  return "";
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function appearsToRunInFlatpak() {
  if (process.env.FLATPAK_ID || process.env.container === "flatpak") return true;
  return (await pathExists("/.flatpak-info")) || (await pathExists("/run/host"));
}

function localOpenSCADCandidates(ctx = {}) {
  const roots = [
    ctx.openscadDir,
    ctx.runtimeRoot,
    ctx.applicationSystemRoot,
    ctx.runtimeRoot ? path.join(ctx.runtimeRoot, "bin") : "",
    ctx.applicationSystemRoot ? path.join(ctx.applicationSystemRoot, "bin") : "",
    ctx.applicationSystemRoot ? path.join(ctx.applicationSystemRoot, "vendor", "openscad") : "",
    typeof process.execPath === "string" ? path.dirname(process.execPath) : "",
    typeof process.execPath === "string" ? path.join(path.dirname(process.execPath), "bin") : "",
  ].filter(Boolean);

  const candidates = [];
  for (const root of roots) {
    for (const name of OPENSCAD_BINARY_NAMES) {
      candidates.push(path.join(root, name));
    }
  }
  return [...new Set(candidates)];
}

async function configuredFlatpakCommand(configured) {
  const prefix = "flatpak-spawn --host ";
  if (!configured.startsWith(prefix)) return null;
  const hostCommand = configured.slice(prefix.length).trim();
  if (!hostCommand) return null;

  const flatpakSpawn = await resolveFlatpakSpawnPath();
  return commandSpec(flatpakSpawn, {
    argsPrefix: flatpakSpawn ? ["--host", hostCommand] : [],
    configured,
    flatpakAvailable: !!flatpakSpawn,
    flatpakRuntime: true,
  });
}

export async function resolveOpenSCADBin(ctx = {}) {
  const configured = configuredOpenSCADBin(ctx);
  if (configured) {
    const flatpakConfigured = await configuredFlatpakCommand(configured);
    if (flatpakConfigured) return flatpakConfigured;
    if (!hasPathSeparator(configured)) return commandSpec(configured, { configured });

    const configuredPath = resolveConfiguredPath(configured, ctx);
    return commandSpec((await canRunFile(configuredPath)) ? configuredPath : "", {
      configured,
      searched: [configuredPath],
    });
  }

  const searched = localOpenSCADCandidates(ctx);
  for (const candidate of searched) {
    if (await canRunFile(candidate)) return commandSpec(candidate, { searched });
  }

  const flatpakSpawn = await resolveFlatpakSpawnPath();
  if (flatpakSpawn) {
    return commandSpec(flatpakSpawn, {
      argsPrefix: ["--host", "openscad"],
      configured: "flatpak-spawn --host openscad",
      searched,
      flatpakAvailable: true,
    });
  }

  if (await appearsToRunInFlatpak()) {
    return commandSpec("", {
      argsPrefix: ["--host", "openscad"],
      configured: "flatpak-spawn --host openscad",
      searched,
      flatpakRuntime: true,
    });
  }

  return commandSpec("openscad", { searched });
}

function isMissingOpenSCADError(err) {
  const msg = err?.message || String(err || "");
  return err?.code === "ENOENT" || /enoent|not found|no such file|command.*not.*found/i.test(msg);
}

function openSCADMissingHint(resolved = {}) {
  const attempted = displayCommand(resolved) || resolved.configured;
  const configured = resolved.configured ? "Configured OpenSCAD command: " + attempted + ". " : "";
  const flatpak = resolved.flatpakAvailable
    ? "This appears to be running in a Flatpak runtime; install OpenSCAD on the host system (Fedora: sudo dnf install openscad) so flatpak-spawn --host openscad can run it. "
    : resolved.flatpakRuntime
      ? "This appears to be running in a Flatpak runtime, but flatpak-spawn is not available to the server process. Install/provide flatpak-spawn, or set NODEVISION_OPENSCAD_BIN to a usable OpenSCAD executable path inside the runtime. "
      : "";
  const searched = resolved.searched?.length ? " Searched: " + resolved.searched.join(", ") : "";
  return configured + flatpak + "Install OpenSCAD on the server, or set NODEVISION_OPENSCAD_BIN to the full path of the OpenSCAD executable." + searched;
}

export function runOpenSCAD({ openscadBin = "openscad", openscadArgsPrefix = [], inputPath, outputPath, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const args = [...openscadArgsPrefix, "-o", outputPath, inputPath];
    const child = spawn(openscadBin, args, { stdio: ["ignore", "pipe", "pipe"] });

    /** @type {Buffer[]} */
    const stdout = [];
    /** @type {Buffer[]} */
    const stderr = [];

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("OpenSCAD timed out after " + String(timeoutMs) + "ms"));
    }, timeoutMs);

    child.stdout.on("data", (d) => stdout.push(Buffer.from(d)));
    child.stderr.on("data", (d) => stderr.push(Buffer.from(d)));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
      } else {
        const errText = Buffer.concat(stderr).toString("utf8").trim();
        reject(new Error(errText || "OpenSCAD exited with code " + String(code)));
      }
    });
  });
}

export default function createSCADRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();

  router.post("/scad/render", async (req, res) => {
    if (!req.identity) return res.status(401).json({ error: "Authentication required" });

    const { scadCode, format = "stl" } = req.body || {};
    if (format !== "stl") return res.status(400).json({ error: "Only format=stl is supported" });
    if (typeof scadCode !== "string") return res.status(400).json({ error: "scadCode must be a string" });
    if (scadCode.length > 5_000_000) return res.status(413).json({ error: "scadCode too large" });
    if (!scadCode.trim()) return res.status(400).json({ error: "Empty scadCode" });

    const cacheRoot = ctx.cacheDir || os.tmpdir();
    await fs.mkdir(cacheRoot, { recursive: true });

    const tmpDir = await fs.mkdtemp(path.join(cacheRoot, "scad-"));
    const inputPath = path.join(tmpDir, "model.scad");
    const outputPath = path.join(tmpDir, "model.stl");
    const resolvedOpenSCAD = await resolveOpenSCADBin(ctx);

    try {
      if (!resolvedOpenSCAD.command) {
        return res.status(503).json({
          error: "OpenSCAD CLI not found.",
          hint: openSCADMissingHint(resolvedOpenSCAD),
        });
      }

      await fs.writeFile(inputPath, scadCode, "utf8");
      await runOpenSCAD({
        openscadBin: resolvedOpenSCAD.command,
        openscadArgsPrefix: resolvedOpenSCAD.argsPrefix,
        inputPath,
        outputPath,
        timeoutMs: 30000,
      });
      const out = await fs.readFile(outputPath);
      res.setHeader("Content-Type", "application/sla");
      res.setHeader("Cache-Control", "no-store");
      res.send(out);
    } catch (err) {
      const msg = err?.message || String(err);
      const missing = isMissingOpenSCADError(err);
      const hint = missing ? openSCADMissingHint(resolvedOpenSCAD) : undefined;
      res.status(missing ? 503 : 500).json({ error: msg, hint });
    } finally {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Best effort.
      }
    }
  });

  return router;
}
