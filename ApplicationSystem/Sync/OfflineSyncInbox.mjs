// Nodevision/ApplicationSystem/Sync/OfflineSyncInbox.mjs
// Filesystem-only helpers for Offline Package handoff through a mounted receiver drop folder.

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureDeviceIdentity } from "./DeviceIdentity.mjs";
import { createLocalSyncPackage, inspectLocalSyncPackage, applyLocalSyncPackage } from "./LocalSyncPackageTransport.mjs";
import { validateSyncScope } from "./SyncScopes.mjs";
import { resolveRuntimeRoot } from "./sync-sync-test-two-way.mjs";

export const OFFLINE_SYNC_INBOX_DIRNAME = "OfflineSyncInbox";
export const OFFLINE_SYNC_IMPORTED_DIRNAME = "Imported";
export const OFFLINE_SYNC_INBOX_MARKER_FILENAME = "nodevision-offline-sync-inbox.json";
export const OFFLINE_SYNC_INBOX_MARKER_KIND = "nodevision-offline-sync-inbox";
export const OFFLINE_SYNC_PACKAGE_EXTENSION = ".nodevisionsync.zip";
export const LEGACY_OFFLINE_SYNC_PACKAGE_EXTENSION = ".nodevisionsync";

const ACCEPTED_PACKAGE_SUFFIXES = [
  OFFLINE_SYNC_PACKAGE_EXTENSION,
  LEGACY_OFFLINE_SYNC_PACKAGE_EXTENSION,
];

function normalizeRuntimeRoot(runtimeRoot) {
  return resolveRuntimeRoot({ runtimeRoot });
}

function nowIso() {
  return new Date().toISOString();
}

function safeFilenamePart(value, fallback = "value") {
  const safe = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || fallback;
}

