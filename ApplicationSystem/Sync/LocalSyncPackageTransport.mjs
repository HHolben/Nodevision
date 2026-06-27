// Nodevision/ApplicationSystem/Sync/LocalSyncPackageTransport.mjs
// This module implements inspectable offline sync packages for explicit user-controlled file transfer without requiring wireless networking.

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { canonicalizeMessage, ensureDeviceIdentity, signMessage, verifyMessage } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";
import { loadSyncProtection } from "./SyncProtection.mjs";
import { buildScopeManifest, compareScopeManifests, isPathInsideScope, loadSyncScopes, resolveScopeNotebookPath, validateSyncScope } from "./SyncScopes.mjs";
import {
  createSyncResult,
  finalizeSyncResult,
  recordBlocked,
  recordConflict,
  recordCreated,
  recordDeleted,
  recordError,
  recordInvalidPath,
  recordProtectedModeFailure,
  recordSkipped,
  recordTrustFailure,
  recordUpdated,
} from "./SyncResult.mjs";
import { resolveRuntimeRoot } from "./sync-sync-test-two-way.mjs";
import { SyncTransport } from "./SyncTransport.mjs";

export const LOCAL_SYNC_PACKAGE_KIND = "NodevisionSyncPackage";
export const LOCAL_SYNC_PACKAGE_SCHEMA_VERSION = 1;

let jsZipImportPromise = null;

async function loadJSZip() {
  if (!jsZipImportPromise) {
    jsZipImportPromise = import("jszip")
      .then((mod) => mod.default || mod)
      .catch((err) => {
        jsZipImportPromise = null;
        const message = err?.code === "ERR_MODULE_NOT_FOUND"
          ? "Offline package sync requires the jszip package. Run npm install in ApplicationSystem or install dependencies for this project."
          : (err?.message || "Failed to load jszip");
        throw new Error(message);
      });
  }
  return jsZipImportPromise;
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeRuntimeRoot(runtimeRoot) {
  return resolveRuntimeRoot({ runtimeRoot });
}

function normalizeNotebookDir(runtimeRoot, notebookDir) {
  return path.resolve(notebookDir || path.join(runtimeRoot, "Notebook"));
}

function rejectEncodedTraversal(text, fieldName) {
  const raw = String(text || "");
  if (!/%(?:00|2e|2f|5c)/i.test(raw)) return;
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new Error(fieldName + " contains invalid URL encoding");
  }
  if (decoded.includes("\0") || decoded.includes("\\")) {
    throw new Error(fieldName + " contains encoded unsafe path characters");
  }
  if (path.posix.isAbsolute(decoded) || path.win32.isAbsolute(decoded)) {
    throw new Error(fieldName + " contains encoded absolute path syntax");
  }
  const normalized = path.posix.normalize(decoded);
  if (normalized !== decoded || normalized === "." || normalized.split("/").includes("..")) {
    throw new Error(fieldName + " contains encoded path traversal");
  }
}

function rejectUnsafeTextPath(value, fieldName) {
  const text = String(value ?? "").trim();
  rejectEncodedTraversal(text, fieldName);
  if (!text) throw new Error(`${fieldName} must be a nonempty relative path`);
  if (text.includes("\0")) throw new Error(`${fieldName} must not contain null bytes`);
  if (text.includes("\\")) throw new Error(`${fieldName} must not contain backslashes`);
  if (path.posix.isAbsolute(text) || path.win32.isAbsolute(text)) {
    throw new Error(`${fieldName} must be relative`);
  }
  const normalized = path.posix.normalize(text);
  if (normalized !== text || normalized === "." || normalized.split("/").includes("..")) {
    throw new Error(`${fieldName} must be normalized and traversal-safe`);
  }
  return normalized;
}

export function normalizePackageRelativePath(relativePath, scope) {
  const normalizedScope = validateSyncScope(scope);
  const normalizedPath = rejectUnsafeTextPath(relativePath, "relativePath");
  if (normalizedPath === normalizedScope) {
    throw new Error("relativePath must point to a file inside the scope");
  }
  if (!isPathInsideScope({ relativePath: normalizedPath, scope: normalizedScope })) {
    throw new Error(`relativePath must stay within scope ${normalizedScope}`);
  }
  return normalizedPath;
}

function normalizePackageEntryName(name) {
  const normalized = rejectUnsafeTextPath(name, "package entry");
  if (normalized.endsWith("/")) throw new Error("package entry must not end with /");
  return normalized;
}

