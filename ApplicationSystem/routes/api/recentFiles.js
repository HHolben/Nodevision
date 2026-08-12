// Nodevision/ApplicationSystem/routes/api/recentFiles.js
// This file stores the toolbar recent-files manifest in UserData while accepting only normalized Notebook-relative file references.

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createServerContext } from "../../shared/serverContext.mjs";

export const RECENT_FILES_MANIFEST_SCHEMA = "nodevision-recent-files/1";
export const RECENT_FILES_LIMIT = 20;

const BASE_CONTEXT = createServerContext();
const STORAGE_DIR = "RecentFiles";
const MANIFEST_FILE = "manifest.json";
const PROTECTED_APP_PREFIXES = [
  "ApplicationSystem/",
  "NativeComponents/",
  "ServerData/",
  "ServerSettings/",
  "UserData/",
  "UserSettings/",
];

function requireIdentity(req, res, next) {
  if (req.identity) return next();
  return res.status(401).json({ error: "Authentication required" });
}

function normalizePathParts(value) {
  const parts = [];
  for (const part of String(value || "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return [];
    parts.push(part);
  }
  return parts;
}

export function normalizeRecentManifestPath(pathValue) {
  let value = String(pathValue || "").replace(/\u0000/g, "").trim();
  if (!value) return "";
  value = value.replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/\/+/g, "/");

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = new URL(value, "http://nodevision.local/").pathname;
  } catch {
    return "";
  }

  const marker = "/notebook/";
  const markerIndex = value.toLowerCase().indexOf(marker);
  if (markerIndex >= 0) value = value.slice(markerIndex + marker.length);
  value = value.replace(/^\/+/, "");
  if (value.toLowerCase().startsWith("notebook/")) value = value.slice("Notebook/".length);

  const normalized = normalizePathParts(value).join("/");
  if (!normalized || !normalized.includes(".")) return "";
  const lower = normalized.toLowerCase();
  if (PROTECTED_APP_PREFIXES.some((prefix) => lower.startsWith(prefix.toLowerCase()))) return "";
  return normalized;
}

function entryFromValue(value) {
  const source = typeof value === "string" ? { path: value } : value;
  const pathValue = normalizeRecentManifestPath(source?.path);
  if (!pathValue) return null;
  const editedAt = Number.isFinite(source?.editedAt) ? source.editedAt : 0;
  return { path: pathValue, editedAt };
}

export function sanitizeRecentManifestEntries(values) {
  const seen = new Set();
  const entries = [];
  const list = Array.isArray(values) ? values : [];
  for (const value of list) {
    const entry = entryFromValue(value);
    if (!entry || seen.has(entry.path)) continue;
    seen.add(entry.path);
    entries.push(entry);
    if (entries.length >= RECENT_FILES_LIMIT) break;
  }
  return entries;
}

export function recentManifestPath(ctx) {
  return path.join(ctx.userDataDir, STORAGE_DIR, MANIFEST_FILE);
}

function manifestFromEntries(entries) {
  return {
    schema: RECENT_FILES_MANIFEST_SCHEMA,
    updatedAt: new Date().toISOString(),
    files: sanitizeRecentManifestEntries(entries),
  };
}

async function readManifest(ctx) {
  try {
    const parsed = JSON.parse(await fs.readFile(recentManifestPath(ctx), "utf8"));
    return manifestFromEntries(Array.isArray(parsed?.files) ? parsed.files : parsed?.entries);
  } catch (err) {
    if (err?.code !== "ENOENT") console.warn("[RecentFiles] Ignoring unreadable UserData manifest:", err);
    return manifestFromEntries([]);
  }
}

async function writeManifest(ctx, entries) {
  const filePath = recentManifestPath(ctx);
  const manifest = manifestFromEntries(entries);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
  return manifest;
}

function entriesFromRequest(body) {
  if (Array.isArray(body?.files)) return body.files;
  if (Array.isArray(body?.entries)) return body.entries;
  return [];
}

export default function createRecentFilesRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  router.use(requireIdentity);

  router.get("/recent-files/manifest", async (req, res) => {
    try {
      res.json(await readManifest(ctx));
    } catch (err) {
      console.error("[RecentFiles] Failed to read UserData manifest:", err);
      res.status(500).json({ error: "Failed to read recent files manifest" });
    }
  });

  router.post("/recent-files/manifest", async (req, res) => {
    try {
      res.json(await writeManifest(ctx, entriesFromRequest(req.body || {})));
    } catch (err) {
      console.error("[RecentFiles] Failed to write UserData manifest:", err);
      res.status(500).json({ error: "Failed to save recent files manifest" });
    }
  });

  return router;
}
