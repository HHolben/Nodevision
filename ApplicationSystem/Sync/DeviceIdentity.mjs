// Nodevision/ApplicationSystem/Sync/DeviceIdentity.mjs
// This module manages local-only Nodevision device identity files and cryptographic signing helpers, including deterministic canonical JSON serialization for secure peer-message signatures.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";

const SERVER_SETTINGS_MODE = 0o700;
const IDENTITY_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const PUBLIC_FILE_MODE = 0o644;
const DEVICE_FILE_MODE = 0o600;

function resolveRuntimeRoot(options = {}) {
  if (options.runtimeRoot) return path.resolve(String(options.runtimeRoot));
  if (process.env.NODEVISION_ROOT) return path.resolve(process.env.NODEVISION_ROOT);
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..");
}

function resolveIdentityPaths(options = {}) {
  const runtimeRoot = resolveRuntimeRoot(options);
  const serverSettingsDir = path.join(runtimeRoot, "ServerSettings");
  const identityDir = path.join(serverSettingsDir, "Identity");
  return {
    runtimeRoot,
    serverSettingsDir,
    identityDir,
    devicePath: path.join(identityDir, "device.json"),
    publicKeyPath: path.join(identityDir, "public.pem"),
    privateKeyPath: path.join(identityDir, "private.pem"),
  };
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function applyMode(targetPath, mode) {
  if (process.platform === "win32") return;
  try {
    await fs.chmod(targetPath, mode);
  } catch (err) {
    const code = err?.code;
    if (code === "EPERM" || code === "EINVAL" || code === "ENOENT") return;
    throw err;
  }
}

async function ensureIdentityLayout(options = {}) {
  const paths = resolveIdentityPaths(options);
  await fs.mkdir(paths.serverSettingsDir, { recursive: true, mode: SERVER_SETTINGS_MODE });
  await fs.mkdir(paths.identityDir, { recursive: true, mode: IDENTITY_DIR_MODE });
  await applyMode(paths.serverSettingsDir, SERVER_SETTINGS_MODE);
  await applyMode(paths.identityDir, IDENTITY_DIR_MODE);
  return paths;
}

function normalizeDeviceRecord(raw, fallbackDeviceName = null) {
  const deviceId = String(raw?.deviceId || "").trim();
  const deviceName = String(raw?.deviceName || fallbackDeviceName || "").trim();
  const createdAt = String(raw?.createdAt || "").trim();
  if (!deviceId) throw new Error("Invalid device.json: missing deviceId");
  if (!deviceName) throw new Error("Invalid device.json: missing deviceName");
  if (!createdAt) throw new Error("Invalid device.json: missing createdAt");
  return { deviceId, deviceName, createdAt };
}

function unsupportedValueError(pointer, detail) {
  return new Error(`Unsupported value for canonical JSON at ${pointer}: ${detail}`);
}

function canonicalizeValue(value, pointer, seen) {
  if (value === null) return "null";
  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") return JSON.stringify(value);
  if (valueType === "number") {
    if (!Number.isFinite(value)) throw unsupportedValueError(pointer, String(value));
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (valueType === "undefined") throw unsupportedValueError(pointer, "undefined");
  if (valueType === "function") throw unsupportedValueError(pointer, "function");
  if (valueType === "symbol") throw unsupportedValueError(pointer, "symbol");
  if (valueType === "bigint") throw unsupportedValueError(pointer, "BigInt");

  if (seen.has(value)) throw new Error(`Circular reference detected while canonicalizing ${pointer}`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const parts = [];
      for (let i = 0; i < value.length; i += 1) {
        if (!(i in value)) throw unsupportedValueError(`${pointer}[${i}]`, "sparse array hole");
        parts.push(canonicalizeValue(value[i], `${pointer}[${i}]`, seen));
      }
      return `[${parts.join(",")}]`;
    }

    if (Object.prototype.toString.call(value) !== "[object Object]") {
      throw unsupportedValueError(pointer, Object.prototype.toString.call(value));
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw unsupportedValueError(pointer, "symbol keys");
    }

    const keys = Object.keys(value).sort();
    const parts = [];
    for (const key of keys) {
      const keyPath = pointer === "$" ? `$.${key}` : `${pointer}.${key}`;
      parts.push(`${JSON.stringify(key)}:${canonicalizeValue(value[key], keyPath, seen)}`);
    }
    return `{${parts.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalizeMessage(value) {
  return canonicalizeValue(value, "$", new Set());
}

export async function ensureDeviceIdentity(options = {}) {
  const paths = await ensureIdentityLayout(options);
  const hasDevice = await fileExists(paths.devicePath);
  const hasPublic = await fileExists(paths.publicKeyPath);
  const hasPrivate = await fileExists(paths.privateKeyPath);
  const existingCount = [hasDevice, hasPublic, hasPrivate].filter(Boolean).length;

  if (existingCount === 3) {
    const loaded = await loadDeviceIdentity(options);
    await applyMode(paths.devicePath, DEVICE_FILE_MODE);
    await applyMode(paths.publicKeyPath, PUBLIC_FILE_MODE);
    await applyMode(paths.privateKeyPath, PRIVATE_FILE_MODE);
    return loaded;
  }

  if (existingCount > 0) {
    throw new Error(
      "Partial device identity detected in ServerSettings/Identity. Expected device.json, public.pem, and private.pem to either all exist or all be missing.",
    );
  }

  const deviceId = String(options.deviceId || `nv_dev_${randomBytes(16).toString("hex")}`);
  const deviceName = String(options.deviceName || os.hostname());
  const createdAt = new Date().toISOString();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });

  await fs.writeFile(paths.devicePath, `${JSON.stringify({ deviceId, deviceName, createdAt }, null, 2)}\n`, "utf8");
  await fs.writeFile(paths.publicKeyPath, publicPem, "utf8");
  await fs.writeFile(paths.privateKeyPath, privatePem, "utf8");

  await applyMode(paths.devicePath, DEVICE_FILE_MODE);
  await applyMode(paths.publicKeyPath, PUBLIC_FILE_MODE);
  await applyMode(paths.privateKeyPath, PRIVATE_FILE_MODE);

  return { deviceId, deviceName, createdAt, publicKey: publicPem, publicKeyPath: paths.publicKeyPath, privateKeyPath: paths.privateKeyPath };
}

export async function loadDeviceIdentity(options = {}) {
  const paths = resolveIdentityPaths(options);
  if (!(await fileExists(paths.devicePath)) || !(await fileExists(paths.publicKeyPath))) {
    throw new Error("Device identity is missing. Run ensureDeviceIdentity() first.");
  }

  const rawDevice = JSON.parse(await fs.readFile(paths.devicePath, "utf8"));
  const normalized = normalizeDeviceRecord(rawDevice, options.deviceName || os.hostname());
  const publicKey = await fs.readFile(paths.publicKeyPath, "utf8");

  return { ...normalized, publicKey, publicKeyPath: paths.publicKeyPath, privateKeyPath: paths.privateKeyPath };
}

export async function loadPrivateKey(options = {}) {
  const paths = resolveIdentityPaths(options);
  if (!(await fileExists(paths.privateKeyPath))) {
    throw new Error("Device private key is missing. Run ensureDeviceIdentity() first.");
  }
  return fs.readFile(paths.privateKeyPath, "utf8");
}

export async function signMessage(messageObject, options = {}) {
  const payload = canonicalizeMessage(messageObject);
  const privateKey = await loadPrivateKey(options);
  const signature = sign(null, Buffer.from(payload), privateKey);
  return { payload, signatureBase64: signature.toString("base64") };
}

export async function verifyMessage(payload, signatureBase64, publicKey) {
  return verify(null, Buffer.from(String(payload)), String(publicKey), Buffer.from(String(signatureBase64), "base64"));
}