function zipFilePathForRelativePath(relativePath, scope) {
  return `files/${normalizePackageRelativePath(relativePath, scope)}`;
}

function normalizePackageFileEntry(file, index, scope) {
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    throw new Error(`manifest.files[${index}] must be an object`);
  }
  const relativePath = normalizePackageRelativePath(file.relativePath, scope);
  const size = Number(file.size ?? 0);
  const mtimeMs = Number(file.mtimeMs ?? 0);
  if (!Number.isFinite(size) || size < 0) throw new Error(`manifest.files[${index}].size must be nonnegative`);
  if (!Number.isFinite(mtimeMs) || mtimeMs < 0) throw new Error(`manifest.files[${index}].mtimeMs must be nonnegative`);
  const sha256 = String(file.sha256 || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("manifest.files[" + index + "].sha256 must be a SHA-256 hex digest");
  const baseShaValue = file.baseSha256 === null || file.baseSha256 === undefined ? "" : String(file.baseSha256).trim().toLowerCase();
  const baseSha256 = baseShaValue ? baseShaValue : null;
  if (baseSha256 && !/^[a-f0-9]{64}$/.test(baseSha256)) throw new Error("manifest.files[" + index + "].baseSha256 must be a SHA-256 hex digest");
  return {
    relativePath,
    size: Math.trunc(size),
    mtimeMs: Math.trunc(mtimeMs),
    sha256,
    baseSha256,
    transferMode: String(file.transferMode || "package"),
    tooLargeForJson: Boolean(file.tooLargeForJson),
  };
}

function normalizePackageManifest(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("sync-manifest.json must contain an object");
  }
  if (raw.kind !== LOCAL_SYNC_PACKAGE_KIND) throw new Error("Unsupported sync package kind");
  if (Number(raw.schemaVersion) !== LOCAL_SYNC_PACKAGE_SCHEMA_VERSION) throw new Error("Unsupported sync package schemaVersion");
  const scope = validateSyncScope(raw.scope || raw.manifest?.scope);
  const files = Array.isArray(raw.manifest?.files) ? raw.manifest.files : [];
  const normalizedFiles = files.map((file, index) => normalizePackageFileEntry(file, index, scope));
  const sourceDevice = raw.sourceDevice && typeof raw.sourceDevice === "object" && !Array.isArray(raw.sourceDevice)
    ? raw.sourceDevice
    : {};
  const deviceId = String(sourceDevice.deviceId || "").trim();
  const deviceName = String(sourceDevice.deviceName || "").trim();
  const publicKey = String(sourceDevice.publicKey || "").trim();
  if (!deviceId || !deviceName) throw new Error("Package sourceDevice must include deviceId and deviceName");
  const exportedAt = String(raw.exportedAt || "").trim();
  if (!exportedAt || Number.isNaN(Date.parse(exportedAt))) throw new Error("Package exportedAt must be an ISO timestamp");
  return {
    schemaVersion: LOCAL_SYNC_PACKAGE_SCHEMA_VERSION,
    kind: LOCAL_SYNC_PACKAGE_KIND,
    sourceDevice: {
      deviceId,
      deviceName,
      publicKey,
    },
    scope,
    exportedAt: new Date(Date.parse(exportedAt)).toISOString(),
    syncMode: String(raw.syncMode || "offline-package"),
    manifest: {
      scope,
      generatedAt: String(raw.manifest?.generatedAt || exportedAt),
      files: normalizedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    },
    tombstones: Array.isArray(raw.tombstones) ? raw.tombstones : [],
  };
}

function validateZipEntryNames(zip) {
  for (const file of Object.values(zip.files || {})) {
    const names = [file?.name, file?.unsafeOriginalName]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    for (const name of names) {
      const cleanName = name.endsWith("/") ? name.slice(0, -1) : name;
      normalizePackageEntryName(cleanName);
    }
  }
}

function fileSuffixWithinScope(relativePath, scope) {
  const normalized = normalizePackageRelativePath(relativePath, scope);
  return normalized.slice(`${scope}/`.length);
}

