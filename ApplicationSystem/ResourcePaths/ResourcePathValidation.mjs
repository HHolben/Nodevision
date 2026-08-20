// Nodevision/ApplicationSystem/ResourcePaths/ResourcePathValidation.mjs
// This module validates Resource Path keys and resolves Notebook-relative directories without permitting traversal escapes.

import fs from "node:fs/promises";
import path from "node:path";
import { isWithin } from "../routes/api/fileSaveRoutes/paths.js";

const RESOURCE_KEY_PATTERN = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/;

export function normalizeResourceKey(value) {
  const key = String(value || "").trim();
  if (!RESOURCE_KEY_PATTERN.test(key)) {
    throw new Error("Resource Path keys must use dot-separated machine-readable segments.");
  }
  return key;
}

export function normalizeResourceName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Resource Path name is required.");
  if (name.length > 80) throw new Error("Resource Path name is too long.");
  return name;
}

export function normalizeResourceRelativePath(value, options = {}) {
  let text = String(value ?? "").replace(/\\/g, "/").trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) throw new Error("Resource Paths must be inside the active Notebook.");
  if (/^[A-Za-z]:\//.test(text)) throw new Error("Windows absolute paths are not valid Notebook-relative Resource Paths.");
  if (text.startsWith("/")) throw new Error("Use a Notebook-relative Resource Path.");
  if (/^Notebook\//i.test(text)) text = text.slice("Notebook/".length);
  text = text.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
  if (!text) {
    if (options.allowEmpty) return "";
    throw new Error("Resource Path directory is required.");
  }
  const parts = text.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error("Resource Path directory cannot contain traversal segments.");
  }
  return parts.join("/");
}

export function toNotebookRelativeResourcePath(ctx, value, options = {}) {
  const text = String(value ?? "").replace(/\\/g, "/").trim();
  if (text.startsWith("/")) {
    const targetPath = path.resolve(text);
    const notebookPath = path.resolve(ctx.notebookDir);
    if (!isWithin(notebookPath, targetPath)) throw new Error("Absolute Resource Path is outside the active Notebook.");
    return normalizeResourceRelativePath(path.relative(notebookPath, targetPath).split(path.sep).join("/"), options);
  }
  return normalizeResourceRelativePath(value, options);
}

async function nearestExistingParent(targetPath) {
  let candidate = targetPath;
  while (true) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) return candidate;
    candidate = parent;
  }
}

export async function resolveNotebookResourceDirectory(ctx, relativePath) {
  const relativeDirectory = toNotebookRelativeResourcePath(ctx, relativePath);
  const notebookDir = path.resolve(ctx.notebookDir);
  const absoluteDirectory = path.resolve(notebookDir, relativeDirectory);
  if (!isWithin(notebookDir, absoluteDirectory)) throw new Error("Resource Path must remain inside the Notebook.");

  const notebookReal = await fs.realpath(notebookDir);
  const parentReal = await fs.realpath(await nearestExistingParent(absoluteDirectory));
  if (!isWithin(notebookReal, parentReal)) throw new Error("Resource Path parent escapes the Notebook.");

  let exists = false;
  let isDirectory = false;
  try {
    const stat = await fs.stat(absoluteDirectory);
    exists = true;
    isDirectory = stat.isDirectory();
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  return { relativeDirectory, absoluteDirectory, exists, isDirectory };
}
