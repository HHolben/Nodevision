// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/paths.js
// This file implements path normalization helpers for file save routes so that client-supplied paths are resolved safely against notebook and settings roots.

import path from "node:path";

export function normalizeClientPath(inputPath) {
  return String(inputPath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .trim();
}

export function isWithin(parentDir, childPath) {
  const rel = path.relative(parentDir, childPath);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function resolveNotebookPath({ notebookRoot, relativePath }) {
  if (!relativePath) throw new Error("Missing path");
  let cleaned = String(relativePath).replace(/^\/+/, "");
  cleaned = path.normalize(cleaned);
  cleaned = cleaned.replace(/\.\.(\/|\\)/g, "");
  const nbPrefix = `Notebook${path.sep}`;
  if (cleaned.startsWith(nbPrefix)) cleaned = cleaned.slice(nbPrefix.length);
  return path.join(notebookRoot, cleaned);
}

export function resolveUserSettingsPath({ userSettingsRoot, relativePath }) {
  if (!relativePath) throw new Error("Missing path");
  let cleaned = String(relativePath).replace(/^\/+/, "");
  cleaned = path.normalize(cleaned);
  cleaned = cleaned.replace(/\.\.(\/|\\)/g, "");
  return path.join(userSettingsRoot, cleaned);
}