function resolveTargetPath({ notebookDir, scope, relativePath }) {
  const scopeRoot = resolveScopeNotebookPath({ notebookDir, scope });
  const suffix = fileSuffixWithinScope(relativePath, scope);
  const target = path.resolve(scopeRoot, suffix);
  const rel = path.relative(scopeRoot, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Package path escaped scope");
  return { scopeRoot, target };
}

async function assertNoSymlinkParents(scopeRoot, target) {
  const parent = path.dirname(target);
  const relativeParent = path.relative(scopeRoot, parent);
  if (!relativeParent) return;
  if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent)) throw new Error("Package path escaped scope");
  let current = scopeRoot;
  for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error(`Refusing to write through symlink directory: ${segment}`);
      if (!stat.isDirectory()) throw new Error(`Package parent path is not a directory: ${segment}`);
    } catch (err) {
      if (err?.code === "ENOENT") return;
      throw err;
    }
  }
}

async function assertWritableNonSymlinkTarget(scopeRoot, target) {
  await assertNoSymlinkParents(scopeRoot, target);
  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) throw new Error("Refusing to overwrite a symlink");
    if (!stat.isFile()) throw new Error("Refusing to overwrite a non-file path");
  } catch (err) {
    if (err?.code === "ENOENT") return;
    throw err;
  }
}

async function readPackageZip(packageBuffer) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(packageBuffer);
  validateZipEntryNames(zip);
  const manifestEntry = zip.file("sync-manifest.json");
  if (!manifestEntry) throw new Error("Sync package is missing sync-manifest.json");
  const rawManifest = JSON.parse(await manifestEntry.async("string"));
  const manifest = normalizePackageManifest(rawManifest);
  for (const file of manifest.manifest.files) {
    const zipPath = zipFilePathForRelativePath(file.relativePath, manifest.scope);
    if (!zip.file(zipPath)) throw new Error(`Sync package is missing ${zipPath}`);
  }
  return { zip, manifest };
}

async function readAndVerifyPackageFile(zip, manifest, fileEntry) {
  const zipPath = zipFilePathForRelativePath(fileEntry.relativePath, manifest.scope);
  const zipEntry = zip.file(zipPath);
  if (!zipEntry) throw new Error(`Sync package is missing ${zipPath}`);
  const buffer = await zipEntry.async("nodebuffer");
  if (buffer.length !== fileEntry.size) throw new Error(`Size mismatch for ${fileEntry.relativePath}`);
  const sha256 = hashBuffer(buffer);
  if (sha256 !== fileEntry.sha256) throw new Error(`SHA-256 mismatch for ${fileEntry.relativePath}`);
  return buffer;
}

async function verifyPackageTrust(manifest, zip, runtimeRoot) {
  const signatureEntry = zip.file("signatures/manifest.sig");
  let signatureValid = false;
  let signatureError = "";
  if (signatureEntry && manifest.sourceDevice.publicKey) {
    try {
      const signatureRecord = JSON.parse(await signatureEntry.async("string"));
      const payloadMatchesManifest = String(signatureRecord?.payload || "") === canonicalizeMessage(manifest);
      signatureValid = payloadMatchesManifest
        && await verifyMessage(signatureRecord.payload, signatureRecord.signatureBase64, manifest.sourceDevice.publicKey);
      if (!signatureValid) signatureError = payloadMatchesManifest ? "Signature verification failed" : "Signature payload does not match manifest";
    } catch (err) {
      signatureError = err?.message || "Signature verification failed";
    }
  } else {
    signatureError = "Package does not contain a verifiable manifest signature";
  }

  const trustedPeer = await findTrustedPeer(manifest.sourceDevice.deviceId, { runtimeRoot }).catch(() => null);
  const localPeer = await ensureDeviceIdentity({ runtimeRoot }).catch(() => null);
  const sourcePublicKey = String(manifest.sourceDevice.publicKey || "").trim();
  const sourceMatchesTrustedPeer = Boolean(
    trustedPeer
    && String(trustedPeer.publicKey || "").trim()
    && String(trustedPeer.publicKey || "").trim() === sourcePublicKey,
  );
  const sourceMatchesLocalPeer = Boolean(
    localPeer
    && String(localPeer.deviceId || "").trim() === manifest.sourceDevice.deviceId
    && String(localPeer.publicKey || "").trim() === sourcePublicKey,
  );
  const trusted = Boolean(signatureValid && (sourceMatchesTrustedPeer || sourceMatchesLocalPeer));
  return {
    signatureValid,
    trusted,
    trustedPeer: trustedPeer ? {
      deviceId: trustedPeer.deviceId,
      deviceName: trustedPeer.deviceName,
      status: trustedPeer.status,
    } : sourceMatchesLocalPeer ? {
      deviceId: manifest.sourceDevice.deviceId,
      deviceName: manifest.sourceDevice.deviceName,
      status: "local",
    } : null,
    warning: trusted ? "" : (signatureError || "Package source is not in TrustedPeers"),
  };
}


