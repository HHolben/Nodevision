// Nodevision/ApplicationSystem/Resources/ResourcePathSafety.mjs
// Shared path and URL helpers for typed Resource Registry sources.

import fs from "node:fs/promises";
import path from "node:path";
import { isWithin } from "../routes/api/fileSaveRoutes/paths.js";
import { resolveNotebookResourceDirectory } from "../ResourcePaths/ResourcePathValidation.mjs";
import { RESOURCE_SOURCE_TYPES } from "./ResourceTypeDefinitions.mjs";

export function normalizePortableRelativePath(value, label = "Resource path", options = {}) {
  let text = String(value ?? "").replace(/\\/g, "/").trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) throw new Error(`${label} must be relative.`);
  if (/^[A-Za-z]:\//.test(text)) throw new Error(`${label} cannot use a Windows absolute path.`);
  if (text.startsWith("/")) throw new Error(`${label} must be relative.`);
  text = text.replace(/^\.\//, "").replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
  if (!text) {
    if (options.allowEmpty) return "";
    throw new Error(`${label} is required.`);
  }
  const parts = text.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) throw new Error(`${label} cannot contain traversal segments.`);
  return parts.join("/");
}

export function pathToPosix(value) {
  return String(value || "").split(path.sep).join("/");
}

export function encodePathSegments(value) {
  return String(value || "")
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function getContextRoot(ctx, sourceType) {
  if (sourceType === RESOURCE_SOURCE_TYPES.APPLICATION) {
    const appRoot = ctx.publicDir || path.join(ctx.applicationSystemRoot || path.join(ctx.runtimeRoot || process.cwd(), "ApplicationSystem"), "public");
    return path.resolve(appRoot);
  }
  if (sourceType === RESOURCE_SOURCE_TYPES.MANAGED) {
    const userDataDir = ctx.userDataDir || path.join(ctx.runtimeRoot || process.cwd(), "UserData");
    return path.resolve(userDataDir);
  }
  if (sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK) {
    return path.resolve(ctx.notebookDir);
  }
  throw new Error(`Unsupported resource source type: ${sourceType}`);
}

async function directoryStatus(absoluteDirectory) {
  let exists = false;
  let isDirectory = false;
  try {
    const stat = await fs.stat(absoluteDirectory);
    exists = true;
    isDirectory = stat.isDirectory();
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
  return { exists, isDirectory };
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

async function safeResolveRelativeDirectory(root, relativePath, label) {
  const relativeDirectory = normalizePortableRelativePath(relativePath, label);
  const rootPath = path.resolve(root);
  const absoluteDirectory = path.resolve(rootPath, relativeDirectory);
  if (!isWithin(rootPath, absoluteDirectory)) throw new Error(`${label} must remain inside its source root.`);
  const rootStatus = await directoryStatus(rootPath);
  if (!rootStatus.exists) return { relativeDirectory, absoluteDirectory, exists: false, isDirectory: false };
  if (!rootStatus.isDirectory) throw new Error(`${label} root is not a directory.`);
  const rootReal = await fs.realpath(rootPath);
  const parentReal = await fs.realpath(await nearestExistingParent(absoluteDirectory));
  if (!isWithin(rootReal, parentReal)) throw new Error(`${label} parent escapes its source root.`);
  const status = await directoryStatus(absoluteDirectory);
  return { relativeDirectory, absoluteDirectory, ...status };
}

export async function resolveResourceSourceDirectory(ctx, source) {
  const sourceType = source.sourceType;
  if (sourceType === RESOURCE_SOURCE_TYPES.NOTEBOOK) return resolveNotebookResourceDirectory(ctx, source.path);
  const root = getContextRoot(ctx, sourceType);
  const label = sourceType === RESOURCE_SOURCE_TYPES.MANAGED ? "Managed Resource source path" : "Application Resource source path";
  return safeResolveRelativeDirectory(root, source.path, label);
}

export async function resolveResourceFilePath(ctx, source, relativePath) {
  const directory = await resolveResourceSourceDirectory(ctx, source);
  const relativeFile = normalizePortableRelativePath(relativePath, "Resource file path");
  const absolutePath = path.resolve(directory.absoluteDirectory, relativeFile);
  if (!isWithin(directory.absoluteDirectory, absolutePath)) throw new Error("Resource file path must remain inside its source directory.");
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) throw new Error("Requested resource is not a file.");
  return { ...directory, relativeFile, absolutePath, size: stat.size, modifiedAt: stat.mtime.toISOString() };
}

export function resourceUrlForFile(source, relativeFile) {
  const encodedFile = encodePathSegments(relativeFile);
  if (source.sourceType === RESOURCE_SOURCE_TYPES.APPLICATION) {
    const base = encodePathSegments(source.path);
    return `/${[base, encodedFile].filter(Boolean).join("/")}`;
  }
  return `/api/resource-paths/resource-file?type=${encodeURIComponent(source.typeId)}&source=${encodeURIComponent(source.id)}&path=${encodeURIComponent(relativeFile)}`;
}

export function sourceDisplayPath(source) {
  if (source.sourceType === RESOURCE_SOURCE_TYPES.APPLICATION) return `Application/${source.path}`;
  if (source.sourceType === RESOURCE_SOURCE_TYPES.MANAGED) return `UserData/${source.path}`;
  return `Notebook/${source.path}`;
}

export function notebookRelativePath(ctx, absolutePath) {
  return pathToPosix(path.relative(path.resolve(ctx.notebookDir), path.resolve(absolutePath))).replace(/^\.\//, "");
}
