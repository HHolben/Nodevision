// Nodevision/ApplicationSystem/Sync/DeviceIdentity.mjs
// This module creates and manages a local-only Nodevision device identity in ServerSettings, including secure key generation, safe loading, and signing/verification helpers that keep private key access explicit.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { Buffer } from "node:buffer";

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
  const devicePath = path.join(identityDir, "device.json");
  const publicKeyPath = path.join(identityDir, "public.pem");
  const privateKeyPath = path.join(identityDir, "private.pem");

  return {
    runtimeRoot,
    serverSettingsDir,
    identityDir,
    devicePath,
    publicKeyPath,
    privateKeyPath,
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

export async function ensureDeviceIdentity(options = {}) {
  const paths = await ensureIdentityLayout(options);
  const hasDevice = await fileExists(paths.devicePath);
  const hasPublic = await fileExists(paths.publicKeyPath);
  const hasPrivate = await fileExists(paths.privateKeyPath);

  if (hasDevice && hasPublic && hasPrivate) {
    const loaded = await loadDeviceIdentity(options);
    await applyMode(paths.devicePath, DEVICE_FILE_MODE);
    await applyMode(paths.publicKeyPath, PUBLIC_FILE_MODE);
    await applyMode(paths.privateKeyPath, PRIVATE_FILE_MODE);
    return loaded;
  }

  const deviceId = String(options.deviceId || `nv_dev_${randomBytes(16).toString("hex")}`);
  const deviceName = String(options.deviceName || os.hostname());
  const createdAt = new Date().toISOString();

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });

  const deviceRecord = { deviceId, deviceName, createdAt };
  await fs.writeFile(paths.devicePath, `${JSON.stringify(deviceRecord, null, 2)}\n`, "utf8");
  await fs.writeFile(paths.publicKeyPath, publicPem, "utf8");
  await fs.writeFile(paths.privateKeyPath, privatePem, "utf8");

  await applyMode(paths.devicePath, DEVICE_FILE_MODE);
  await applyMode(paths.publicKeyPath, PUBLIC_FILE_MODE);
  await applyMode(paths.privateKeyPath, PRIVATE_FILE_MODE);

  return {
    deviceId,
    deviceName,
    createdAt,
    publicKey: publicPem,
    publicKeyPath: paths.publicKeyPath,
    privateKeyPath: paths.privateKeyPath,
  };
}

export async function loadDeviceIdentity(options = {}) {
  const paths = resolveIdentityPaths(options);
  const hasDevice = await fileExists(paths.devicePath);
  const hasPublic = await fileExists(paths.publicKeyPath);

  if (!hasDevice || !hasPublic) {
    throw new Error("Device identity is missing. Run ensureDeviceIdentity() first.");
  }

  const rawDevice = JSON.parse(await fs.readFile(paths.devicePath, "utf8"));
  const normalized = normalizeDeviceRecord(rawDevice, options.deviceName || os.hostname());
  const publicKey = await fs.readFile(paths.publicKeyPath, "utf8");

  return {
    ...normalized,
    publicKey,
    publicKeyPath: paths.publicKeyPath,
    privateKeyPath: paths.privateKeyPath,
  };
}

export async function loadPrivateKey(options = {}) {
  const paths = resolveIdentityPaths(options);
  const hasPrivate = await fileExists(paths.privateKeyPath);

  if (!hasPrivate) {
    throw new Error("Device private key is missing. Run ensureDeviceIdentity() first.");
  }

  return fs.readFile(paths.privateKeyPath, "utf8");
}

export async function signMessage(messageObject, options = {}) {
  const plainObject =
    messageObject && typeof messageObject === "object" && !Array.isArray(messageObject)
      ? { ...messageObject }
      : { value: messageObject };

  const payload = JSON.stringify(plainObject);
  const privateKey = await loadPrivateKey(options);
  const signature = sign(null, Buffer.from(payload), privateKey);

  return {
    payload,
    signatureBase64: signature.toString("base64"),
  };
}

export async function verifyMessage(payload, signatureBase64, publicKey) {
  return verify(
    null,
    Buffer.from(String(payload)),
    String(publicKey),
    Buffer.from(String(signatureBase64), "base64"),
  );
}