function toManifestEntryMap(manifest) {
  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  return new Map(files.map((entry) => [String(entry?.relativePath || ""), entry]));
}

function toPackageFileRecord(relativePath, entry = {}, extra = {}) {
  return {
    relativePath,
    bytes: Number.isFinite(Number(entry.size)) ? Math.max(0, Math.trunc(Number(entry.size))) : 0,
    size: Number.isFinite(Number(entry.size)) ? Math.max(0, Math.trunc(Number(entry.size))) : 0,
    sha256: String(entry.sha256 || ""),
    baseSha256: entry.baseSha256 || null,
    mtimeMs: Number.isFinite(Number(entry.mtimeMs)) ? Math.max(0, Math.trunc(Number(entry.mtimeMs))) : 0,
    ...extra,
  };
}

function localEntryMatchesPackageBase(localEntry, packageEntry) {
  const baseSha = String(packageEntry?.baseSha256 || "").trim().toLowerCase();
  const localSha = String(localEntry?.sha256 || "").trim().toLowerCase();
  return Boolean(baseSha && localSha && baseSha === localSha);
}

async function resolvePackageTargetState({ manifest, targetScope, runtimeRoot }) {
  const requestedTargetScope = targetScope ? validateSyncScope(targetScope) : manifest.scope;
  const loaded = await loadSyncScopes({ runtimeRoot });
  const enabledScopes = Array.isArray(loaded.syncScopes) ? loaded.syncScopes : [];
  const packageScopeEnabled = enabledScopes.includes(manifest.scope);
  const targetScopeEnabled = enabledScopes.includes(requestedTargetScope);
  const scopeMatchesPackage = requestedTargetScope === manifest.scope;
  return {
    targetScope: requestedTargetScope,
    packageScope: manifest.scope,
    packageScopeEnabled,
    targetScopeEnabled,
    scopeMatchesPackage,
    ok: packageScopeEnabled && targetScopeEnabled && scopeMatchesPackage,
  };
}

function createPackageSyncResult({ manifest = null, trust = null, protection = null, targetState = null, preview = false, imported = false, packageValid = true, reason = "" } = {}) {
  const sourceDevice = manifest?.sourceDevice || null;
  const signatureVerified = trust?.signatureValid === true;
  const trustedPeerFound = Boolean(trust?.trustedPeer);
  const result = createSyncResult({
    kind: "offline-package",
    operation: preview ? "package-preview" : "package-import",
    scope: manifest?.scope || targetState?.packageScope || "",
    targetScope: targetState?.targetScope || manifest?.scope || "",
    sourceDevice,
    preview,
    dryRun: preview,
    packageValid,
    protectedMode: {
      enabled: protection?.protectedFromPeerWrites === true,
      blocked: false,
    },
    trustedPeerFound,
    signatureVerified,
    status: preview ? "preview" : "running",
    reason,
  });
  result.imported = Boolean(imported);
  result.exportedAt = manifest?.exportedAt || null;
  result.syncMode = manifest?.syncMode || "offline-package";
  result.manifest = manifest || null;
  result.trusted = trust?.trusted === true;
  result.trustedPeer = trust?.trustedPeer || null;
  result.trustWarning = trust?.warning || "";
  result.signatureStatus = signatureVerified ? "verified" : "invalid";
  result.signatureValid = signatureVerified;
  result.packageValidity = { valid: Boolean(packageValid) };
  result.target = targetState || null;
  result.scopeEnabled = targetState ? targetState.packageScopeEnabled === true : true;
  return result;
}

function applyPackageResultAliases(result, plan = null) {
  result.counts.wouldCreate = result.created.length;
  result.counts.wouldUpdate = result.updated.length;
  result.counts.wouldSaveConflicts = result.conflicts.length;
  result.counts.wouldKeepLocal = result.skipped.filter((entry) => entry.reason === "local_only").length;
  result.counts.same = result.skipped.filter((entry) => entry.reason === "same").length;
  result.counts.wouldDelete = result.deleted.length;
  result.operations.wouldCreate = result.created.map((entry) => entry.relativePath);
  result.operations.wouldUpdate = result.updated.map((entry) => entry.relativePath);
  result.operations.wouldSaveConflicts = result.conflicts.map((entry) => entry.originalRelativePath || entry.relativePath);
  result.operations.wouldKeepLocal = result.skipped.filter((entry) => entry.reason === "local_only").map((entry) => entry.relativePath);
  result.operations.same = result.skipped.filter((entry) => entry.reason === "same").map((entry) => entry.relativePath);
  result.operations.wouldDelete = result.deleted.map((entry) => entry.relativePath);
  if (plan) result.plan = plan.rawPlan || plan;
  return result;
}

