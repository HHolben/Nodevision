// Nodevision/ApplicationSystem/routes/api/serverDataRoutes.js
// This route exposes the curated login background asset and authenticated ServerData writes.

import express from "express";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

import { createServerContext } from "../../shared/serverContext.mjs";
import { validateSvgSavePayload } from "./fileSaveRoutes/svgSaveGuard.js";
import { validateSaveSourcePath } from "./fileSaveRoutes/saveSourceGuard.js";
import { isWithin } from "./fileSaveRoutes/paths.js";
import {
  NOTEBOOK_BACKUP_DIRNAME,
  backupRelativePathForNotebookPath,
  loadNotebookBackupSettings,
  pruneOldNotebookBackups,
} from "./fileSaveRoutes/notebookBackups.js";

const BASE_CONTEXT = createServerContext();

function setNoCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

async function resolveLoginBackgroundSvg(ctx) {
  const candidates = [
    path.join(ctx.serverDataDir, "NotebookLoginBackground.svg"),
    path.resolve(process.cwd(), "ServerData", "NotebookLoginBackground.svg"),
    path.join(os.homedir(), "Nodevision", "ServerData", "NotebookLoginBackground.svg"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return { path: candidate, candidates };
    } catch {
      // Try the next standard runtime location.
    }
  }
  return { path: null, candidates };
}

async function backupServerDataFileBeforeSave(ctx, filePath, relativePath) {
  const backupRoot = path.join(ctx.userSettingsDir, NOTEBOOK_BACKUP_DIRNAME);
  const { settings } = await loadNotebookBackupSettings(ctx.userSettingsDir);
  await fs.mkdir(backupRoot, { recursive: true });

  let stat = null;
  try {
    stat = await fs.stat(filePath);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  let backupPath = null;
  let backupRelativePath = null;
  if (stat?.isFile?.()) {
    backupRelativePath = backupRelativePathForNotebookPath(relativePath);
    backupPath = path.join(backupRoot, backupRelativePath);
    if (!isWithin(backupRoot, backupPath)) throw new Error("Backup path escaped NotebookBackups root");
    if (!isWithin(ctx.serverDataDir, filePath)) throw new Error("ServerData save path escaped ServerData root");
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(filePath, backupPath);
  }

  await pruneOldNotebookBackups({ backupRoot, retentionHours: settings.retentionHours });
  return { backupPath, backupRelativePath, backupFolder: NOTEBOOK_BACKUP_DIRNAME };
}

async function sendLoginBackgroundSvg(ctx, res) {
  const resolved = await resolveLoginBackgroundSvg(ctx);
  if (!resolved.path) {
    console.warn("[login-background] Missing NotebookLoginBackground.svg. Looked in:", resolved.candidates);
    setNoCache(res);
    return res.status(404).type("text/plain").send("NotebookLoginBackground.svg not found");
  }

  setNoCache(res);
  return res.sendFile(resolved.path);
}

export default function createServerDataRoutes(ctx = BASE_CONTEXT) {
  const router = express.Router();

  router.use(/^\/ServerSettings(\/|$)/i, (_req, res) => {
    return res.status(403).json({ error: "Forbidden" });
  });

  router.head("/ServerData/NotebookLoginBackground.svg", async (_req, res) => {
    const resolved = await resolveLoginBackgroundSvg(ctx);
    setNoCache(res);
    if (!resolved.path) return res.status(404).end();
    return res.status(200).end();
  });

  router.get("/ServerData/NotebookLoginBackground.svg", async (_req, res) => {
    return sendLoginBackgroundSvg(ctx, res);
  });

  router.get("/api/loginBackground/status", async (_req, res) => {
    const resolved = await resolveLoginBackgroundSvg(ctx);
    return res.json({
      found: Boolean(resolved.path),
      resolvedPath: resolved.path,
      candidates: resolved.candidates,
    });
  });

  router.post("/api/serverData/save", async (req, res) => {
    if (!req.identity) return res.status(401).json({ error: "Authentication required" });

    const { path: requestedPath, content, encoding = "utf8", bom = false, sourcePath } = req.body || {};
    if (content === undefined) return res.status(400).json({ error: "File content is required" });

    const normalized = String(requestedPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const allowed = new Set(["ServerData/NotebookLoginBackground.svg", "NotebookLoginBackground.svg"]);
    if (!allowed.has(normalized)) return res.status(400).json({ error: "Invalid ServerData save path" });

    const sourceValidation = validateSaveSourcePath({ relativePath: normalized, sourcePath });
    if (!sourceValidation.ok) {
      return res.status(409).json({
        error: sourceValidation.error,
        code: sourceValidation.code,
        sourcePath: sourceValidation.sourcePath,
        targetPath: sourceValidation.targetPath,
      });
    }

    const svgValidation = validateSvgSavePayload({ relativePath: normalized, content, encoding });
    if (!svgValidation.ok) return res.status(400).json({ error: svgValidation.error, code: svgValidation.code });

    const filePath = path.join(ctx.serverDataDir, "NotebookLoginBackground.svg");
    try {
      await fs.mkdir(ctx.serverDataDir, { recursive: true });
      const backup = await backupServerDataFileBeforeSave(ctx, filePath, "ServerData/NotebookLoginBackground.svg");
      const rawBuffer = encoding === "base64"
        ? Buffer.from(String(content || ""), "base64")
        : Buffer.from(String(content ?? ""), encoding);
      const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const buf = bom && (encoding === "utf8" || encoding === "utf-8") ? Buffer.concat([utf8Bom, rawBuffer]) : rawBuffer;

      await fs.writeFile(filePath, buf);
      return res.json({
        success: true,
        path: normalized,
        backupCreated: Boolean(backup.backupPath),
        backupFolder: backup.backupPath ? backup.backupFolder : null,
        backupPath: backup.backupRelativePath || null,
      });
    } catch (err) {
      console.error("Error saving ServerData asset:", err);
      return res.status(500).json({ error: "Error saving ServerData asset" });
    }
  });

  return router;
}