function packageTimestamp(value = null) {
  const date = value && !Number.isNaN(Date.parse(value)) ? new Date(Date.parse(value)) : new Date();
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function isAcceptedPackageFilename(filename) {
  const name = String(filename || "");
  if (!name || name.startsWith(".") || name.endsWith(".tmp")) return false;
  return ACCEPTED_PACKAGE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function assertSafeInboxFilename(filename) {
  const name = String(filename || "").trim();
  if (!isAcceptedPackageFilename(name)) throw new Error("Unsupported offline sync package filename");
  if (name.includes("\0") || name.includes("/") || name.includes("\\") || path.basename(name) !== name) {
    throw new Error("Unsafe offline sync package filename");
  }
  return name;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function getOfflineSyncInboxDir({ runtimeRoot } = {}) {
  return path.join(normalizeRuntimeRoot(runtimeRoot), "UserData", OFFLINE_SYNC_INBOX_DIRNAME);
}

export function getOfflineSyncImportedDir({ runtimeRoot } = {}) {
  return path.join(getOfflineSyncInboxDir({ runtimeRoot }), OFFLINE_SYNC_IMPORTED_DIRNAME);
}

export async function readOfflineSyncInboxMarker(receiverDropPath) {
  const markerPath = path.join(String(receiverDropPath || ""), OFFLINE_SYNC_INBOX_MARKER_FILENAME);
  try {
    const marker = JSON.parse(await fs.readFile(markerPath, "utf8"));
    if (marker?.kind !== OFFLINE_SYNC_INBOX_MARKER_KIND) return null;
    return marker;
  } catch {
    return null;
  }
}

export async function ensureOfflineSyncInbox({ runtimeRoot } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const inboxDir = getOfflineSyncInboxDir({ runtimeRoot: resolvedRuntimeRoot });
  const importedDir = getOfflineSyncImportedDir({ runtimeRoot: resolvedRuntimeRoot });
  await fs.mkdir(inboxDir, { recursive: true });
  await fs.mkdir(importedDir, { recursive: true });

  const markerPath = path.join(inboxDir, OFFLINE_SYNC_INBOX_MARKER_FILENAME);
  let marker = await readOfflineSyncInboxMarker(inboxDir);
  if (!marker) {
    const localDevice = await ensureDeviceIdentity({ runtimeRoot: resolvedRuntimeRoot });
    marker = {
      kind: OFFLINE_SYNC_INBOX_MARKER_KIND,
      deviceId: localDevice.deviceId,
      deviceName: localDevice.deviceName,
      createdAt: nowIso(),
      accepts: ["nodevisionsync.zip", "nodevisionsync"],
    };
    await fs.writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, { flag: "wx" }).catch(async (err) => {
      if (err?.code !== "EEXIST") throw err;
      marker = await readOfflineSyncInboxMarker(inboxDir);
      if (!marker) {
        marker = {
          kind: OFFLINE_SYNC_INBOX_MARKER_KIND,
          deviceId: localDevice.deviceId,
          deviceName: localDevice.deviceName,
          createdAt: nowIso(),
          accepts: ["nodevisionsync.zip", "nodevisionsync"],
        };
        await fs.writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
      }
    });
  }

  return { ok: true, inboxDir, importedDir, marker };
}

async function assertWritableDirectory(directoryPath) {
  const probeName = `.nodevision-write-test-${process.pid}-${Date.now()}-${randomUUID()}.tmp`;
  const probePath = path.join(directoryPath, probeName);
  const handle = await fs.open(probePath, "wx");
  try {
    await handle.writeFile("ok");
    await handle.sync().catch(() => {});
  } finally {
    await handle.close().catch(() => {});
    await fs.unlink(probePath).catch(() => {});
  }
}

export async function validateReceiverDropPath(receiverDropPath) {
  const rawPath = String(receiverDropPath || "").trim();
  if (!rawPath) throw new Error("Receiver drop folder is required.");
  if (rawPath.includes("\0")) throw new Error("Receiver drop folder path is invalid.");
  const resolvedPath = path.resolve(rawPath);
  let stat;
  try {
    stat = await fs.stat(resolvedPath);
  } catch (err) {
    if (err?.code === "ENOENT") throw new Error("Receiver drop folder does not exist.");
    throw err;
  }
  if (!stat.isDirectory()) throw new Error("Receiver drop folder is not a directory.");
  try {
    await fs.access(resolvedPath, fsSync.constants.W_OK);
    await assertWritableDirectory(resolvedPath);
  } catch {
    throw new Error("Receiver drop folder is not writable.");
  }
  const marker = await readOfflineSyncInboxMarker(resolvedPath);
  const warnings = [];
  if (!marker) {
    warnings.push("This folder does not look like a Nodevision Offline Sync Inbox, but it is writable.");
  }
  return {
    ok: true,
    receiverDropPath: resolvedPath,
    writable: true,
    marker,
    warnings,
  };
}

function buildPushedPackageFilename(exported, packageId) {
  const manifest = exported?.manifest || {};
  const timestamp = packageTimestamp(manifest.exportedAt);
  const sourceDeviceId = safeFilenamePart(manifest.sourceDevice?.deviceId, "source-device");
  const scope = safeFilenamePart(manifest.scope, "scope");
  return `${timestamp}.${sourceDeviceId}.${scope}${OFFLINE_SYNC_PACKAGE_EXTENSION}`;
}

async function uniqueFinalPath(directoryPath, filename, packageId) {
  const parsed = path.parse(filename);
  let candidate = path.join(directoryPath, filename);
  if (!(await pathExists(candidate))) return candidate;
  candidate = path.join(directoryPath, `${parsed.name}.${safeFilenamePart(packageId, "package")}${parsed.ext}`);
  if (!(await pathExists(candidate))) return candidate;
  throw new Error("A package with the generated name already exists in the receiver drop folder.");
}

function packageSummaryFromExport(exported, receiverValidation, scope) {
  const manifest = exported?.manifest || {};
  return {
    ok: true,
    scope: manifest.scope || scope,
    sourceDevice: manifest.sourceDevice || null,
    estimatedFileCount: Number(exported?.filesExported || manifest.manifest?.files?.length || 0),
    estimatedByteCount: Number(exported?.bytes || exported?.packageBuffer?.length || 0),
    receiverDropPath: receiverValidation.receiverDropPath,
    writable: receiverValidation.writable === true,
    receiver: receiverValidation.marker ? {
      deviceId: receiverValidation.marker.deviceId || "",
      deviceName: receiverValidation.marker.deviceName || "",
    } : null,
    receiverMarker: receiverValidation.marker || null,
    warnings: receiverValidation.warnings || [],
  };
}

export async function previewOfflinePushPackage({ runtimeRoot, scope, receiverDropPath } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const normalizedScope = validateSyncScope(scope);
  const receiverValidation = await validateReceiverDropPath(receiverDropPath);
  const exported = await createLocalSyncPackage({
    runtimeRoot: resolvedRuntimeRoot,
    scope: normalizedScope,
    syncMode: "offline-package",
  });
  return {
    ...packageSummaryFromExport(exported, receiverValidation, normalizedScope),
    preview: true,
  };
}

async function fsyncDirectory(directoryPath) {
  if (process.platform === "win32") return;
  let handle;
  try {
    handle = await fs.open(directoryPath, "r");
    await handle.sync();
  } catch {
    // Directory fsync is best effort and unsupported on some mounted filesystems.
  } finally {
    await handle?.close?.().catch(() => {});
  }
}

export async function pushOfflinePackageToMountedReceiver({ runtimeRoot, scope, receiverDropPath } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const normalizedScope = validateSyncScope(scope);
  const receiverValidation = await validateReceiverDropPath(receiverDropPath);
  const packageId = randomUUID();
  const exported = await createLocalSyncPackage({
    runtimeRoot: resolvedRuntimeRoot,
    scope: normalizedScope,
    syncMode: "offline-package",
  });
  const finalFilename = buildPushedPackageFilename(exported, packageId);
  const finalPath = await uniqueFinalPath(receiverValidation.receiverDropPath, finalFilename, packageId);
  const tmpFilename = `.incoming.${safeFilenamePart(packageId, "package")}${OFFLINE_SYNC_PACKAGE_EXTENSION}.tmp`;
  const tmpPath = path.join(receiverValidation.receiverDropPath, tmpFilename);

  const handle = await fs.open(tmpPath, "wx");
  try {
    await handle.writeFile(exported.packageBuffer);
    await handle.sync().catch(() => {});
  } catch (err) {
    await handle.close().catch(() => {});
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
  await handle.close();
  await fs.rename(tmpPath, finalPath);
  await fsyncDirectory(receiverValidation.receiverDropPath);

  const sidecar = {
    kind: "nodevision-offline-sync-package-status",
    packageId,
    packageFilename: path.basename(finalPath),
    scope: exported.manifest?.scope || normalizedScope,
    sourceDevice: exported.manifest?.sourceDevice || null,
    exportedAt: exported.manifest?.exportedAt || null,
    writtenAt: nowIso(),
    filesExported: Number(exported.filesExported || 0),
    bytes: Number(exported.bytes || exported.packageBuffer?.length || 0),
    receiver: receiverValidation.marker ? {
      deviceId: receiverValidation.marker.deviceId || "",
      deviceName: receiverValidation.marker.deviceName || "",
    } : null,
  };
  await fs.writeFile(`${finalPath}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);

  return {
    ...packageSummaryFromExport(exported, receiverValidation, normalizedScope),
    preview: false,
    packageId,
    packageFilename: path.basename(finalPath),
    packagePath: finalPath,
    sidecarPath: `${finalPath}.json`,
    message: "Package was written successfully. Open Nodevision on the receiving computer and import it from Offline Sync Inbox.",
  };
}

async function readSidecar(packagePath) {
  try {
    return JSON.parse(await fs.readFile(`${packagePath}.json`, "utf8"));
  } catch {
    return null;
  }
}

function summarizePackageInspection(preview) {
  return {
    sourceDevice: preview?.sourceDevice || null,
    scope: preview?.scope || null,
    targetScope: preview?.targetScope || null,
    trustStatus: preview?.trusted === true ? "trusted" : preview?.signatureVerified === true ? "untrusted" : "unverified",
    signatureVerified: preview?.signatureVerified === true,
    packageValid: preview?.packageValid !== false,
    status: preview?.status || null,
    reason: preview?.reason || null,
  };
}

async function inspectPackageFileForList({ packagePath, runtimeRoot }) {
  try {
    const packageBuffer = await fs.readFile(packagePath);
    const preview = await inspectLocalSyncPackage({ packageBuffer, runtimeRoot });
    return summarizePackageInspection(preview);
  } catch (err) {
    return {
      sourceDevice: null,
      scope: null,
      trustStatus: "invalid",
      signatureVerified: false,
      packageValid: false,
      status: "blocked",
      reason: err?.message || "invalid_package",
    };
  }
}

export async function listOfflineSyncInbox({ runtimeRoot } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const { inboxDir, marker } = await ensureOfflineSyncInbox({ runtimeRoot: resolvedRuntimeRoot });
  const entries = await fs.readdir(inboxDir, { withFileTypes: true }).catch((err) => {
    if (err?.code === "ENOENT") return [];
    throw err;
  });
  const packages = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filename = entry.name;
    if (!isAcceptedPackageFilename(filename)) continue;
    const packagePath = path.join(inboxDir, filename);
    const stat = await fs.stat(packagePath);
    const sidecar = await readSidecar(packagePath);
    const inspected = await inspectPackageFileForList({ packagePath, runtimeRoot: resolvedRuntimeRoot });
    packages.push({
      filename,
      size: stat.size,
      modifiedTime: stat.mtime.toISOString(),
      sourceDevice: inspected.sourceDevice || sidecar?.sourceDevice || null,
      scope: inspected.scope || sidecar?.scope || null,
      targetScope: inspected.targetScope || null,
      trustStatus: inspected.trustStatus || "unknown",
      signatureVerified: inspected.signatureVerified === true,
      packageValid: inspected.packageValid !== false,
      status: inspected.status || null,
      reason: inspected.reason || null,
      importStatus: sidecar?.importedAt ? "imported" : "pending",
      sidecar,
    });
  }
  packages.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
  return { ok: true, inboxDir, marker, packages };
}

export async function resolveOfflineInboxPackagePath({ runtimeRoot, filename } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const safeName = assertSafeInboxFilename(filename);
  const inboxDir = getOfflineSyncInboxDir({ runtimeRoot: resolvedRuntimeRoot });
  const packagePath = path.resolve(inboxDir, safeName);
  const rel = path.relative(inboxDir, packagePath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Offline sync package path escaped inbox.");
  }
  return { inboxDir, packagePath, filename: safeName };
}

export async function previewOfflineInboxPackage({ runtimeRoot, filename, targetScope } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  await ensureOfflineSyncInbox({ runtimeRoot: resolvedRuntimeRoot });
  const resolved = await resolveOfflineInboxPackagePath({ runtimeRoot: resolvedRuntimeRoot, filename });
  const packageBuffer = await fs.readFile(resolved.packagePath);
  const preview = await inspectLocalSyncPackage({
    packageBuffer,
    runtimeRoot: resolvedRuntimeRoot,
    targetScope,
  });
  return {
    ...preview,
    preview: true,
    inboxFilename: resolved.filename,
  };
}

async function uniqueImportedPath(importedDir, filename) {
  const parsed = path.parse(filename);
  let candidate = path.join(importedDir, filename);
  if (!(await pathExists(candidate))) return candidate;
  const suffix = packageTimestamp();
  candidate = path.join(importedDir, `${parsed.name}.imported-${suffix}${parsed.ext}`);
  if (!(await pathExists(candidate))) return candidate;
  throw new Error("Unable to choose a unique Imported package path.");
}

export async function importOfflineInboxPackage({ runtimeRoot, filename, targetScope } = {}) {
  const resolvedRuntimeRoot = normalizeRuntimeRoot(runtimeRoot);
  const { importedDir } = await ensureOfflineSyncInbox({ runtimeRoot: resolvedRuntimeRoot });
  const resolved = await resolveOfflineInboxPackagePath({ runtimeRoot: resolvedRuntimeRoot, filename });
  const packageBuffer = await fs.readFile(resolved.packagePath);
  const imported = await applyLocalSyncPackage({
    packageBuffer,
    runtimeRoot: resolvedRuntimeRoot,
    targetScope,
  });
  if (imported?.ok === false || imported?.status === "blocked" || imported?.status === "failed") {
    return {
      ...imported,
      imported: false,
      inboxFilename: resolved.filename,
    };
  }

  const movedPath = await uniqueImportedPath(importedDir, resolved.filename);
  const sidecarPath = `${resolved.packagePath}.json`;
  const sidecar = await readSidecar(resolved.packagePath);
  await fs.rename(resolved.packagePath, movedPath);
  if (sidecar && await pathExists(sidecarPath)) {
    await fs.rename(sidecarPath, `${movedPath}.json`).catch(() => {});
  }
  const importedAt = nowIso();
  await fs.writeFile(`${movedPath}.imported.json`, `${JSON.stringify({
    kind: "nodevision-offline-sync-import-status",
    packageFilename: path.basename(movedPath),
    originalFilename: resolved.filename,
    importedAt,
    status: imported?.status || "completed",
    scope: imported?.scope || imported?.targetScope || null,
    sourceDevice: imported?.sourceDevice || sidecar?.sourceDevice || null,
  }, null, 2)}\n`);

  return {
    ...imported,
    imported: true,
    inboxFilename: resolved.filename,
    movedTo: movedPath,
    importedAt,
  };
}