async function buildPackageOperationPlan({ localManifest, manifest }) {
  const rawPlan = await compareScopeManifests(localManifest, manifest.manifest);
  const localEntries = toManifestEntryMap(localManifest);
  const packageEntries = toManifestEntryMap(manifest.manifest);
  const created = rawPlan.onlyRemote.map((relativePath) => toPackageFileRecord(relativePath, packageEntries.get(relativePath), { reason: "missing_local" }));
  const updated = [];
  const conflicts = [];
  for (const relativePath of rawPlan.changed) {
    const localEntry = localEntries.get(relativePath);
    const packageEntry = packageEntries.get(relativePath);
    if (localEntryMatchesPackageBase(localEntry, packageEntry)) {
      updated.push(toPackageFileRecord(relativePath, packageEntry, { reason: "base_hash_matches" }));
    } else {
      conflicts.push(toPackageFileRecord(relativePath, packageEntry, {
        originalRelativePath: relativePath,
        reason: packageEntry?.baseSha256 ? "local_diverged_from_base" : "missing_base_hash",
        localSha256: localEntry?.sha256 || null,
      }));
    }
  }
  const skipped = [
    ...rawPlan.same.map((relativePath) => toPackageFileRecord(relativePath, packageEntries.get(relativePath), { reason: "same" })),
    ...rawPlan.onlyLocal.map((relativePath) => toPackageFileRecord(relativePath, localEntries.get(relativePath), { reason: "local_only" })),
  ];
  return { rawPlan, created, updated, conflicts, skipped, deleted: [] };
}

function recordPackagePlan(result, plan) {
  for (const entry of plan.created) recordCreated(result, { ...entry, operation: "create" });
  for (const entry of plan.updated) recordUpdated(result, { ...entry, operation: "update" });
  for (const entry of plan.conflicts) recordConflict(result, { ...entry, operation: "conflict" });
  for (const entry of plan.skipped) recordSkipped(result, { ...entry, operation: "skip" });
  for (const entry of plan.deleted) recordDeleted(result, { ...entry, operation: "delete" });
  return applyPackageResultAliases(result, plan);
}

function recordPackageValidationError(result, err) {
  const message = err?.message || String(err || "Invalid sync package");
  if (/path|relativePath|entry|traversal|absolute|null bytes|backslashes|encoding/i.test(message)) {
    recordInvalidPath(result, { error: message, reason: "invalid_path" });
    recordError(result, message);
  } else {
    recordError(result, message, { blocked: true, reason: "invalid_package" });
  }
  result.packageValidity = { valid: false, error: message };
  result.packageValid = false;
  result.reason = result.reason || "invalid_package";
  return result;
}

async function verifyAllPackageFileBuffers(zip, manifest) {
  const buffers = new Map();
  for (const entry of manifest.manifest.files) {
    buffers.set(entry.relativePath, await readAndVerifyPackageFile(zip, manifest, entry));
  }
  return buffers;
}

export class LocalSyncPackageTransport extends SyncTransport {
  constructor({ runtimeRoot, notebookDir } = {}) {
    super({ kind: "offline-package" });
    this.runtimeRoot = runtimeRoot;
    this.notebookDir = notebookDir;
  }

  async status() {
    return { ok: true, transport: this.kind, offline: true };
  }

  async listFiles(scope) {
    const resolvedRuntimeRoot = normalizeRuntimeRoot(this.runtimeRoot);
    const resolvedNotebookDir = normalizeNotebookDir(resolvedRuntimeRoot, this.notebookDir);
    return buildScopeManifest({ notebookDir: resolvedNotebookDir, scope });
  }

  async exportPackage({ scope, syncMode = "offline-package" } = {}) {
    return createLocalSyncPackage({ runtimeRoot: this.runtimeRoot, notebookDir: this.notebookDir, scope, syncMode });
  }

  async previewPackage(packageBuffer, options = {}) {
    return inspectLocalSyncPackage({ packageBuffer, runtimeRoot: this.runtimeRoot, notebookDir: this.notebookDir, ...options });
  }

