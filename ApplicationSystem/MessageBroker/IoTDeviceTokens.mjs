// Nodevision/ApplicationSystem/MessageBroker/IoTDeviceTokens.mjs
// Token hashing and config-file helpers for IoT broker publish clients.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_IOT_TOKEN_FILE = path.join("ServerSettings", "IoT", "DeviceTokens.json");

export function resolveDeviceTokensPath({ runtimeRoot, deviceTokensPath } = {}) {
  if (deviceTokensPath) return deviceTokensPath;
  const root = runtimeRoot || process.env.NODEVISION_ROOT || process.cwd();
  return path.join(root, DEFAULT_IOT_TOKEN_FILE);
}

export function hashToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Token must be a nonempty string");
  }
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateDeviceToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function readDeviceTokens(deviceTokensPath) {
  try {
    const raw = await fs.readFile(deviceTokensPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tokens)) {
      throw new Error("IoT token file must contain a tokens array");
    }
    return parsed;
  } catch (err) {
    if (err?.code === "ENOENT") return { tokens: [] };
    throw err;
  }
}

export async function writeDeviceTokens(deviceTokensPath, data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.tokens)) {
    throw new Error("IoT token data must contain a tokens array");
  }
  await fs.mkdir(path.dirname(deviceTokensPath), { recursive: true });
  await fs.writeFile(deviceTokensPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function timingSafeHexEqual(leftHex, rightHex) {
  if (typeof leftHex !== "string" || typeof rightHex !== "string") return false;
  if (!/^[a-f0-9]{64}$/i.test(leftHex) || !/^[a-f0-9]{64}$/i.test(rightHex)) return false;
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function findTokenRecord(data, plaintextToken) {
  const tokenHash = hashToken(plaintextToken);
  for (const record of data?.tokens || []) {
    if (!record || typeof record !== "object") continue;
    if (timingSafeHexEqual(String(record.tokenHash || ""), tokenHash)) return record;
  }
  return null;
}

export async function createAndStoreDeviceToken({ name, allowedTopicPrefixes, deviceTokensPath }) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Token name is required");
  }
  if (!Array.isArray(allowedTopicPrefixes) || allowedTopicPrefixes.length === 0) {
    throw new Error("At least one allowed topic prefix is required");
  }

  const token = generateDeviceToken();
  const data = await readDeviceTokens(deviceTokensPath);
  const record = {
    name: name.trim(),
    tokenHash: hashToken(token),
    allowedTopicPrefixes: allowedTopicPrefixes.map((prefix) => String(prefix).trim()).filter(Boolean),
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  if (record.allowedTopicPrefixes.length === 0) {
    throw new Error("At least one allowed topic prefix is required");
  }

  data.tokens = data.tokens.filter((existing) => existing?.name !== record.name);
  data.tokens.push(record);
  await writeDeviceTokens(deviceTokensPath, data);
  return { token, record };
}
