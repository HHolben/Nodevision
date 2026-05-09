// Nodevision/ApplicationSystem/Sync/SyncManifest.mjs
// This module builds and compares SyncTest-only manifests and verifies signed manifest requests so trusted peers can safely exchange hash inventories without scanning outside Notebook/SyncTest.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { ensureDeviceIdentity, signMessage, verifyMessage } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";

const MANIFEST_REQUEST_TYPE = "nodevision.peer.manifestRequest";
const MANIFEST_REQUEST_VERSION = 1;
const MANIFEST_SCOPE = "SyncTest";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeNonEmptyString(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${fieldName} must be a nonempty string`);
  return normalized;
}

function requireNonBlankString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${fieldName} must be a nonempty string`);
  return value;
}

function normalizeTimestamp(value) {
  const timestamp = normalizeNonEmptyString(value, "timestamp");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error("timestamp must be a valid ISO date string");
  }
  return timestamp;
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

function isSafeDescendant(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isSafeManifestPath(relativePath) {
  if (path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) || relativePath.includes("\\")) return false;
  const normalized = path.posix.normalize(relativePath);
  return normalized === relativePath && normalized.startsWith(`${MANIFEST_SCOPE}/`) && !normalized.includes("..");
}

async function collectSyncTestFiles(syncTestRoot, currentDir, files) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (String(entry.name || "").startsWith(".")) continue;
    if (entry.isSymbolicLink()) continue;
    const absolutePath = path.resolve(currentDir, entry.name);
    if (!isSafeDescendant(syncTestRoot, absolutePath)) continue;

    if (entry.isDirectory()) {
      await collectSyncTestFiles(syncTestRoot, absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const relativeFromRoot = path.relative(syncTestRoot, absolutePath).split(path.sep).join("/");
    if (!relativeFromRoot || relativeFromRoot.startsWith("..")) continue;

    const stat = await fs.stat(absolutePath);
    const sha256 = createHash("sha256").update(await fs.readFile(absolutePath)).digest("hex");
    files.push({ relativePath: `${MANIFEST_SCOPE}/${relativeFromRoot}`, size: stat.size, mtimeMs: Math.trunc(stat.mtimeMs), sha256 });
  }
}

function normalizeManifestHashMap(manifest, fieldName) {
  if (!isPlainObject(manifest)) throw new Error(`${fieldName} must be a plain object`);
  if (!Array.isArray(manifest.files)) throw new Error(`${fieldName}.files must be an array`);

  const fileMap = new Map();
  for (let i = 0; i < manifest.files.length; i += 1) {
    const file = manifest.files[i];
    if (!isPlainObject(file)) throw new Error(`${fieldName}.files[${i}] must be a plain object`);
    const relativePath = normalizeNonEmptyString(file.relativePath, `${fieldName}.files[${i}].relativePath`);
    if (!isSafeManifestPath(relativePath)) throw new Error(`${fieldName}.files[${i}].relativePath must stay within ${MANIFEST_SCOPE}/`);
    const sha256 = normalizeNonEmptyString(file.sha256, `${fieldName}.files[${i}].sha256`).toLowerCase();
    fileMap.set(relativePath, sha256);
  }
  return fileMap;
}

export async function buildSyncTestManifest(options = {}) {
  const generatedAt = new Date().toISOString();
  const syncTestRoot = path.resolve(resolveNotebookDir(options), MANIFEST_SCOPE);
  const files = [];

  try {
    const stat = await fs.stat(syncTestRoot);
    if (!stat.isDirectory()) return { scope: MANIFEST_SCOPE, generatedAt, files };
  } catch (err) {
    if (err?.code === "ENOENT") return { scope: MANIFEST_SCOPE, generatedAt, files };
    throw err;
  }

  await collectSyncTestFiles(syncTestRoot, syncTestRoot, files);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { scope: MANIFEST_SCOPE, generatedAt, files };
}

export function validateManifestRequestMessage(message) {
  if (!isPlainObject(message)) throw new Error("Manifest request message must be a plain object");
  if (message.type !== MANIFEST_REQUEST_TYPE) throw new Error(`Manifest request type must be \"${MANIFEST_REQUEST_TYPE}\"`);
  if (message.version !== MANIFEST_REQUEST_VERSION) throw new Error("Manifest request version must be 1");
  const scope = normalizeNonEmptyString(message.scope, "scope");
  if (scope !== MANIFEST_SCOPE) throw new Error(`scope must be \"${MANIFEST_SCOPE}\"`);

  return {
    type: MANIFEST_REQUEST_TYPE,
    version: MANIFEST_REQUEST_VERSION,
    deviceId: normalizeNonEmptyString(message.deviceId, "deviceId"),
    deviceName: normalizeNonEmptyString(message.deviceName, "deviceName"),
    timestamp: normalizeTimestamp(message.timestamp),
    scope,
  };
}

export async function createSignedManifestRequest(options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateManifestRequestMessage({
    type: MANIFEST_REQUEST_TYPE,
    version: MANIFEST_REQUEST_VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
    scope: MANIFEST_SCOPE,
  });
  const { payload, signatureBase64 } = await signMessage(message, options);
  return { payload, signatureBase64, deviceId: message.deviceId };
}

export async function verifySignedManifestRequest({ payload, signatureBase64 }, options = {}) {
  const payloadText = requireNonBlankString(payload, "payload");
  const signatureText = normalizeNonEmptyString(signatureBase64, "signatureBase64");

  let parsedMessage;
  try {
    parsedMessage = JSON.parse(payloadText);
  } catch {
    throw new Error("Signed manifest request payload must be valid JSON");
  }

  const message = validateManifestRequestMessage(parsedMessage);
  const peer = await findTrustedPeer(message.deviceId, options);
  if (!peer) throw new Error("Unknown peer deviceId");
  const verified = await verifyMessage(payloadText, signatureText, peer.publicKey);
  if (!verified) throw new Error("Peer manifest request signature verification failed");
  return { ok: true, peer: { deviceId: peer.deviceId, deviceName: peer.deviceName }, message };
}

export async function compareManifests(localManifest, remoteManifest) {
  const localFiles = normalizeManifestHashMap(localManifest, "localManifest");
  const remoteFiles = normalizeManifestHashMap(remoteManifest, "remoteManifest");
  const allPaths = [...new Set([...localFiles.keys(), ...remoteFiles.keys()])].sort((a, b) => a.localeCompare(b));

  const onlyLocal = [];
  const onlyRemote = [];
  const changed = [];
  const same = [];
  for (const relativePath of allPaths) {
    const localHash = localFiles.get(relativePath);
    const remoteHash = remoteFiles.get(relativePath);
    if (localHash === undefined) onlyRemote.push(relativePath);
    else if (remoteHash === undefined) onlyLocal.push(relativePath);
    else if (localHash === remoteHash) same.push(relativePath);
    else changed.push(relativePath);
  }
  return { onlyLocal, onlyRemote, changed, same };
}