  async importPackage(packageBuffer, options = {}) {
    return applyLocalSyncPackage({ packageBuffer, runtimeRoot: this.runtimeRoot, notebookDir: this.notebookDir, ...options });
  }
}

export async function createLocalSyncPackage({ runtimeRoot, notebookDir, scope, syncMode = "offline-package" } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const resolvedNotebookDir = normalizeNotebookDir(resolvedRuntimeRoot, notebookDir);
  const normalizedScope = validateSyncScope(scope);
  const scopeRoot = resolveScopeNotebookPath({ notebookDir: resolvedNotebookDir, scope: normalizedScope });
  const localDevice = await ensureDeviceIdentity({ runtimeRoot: resolvedRuntimeRoot });
  const sourceManifest = await buildScopeManifest({ notebookDir: resolvedNotebookDir, scope: normalizedScope });
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const files = [];

  for (const entry of sourceManifest.files) {
    const relativePath = normalizePackageRelativePath(entry.relativePath, normalizedScope);
    const { target } = resolveTargetPath({ notebookDir: resolvedNotebookDir, scope: normalizedScope, relativePath });
    const rel = path.relative(scopeRoot, target);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Package export path escaped scope");
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) continue;
    if (!stat.isFile()) continue;
    const buffer = await fs.readFile(target);
    const fileEntry = {
      ...entry,
      relativePath,
      size: buffer.length,
      mtimeMs: Math.trunc(stat.mtimeMs),
      sha256: hashBuffer(buffer),
      transferMode: entry.transferMode || "package",
      tooLargeForJson: Boolean(entry.tooLargeForJson),
    };
    files.push(fileEntry);
    zip.file(zipFilePathForRelativePath(relativePath, normalizedScope), buffer);
  }

  const exportedAt = new Date().toISOString();
  const packageManifest = normalizePackageManifest({
    schemaVersion: LOCAL_SYNC_PACKAGE_SCHEMA_VERSION,
    kind: LOCAL_SYNC_PACKAGE_KIND,
    sourceDevice: {
      deviceId: localDevice.deviceId,
      deviceName: localDevice.deviceName,
      publicKey: localDevice.publicKey,
    },
    scope: normalizedScope,
    exportedAt,
    syncMode,
    manifest: {
      scope: normalizedScope,
      generatedAt: sourceManifest.generatedAt || exportedAt,
      files,
    },
    tombstones: [],
  });
  const signature = await signMessage(packageManifest, { runtimeRoot: resolvedRuntimeRoot });
  zip.file("sync-manifest.json", `${JSON.stringify(packageManifest, null, 2)}\n`);
  zip.file("tombstones/deleted-files.json", `${JSON.stringify({ deleted: [] }, null, 2)}\n`);
  zip.file("signatures/manifest.sig", `${JSON.stringify(signature, null, 2)}\n`);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return {
    ok: true,
    packageBuffer: buffer,
    filename: `${normalizedScope.split("/").pop() || "notebook"}.nodevisionsync`,
    manifest: packageManifest,
    filesExported: packageManifest.manifest.files.length,
    bytes: buffer.length,
  };
}

