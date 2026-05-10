// Nodevision/ApplicationSystem/Sync/SyncScopes.mjs
// This module defines security-first, configurable Notebook sync scopes by validating allowed relative subtree names, resolving safe scope roots under Notebook, generating scoped manifests, and comparing manifests without allowing path escape or system-folder sync.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const DEFAULT_SYNC_SCOPES = ["SyncTest"];
const BLOCKED_TOP_LEVEL = new Set(["serversettings", ".git", "node_modules", "applicationsystem"]);
const EXCLUDED_SCOPE_DIRS = new Set([".conflicts", ".resolved-conflicts", ".conflict-backups"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeNonEmptyString(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${fieldName} must be a nonempty string`);
  return text;
}

function resolveRuntimeRoot(options = {}) {
  if (options.runtimeRoot) return path.resolve(String(options.runtimeRoot));
  if (process.env.NODEVISION_ROOT) return path.resolve(process.env.NODEVISION_ROOT);
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..");
}

function resolveNotebookDir(options = {}) {
  if (options.notebookDir) return path.resolve(String(options.notebookDir));
  return path.resolve(resolveRuntimeRoot(options), "Notebook");
}

function resolveSyncScopesPath(options = {}) {
  if (options.syncScopesPath) return path.resolve(String(options.syncScopesPath));
  const runtimeRoot = resolveRuntimeRoot(options);
  return path.resolve(runtimeRoot, "ServerSettings", "Sync", "sync-scopes.json");
}

function isSafeDescendant(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function splitScopeSegments(scope) {
  return scope.split("/").filter((segment) => segment.length > 0);
}

function normalizeSafeRelativePath(value, fieldName) {
  const relativePath = normalizeNonEmptyString(value, fieldName);
  if (relativePath.includes("\0")) throw new Error(`${fieldName} must not contain null bytes`);
  if (relativePath.includes("\\")) throw new Error(`${fieldName} must not contain backslashes`);
  if (path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new Error(`${fieldName} must be relative`);
  }
  if (relativePath.endsWith("/")) throw new Error(`${fieldName} must not end with "/"`);
  const normalized = path.posix.normalize(relativePath);
  if (normalized !== relativePath) throw new Error(`${fieldName} must be normalized and traversal-safe`);
  if (normalized === "." || normalized.includes("..")) throw new Error(`${fieldName} must not contain ".."`);
  return normalized;
}

export function validateSyncScope(scope) {
  const normalized = normalizeSafeRelativePath(scope, "scope");
  const segments = splitScopeSegments(normalized);
  if (segments.length === 0) throw new Error("scope must contain at least one path segment");

  const topLevel = segments[0];
  if (topLevel.startsWith(".")) throw new Error("scope must not use hidden top-level directories");
  if (BLOCKED_TOP_LEVEL.has(topLevel.toLowerCase())) {
    throw new Error(`scope top-level directory is blocked: ${topLevel}`);
  }

  return normalized;
}

export async function loadSyncScopes(options = {}) {
  const scopesPath = resolveSyncScopesPath(options);
  let raw;

  try {
    raw = JSON.parse(await fs.readFile(scopesPath, "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT") {
      return { syncScopes: [...DEFAULT_SYNC_SCOPES] };
    }
    throw err;
  }

  if (!isPlainObject(raw)) {
    throw new Error("sync-scopes.json must contain a JSON object");
  }
  if (!Array.isArray(raw.syncScopes)) {
    throw new Error("sync-scopes.json must contain syncScopes as an array");
  }

  const seen = new Set();
  const syncScopes = [];
  for (const entry of raw.syncScopes) {
    const validated = validateSyncScope(entry);
    if (seen.has(validated)) continue;
    seen.add(validated);
    syncScopes.push(validated);
  }

  return { syncScopes };
}

export async function saveSyncScopes(scopes, options = {}) {
  if (!Array.isArray(scopes)) throw new Error("scopes must be an array");
  const seen = new Set();
  const normalizedScopes = [];
  for (const scope of scopes) {
    const validated = validateSyncScope(scope);
    if (seen.has(validated)) continue;
    seen.add(validated);
    normalizedScopes.push(validated);
  }
  if (normalizedScopes.length === 0) {
    normalizedScopes.push(DEFAULT_SYNC_SCOPES[0]);
  }

  const scopesPath = resolveSyncScopesPath(options);
  await fs.mkdir(path.dirname(scopesPath), { recursive: true });
  await fs.writeFile(
    scopesPath,
    `${JSON.stringify({ syncScopes: normalizedScopes }, null, 2)}\n`,
    "utf8",
  );
  return { syncScopes: normalizedScopes };
}

export async function addSyncScope(scope, options = {}) {
  const normalized = validateSyncScope(scope);
  const loaded = await loadSyncScopes(options);
  if (loaded.syncScopes.includes(normalized)) return loaded;
  return saveSyncScopes([...loaded.syncScopes, normalized], options);
}

export async function removeSyncScope(scope, options = {}) {
  const normalized = validateSyncScope(scope);
  if (normalized === "SyncTest") {
    throw new Error("SyncTest scope cannot be removed");
  }
  const loaded = await loadSyncScopes(options);
  return saveSyncScopes(loaded.syncScopes.filter((item) => item !== normalized), options);
}

export async function listCandidateNotebookFolders(options = {}) {
  const notebookDir = resolveNotebookDir(options);
  let entries = [];
  try {
    entries = await fs.readdir(notebookDir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
  const activeScopes = new Set((await loadSyncScopes(options)).syncScopes);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.isSymbolicLink()) continue;
    if (shouldExcludeEntry(entry.name)) continue;
    const relativePath = entry.name;
    try {
      validateSyncScope(relativePath);
    } catch {
      continue;
    }
    candidates.push({
      name: entry.name,
      relativePath,
      syncEnabled: activeScopes.has(relativePath),
    });
  }
  candidates.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return candidates;
}

export function resolveScopeNotebookPath({ notebookDir, scope }) {
  const notebookRoot = path.resolve(normalizeNonEmptyString(notebookDir, "notebookDir"));
  const validatedScope = validateSyncScope(scope);
  const scopeRoot = path.resolve(notebookRoot, validatedScope);
  if (!isSafeDescendant(notebookRoot, scopeRoot)) {
    throw new Error("scope resolves outside Notebook");
  }
  return scopeRoot;
}

function shouldExcludeEntry(entryName) {
  const name = String(entryName ?? "");
  if (!name) return true;
  if (name.startsWith(".")) return true;
  if (EXCLUDED_SCOPE_DIRS.has(name)) return true;
  return false;
}

async function collectScopeFiles(scopeRoot, currentDir, scope, files) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldExcludeEntry(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;

    const absolutePath = path.resolve(currentDir, entry.name);
    if (!isSafeDescendant(scopeRoot, absolutePath)) continue;

    if (entry.isDirectory()) {
      await collectScopeFiles(scopeRoot, absolutePath, scope, files);
      continue;
    }
    if (!entry.isFile()) continue;

    const relativeFromScope = path.relative(scopeRoot, absolutePath).split(path.sep).join("/");
    if (!relativeFromScope || relativeFromScope.startsWith("..") || relativeFromScope.includes("\\") || relativeFromScope.includes("..")) {
      continue;
    }

    const stat = await fs.stat(absolutePath);
    const sha256 = createHash("sha256").update(await fs.readFile(absolutePath)).digest("hex");
    files.push({
      relativePath: `${scope}/${relativeFromScope}`,
      size: stat.size,
      mtimeMs: Math.trunc(stat.mtimeMs),
      sha256,
    });
  }
}

export function isPathInsideScope({ relativePath, scope }) {
  const validatedScope = validateSyncScope(scope);
  const normalizedRelativePath = normalizeSafeRelativePath(relativePath, "relativePath");
  return normalizedRelativePath === validatedScope || normalizedRelativePath.startsWith(`${validatedScope}/`);
}

function normalizeManifestHashMap(manifest, fieldName) {
  if (!isPlainObject(manifest)) throw new Error(`${fieldName} must be a plain object`);
  const scope = validateSyncScope(manifest.scope);
  if (!Array.isArray(manifest.files)) throw new Error(`${fieldName}.files must be an array`);

  const fileMap = new Map();
  for (let i = 0; i < manifest.files.length; i += 1) {
    const file = manifest.files[i];
    if (!isPlainObject(file)) throw new Error(`${fieldName}.files[${i}] must be a plain object`);
    const relativePath = normalizeNonEmptyString(file.relativePath, `${fieldName}.files[${i}].relativePath`);
    if (!isPathInsideScope({ relativePath, scope })) {
      throw new Error(`${fieldName}.files[${i}].relativePath must stay within scope ${scope}`);
    }
    const sha256 = normalizeNonEmptyString(file.sha256, `${fieldName}.files[${i}].sha256`).toLowerCase();
    fileMap.set(relativePath, sha256);
  }

  return { scope, fileMap };
}

export async function buildScopeManifest({ notebookDir, scope }) {
  const validatedScope = validateSyncScope(scope);
  const notebookRoot = resolveNotebookDir({ notebookDir });
  const scopeRoot = resolveScopeNotebookPath({
    notebookDir: notebookRoot,
    scope: validatedScope,
  });
  const files = [];
  const generatedAt = new Date().toISOString();

  try {
    const stat = await fs.stat(scopeRoot);
    if (!stat.isDirectory()) return { scope: validatedScope, generatedAt, files };
  } catch (err) {
    if (err?.code === "ENOENT") return { scope: validatedScope, generatedAt, files };
    throw err;
  }

  await collectScopeFiles(scopeRoot, scopeRoot, validatedScope, files);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    scope: validatedScope,
    generatedAt,
    files,
  };
}

export async function compareScopeManifests(localManifest, remoteManifest) {
  const local = normalizeManifestHashMap(localManifest, "localManifest");
  const remote = normalizeManifestHashMap(remoteManifest, "remoteManifest");
  if (local.scope !== remote.scope) {
    throw new Error(`Manifest scopes must match (${local.scope} !== ${remote.scope})`);
  }

  const allPaths = [...new Set([...local.fileMap.keys(), ...remote.fileMap.keys()])].sort((a, b) => a.localeCompare(b));
  const onlyLocal = [];
  const onlyRemote = [];
  const changed = [];
  const same = [];

  for (const relativePath of allPaths) {
    const localHash = local.fileMap.get(relativePath);
    const remoteHash = remote.fileMap.get(relativePath);
    if (localHash === undefined) onlyRemote.push(relativePath);
    else if (remoteHash === undefined) onlyLocal.push(relativePath);
    else if (localHash === remoteHash) same.push(relativePath);
    else changed.push(relativePath);
  }

  return { onlyLocal, onlyRemote, changed, same };
}