export async function inspectLocalSyncPackage({ packageBuffer, runtimeRoot, notebookDir, targetScope } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const resolvedNotebookDir = normalizeNotebookDir(resolvedRuntimeRoot, notebookDir);
  const protection = await loadSyncProtection({ runtimeRoot: resolvedRuntimeRoot }).catch(() => ({ protectedFromPeerWrites: false }));
  let zip;
  let manifest;
  try {
    ({ zip, manifest } = await readPackageZip(packageBuffer));
  } catch (err) {
    const result = createPackageSyncResult({ protection, preview: true, packageValid: false, reason: "invalid_package" });
    recordPackageValidationError(result, err);
    applyPackageResultAliases(result);
    return finalizeSyncResult(result, "blocked");
  }

  const trust = await verifyPackageTrust(manifest, zip, resolvedRuntimeRoot);
  let targetState;
  try {
    targetState = await resolvePackageTargetState({ manifest, targetScope, runtimeRoot: resolvedRuntimeRoot });
  } catch (err) {
    const result = createPackageSyncResult({ manifest, trust, protection, preview: true, packageValid: true, reason: "invalid_target_scope" });
    recordBlocked(result, { operation: "scope", reason: "invalid_target_scope", error: err?.message || "Invalid target scope" });
    applyPackageResultAliases(result);
    return finalizeSyncResult(result, "blocked");
  }

  const result = createPackageSyncResult({ manifest, trust, protection, targetState, preview: true, packageValid: true });
  result.counts.filesInPackage = manifest.manifest.files.length;

  if (!targetState.ok) {
    const reason = targetState.scopeMatchesPackage ? "scope_not_enabled" : "target_scope_mismatch";
    result.reason = reason;
    recordBlocked(result, { operation: "scope", reason, packageScope: manifest.scope, targetScope: targetState.targetScope, error: targetState.scopeMatchesPackage ? "Package scope is not enabled" : "Package targets a different scope" });
  }
  if (!trust.signatureValid) {
    result.reason = result.reason || "invalid_signature";
    recordBlocked(result, { operation: "signature", reason: "invalid_signature", error: trust.warning || "Package signature could not be verified" });
  } else if (!trust.trusted) {
    recordTrustFailure(result, { reason: "untrusted_peer", error: trust.warning || "Package is signed but not from a trusted peer", sourceDevice: manifest.sourceDevice });
  }
  if (protection?.protectedFromPeerWrites === true) {
    recordProtectedModeFailure(result, { error: "Protected mode prevents importing this package." });
  }

  if (targetState.ok) {
    const localManifest = await buildScopeManifest({ notebookDir: resolvedNotebookDir, scope: manifest.scope });
    const plan = await buildPackageOperationPlan({ localManifest, manifest });
    recordPackagePlan(result, plan);
  } else {
    applyPackageResultAliases(result);
  }

  return finalizeSyncResult(result, result.blocked.length ? "blocked" : "preview");
}

function buildConflictRelativePath(originalRelativePath, scope, sourceDeviceId, timestamp) {
  const suffix = fileSuffixWithinScope(originalRelativePath, scope);
  const parsed = path.posix.parse(suffix);
  const safeTs = new Date(Date.parse(timestamp)).toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safePeer = String(sourceDeviceId || "package").replace(/[^A-Za-z0-9_-]+/g, "-");
  const name = parsed.ext ? `${parsed.name}.from-${safePeer}.${safeTs}${parsed.ext}` : `${parsed.base}.from-${safePeer}.${safeTs}`;
  const dir = parsed.dir ? `${parsed.dir}/` : "";
  return `${scope}/.conflicts/${dir}${name}`;
}

async function writePackageBuffer({ notebookDir, scope, relativePath, buffer, mtimeMs }) {
  const { scopeRoot, target } = resolveTargetPath({ notebookDir, scope, relativePath });
  await assertWritableNonSymlinkTarget(scopeRoot, target);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  if (Number.isFinite(Number(mtimeMs)) && Number(mtimeMs) > 0) {
    const mtime = new Date(Number(mtimeMs));
    await fs.utimes(target, mtime, mtime).catch(() => {});
  }
  return target;
}

export async function applyLocalSyncPackage({
  packageBuffer,
  runtimeRoot,
  notebookDir,
  targetScope,
  allowUntrusted = false,
  allowProtectedImport = false,
} = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const resolvedNotebookDir = normalizeNotebookDir(resolvedRuntimeRoot, notebookDir);
  const protection = await loadSyncProtection({ runtimeRoot: resolvedRuntimeRoot }).catch(() => ({ protectedFromPeerWrites: false }));
  let zip;
  let manifest;
  try {
    ({ zip, manifest } = await readPackageZip(packageBuffer));
  } catch (err) {
    const result = createPackageSyncResult({ protection, imported: false, packageValid: false, reason: "invalid_package" });
    recordPackageValidationError(result, err);
    applyPackageResultAliases(result);
    return finalizeSyncResult(result, "blocked");
  }

  const trust = await verifyPackageTrust(manifest, zip, resolvedRuntimeRoot);
  let targetState;
  try {
    targetState = await resolvePackageTargetState({ manifest, targetScope, runtimeRoot: resolvedRuntimeRoot });
  } catch (err) {
    const result = createPackageSyncResult({ manifest, trust, protection, imported: false, packageValid: true, reason: "invalid_target_scope" });
    recordBlocked(result, { operation: "scope", reason: "invalid_target_scope", error: err?.message || "Invalid target scope" });
    applyPackageResultAliases(result);
    return finalizeSyncResult(result, "blocked");
  }

  const result = createPackageSyncResult({ manifest, trust, protection, targetState, imported: false, packageValid: true });
  result.counts.filesInPackage = manifest.manifest.files.length;
  result.importedAt = new Date().toISOString();

  if (!targetState.ok) {
    const reason = targetState.scopeMatchesPackage ? "scope_not_enabled" : "target_scope_mismatch";
    result.reason = reason;
    recordBlocked(result, { operation: "scope", reason, packageScope: manifest.scope, targetScope: targetState.targetScope, error: targetState.scopeMatchesPackage ? "Package scope is not enabled" : "Package targets a different scope" });
    applyPackageResultAliases(result);
    return finalizeSyncResult(result, "blocked");
  }
  if (!trust.signatureValid) {
    result.reason = "invalid_signature";
    recordBlocked(result, { operation: "signature", reason: "invalid_signature", error: trust.warning || "Package signature could not be verified" });
    applyPackageResultAliases(result);
    return finalizeSyncResult(result, "blocked");
  }
  if (!trust.trusted) {
    recordTrustFailure(result, { reason: "untrusted_peer", error: trust.warning || "Package is signed but not from a trusted peer", sourceDevice: manifest.sourceDevice });
    applyPackageResultAliases(result);
    return finalizeSyncResult(result, "blocked");
  }
  if (protection?.protectedFromPeerWrites === true && allowProtectedImport !== true) {
    recordProtectedModeFailure(result, { error: "Protected mode prevents importing this package." });
    applyPackageResultAliases(result);
    return finalizeSyncResult(result, "blocked");
  }

  const localManifest = await buildScopeManifest({ notebookDir: resolvedNotebookDir, scope: manifest.scope });
  const plan = await buildPackageOperationPlan({ localManifest, manifest });
  let packageBuffers;
  try {
    packageBuffers = await verifyAllPackageFileBuffers(zip, manifest);
  } catch (err) {
    recordError(result, err, { blocked: true, reason: "package_file_integrity" });
    applyPackageResultAliases(result, plan);
    return finalizeSyncResult(result, "blocked");
  }

  for (const entry of plan.created) {
    try {
      const buffer = packageBuffers.get(entry.relativePath);
      await writePackageBuffer({
        notebookDir: resolvedNotebookDir,
        scope: manifest.scope,
        relativePath: entry.relativePath,
        buffer,
        mtimeMs: entry.mtimeMs,
      });
      recordCreated(result, { ...entry, bytes: buffer.length, operation: "create" });
    } catch (err) {
      recordError(result, err, { blocked: true, operation: "create", relativePath: entry.relativePath, reason: "write_failed" });
    }
  }

  for (const entry of plan.updated) {
    try {
      const buffer = packageBuffers.get(entry.relativePath);
      await writePackageBuffer({
        notebookDir: resolvedNotebookDir,
        scope: manifest.scope,
        relativePath: entry.relativePath,
        buffer,
        mtimeMs: entry.mtimeMs,
      });
      recordUpdated(result, { ...entry, bytes: buffer.length, operation: "update" });
    } catch (err) {
      recordError(result, err, { blocked: true, operation: "update", relativePath: entry.relativePath, reason: "write_failed" });
    }
  }

  for (const entry of plan.conflicts) {
    try {
      const buffer = packageBuffers.get(entry.originalRelativePath || entry.relativePath);
      const conflictRelativePath = buildConflictRelativePath(entry.originalRelativePath || entry.relativePath, manifest.scope, manifest.sourceDevice.deviceId, result.importedAt);
      await writePackageBuffer({
        notebookDir: resolvedNotebookDir,
        scope: manifest.scope,
        relativePath: conflictRelativePath,
        buffer,
        mtimeMs: entry.mtimeMs,
      });
      recordConflict(result, {
        ...entry,
        operation: "conflict",
        originalRelativePath: entry.originalRelativePath || entry.relativePath,
        conflictRelativePath,
        savedRelativePath: conflictRelativePath,
        bytes: buffer.length,
      });
    } catch (err) {
      recordError(result, err, { blocked: true, operation: "conflict", relativePath: entry.originalRelativePath || entry.relativePath, reason: "conflict_write_failed" });
    }
  }

  for (const entry of plan.skipped) {
    recordSkipped(result, { ...entry, operation: "skip" });
  }

  applyPackageResultAliases(result, plan);
  const finalized = finalizeSyncResult(result);
  finalized.imported = finalized.ok !== false;
  return finalized;
}
