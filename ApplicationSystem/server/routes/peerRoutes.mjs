// Nodevision/ApplicationSystem/server/routes/peerRoutes.mjs
// This file registers signed trusted peer endpoints for hello, status, SyncTest benchmark transfer, and generalized scope-limited manifest/file transfer with strict path confinement.

import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createSignedHello, verifySignedHello } from "../../Sync/PeerHello.mjs";
import { FILE_PUSH_ALLOWED_PREFIX, MAX_FILE_PUSH_BYTES, verifySignedFileRequest, verifySignedFilePush } from "../../Sync/PeerFileTransfer.mjs";
import { buildSyncTestManifest, verifySignedManifestRequest } from "../../Sync/SyncManifest.mjs";
import { getLocalPeerInfo, loadTrustedPeers } from "../../Sync/TrustedPeers.mjs";
import { buildScopeManifest, resolveScopeNotebookPath } from "../../Sync/SyncScopes.mjs";
import { isProtectedFromPeerWrites } from "../../Sync/SyncProtection.mjs";
import {
  isScopedPeerVerificationError,
  verifySignedScopeFilePush,
  verifySignedScopeFileRequest,
  verifySignedScopeFileStreamPush,
  verifySignedScopeManifestRequest,
  validateScopedRelativePath,
} from "../../Sync/ScopePeerSync.mjs";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const STREAM_SIGNED_REQUEST_MAX_AGE_MS = 45 * 60 * 1000;
const STREAM_SIGNED_REQUEST_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function isLocalhostRequest(req) { return [String(req.ip || ""), String(req.socket?.remoteAddress || ""), String(req.connection?.remoteAddress || "")].filter(Boolean).map((x) => x.replace(/^::ffff:/, "")).some((x) => x === "127.0.0.1" || x === "::1"); }
function toTrustedPeerStatus(peer) { return { deviceId: peer.deviceId, deviceName: peer.deviceName, status: peer.status, lastSeen: peer.lastSeen, lastHelloSuccess: peer.lastHelloSuccess }; }

function decodeFilePushContent(contentBase64) { const encoded = String(contentBase64 ?? ""); const decoded = Buffer.from(encoded, "base64"); if (decoded.toString("base64") !== encoded) throw new Error("Invalid base64"); if (decoded.length > MAX_FILE_PUSH_BYTES) throw new Error("size limit"); return decoded; }

function resolveSyncTestTarget(notebookDir, relativePath) {
  const input = String(relativePath ?? "");
  if (input.includes("\0") || input.includes("\\") || input.includes("..")) throw new Error("Invalid file path");
  if (path.posix.isAbsolute(input) || path.win32.isAbsolute(input)) throw new Error("Invalid file path");
  if (!input.startsWith(FILE_PUSH_ALLOWED_PREFIX)) throw new Error("Invalid file path");
  const normalized = path.posix.normalize(input);
  if (normalized !== input || normalized === FILE_PUSH_ALLOWED_PREFIX || normalized.endsWith("/")) throw new Error("Invalid file path");
  const root = path.resolve(String(notebookDir || ""), "SyncTest");
  const targetPath = path.resolve(root, normalized.slice(FILE_PUSH_ALLOWED_PREFIX.length));
  const rel = path.relative(root, targetPath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Invalid file path");
  return { targetPath, normalizedRelativePath: normalized };
}

function resolveScopedTarget(notebookDir, scope, relativePath) {
  const validated = validateScopedRelativePath(relativePath, scope);
  const scopeRoot = resolveScopeNotebookPath({ notebookDir: path.resolve(String(notebookDir || "")), scope });
  const suffix = validated.slice(`${scope}/`.length);
  const targetPath = path.resolve(scopeRoot, suffix);
  const rel = path.relative(scopeRoot, targetPath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Invalid scoped path");
  return { scopeRoot, targetPath, normalizedRelativePath: validated };
}

async function readScopedFile(scoped) {
  const stat = await fs.stat(scoped.targetPath);
  if (!stat.isFile()) throw new Error("File not found");
  if (stat.size > MAX_FILE_PUSH_BYTES) throw new Error(`File exceeds ${MAX_FILE_PUSH_BYTES} bytes`);
  const fileBuffer = await fs.readFile(scoped.targetPath);
  return { fileBuffer, hash: sha256(fileBuffer) };
}

async function hashFileByStream(filePath) {
  const hasher = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hasher.update(chunk);
  }
  return hasher.digest("hex");
}

function buildScopedConflictRelativePath(originalRelativePath, peerDeviceId, timestamp) {
  const parsed = path.posix.parse(originalRelativePath);
  const safeTs = new Date(Date.parse(timestamp)).toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safePeer = String(peerDeviceId || "peer").replace(/[^A-Za-z0-9_-]+/g, "-");
  const name = parsed.ext ? `${parsed.name}.from-${safePeer}.${safeTs}${parsed.ext}` : `${parsed.base}.from-${safePeer}.${safeTs}`;
  const segments = originalRelativePath.split("/");
  const scope = segments[0];
  const nestedDir = segments.slice(1, -1).join("/");
  return nestedDir ? `${scope}/.conflicts/${nestedDir}/${name}` : `${scope}/.conflicts/${name}`;
}

function classifyScopedPeerRequestError(err, unauthorizedError) {
  const message = String(err?.message || "").trim();
  if (message.startsWith("Scope is not enabled:")) {
    return { status: 403, error: message };
  }
  return { status: 401, error: unauthorizedError };
}

function classifyScopedStreamRequestError(err, unauthorizedError) {
  const message = String(err?.message || "").trim();
  if (isScopedPeerVerificationError(err)) {
    switch (String(err.code || "")) {
      case "scope_not_enabled":
        return { status: 403, error: message || "Scope is not enabled", safeDetails: err.safeDetails, code: err.code };
      case "invalid_payload":
        if (message.includes("relativePath") || message.includes("scoped path") || message.includes("traversal")) {
          return { status: 400, error: "Invalid scoped path", safeDetails: err.safeDetails, code: err.code };
        }
        return { status: 400, error: message || "Invalid payload", safeDetails: err.safeDetails, code: err.code };
      case "malformed_request":
      case "malformed_payload":
      case "invalid_timestamp":
        return { status: 400, error: message || "Malformed request", safeDetails: err.safeDetails, code: err.code };
      case "expired_request":
        return { status: 401, error: "Expired request", safeDetails: err.safeDetails, code: err.code };
      case "malformed_signature":
        return { status: 401, error: "Malformed signature", safeDetails: err.safeDetails, code: err.code };
      case "unknown_peer":
        return { status: 401, error: "Unknown peer. Approve/trust this device on the peer serving the file.", safeDetails: err.safeDetails, code: err.code };
      case "invalid_signature":
        return { status: 401, error: "Invalid signature. Re-approve/trust the peer on both devices.", safeDetails: err.safeDetails, code: err.code };
      default:
        return { status: 401, error: unauthorizedError, safeDetails: err.safeDetails, code: err.code };
    }
  }
  if (message.startsWith("Scope is not enabled:")) {
    return { status: 403, error: message, safeDetails: null, code: "scope_not_enabled" };
  }
  if (message.includes("relativePath") || message.includes("scoped path") || message.includes("traversal")) {
    return { status: 400, error: "Invalid scoped path", safeDetails: null, code: "invalid_scoped_path" };
  }
  return { status: 401, error: unauthorizedError + ". Make sure both devices have approved/trusted each other for sync.", safeDetails: null, code: "unauthorized" };
}

function logScopedStreamAuthRejection(endpoint, classified, err, diagnostics = {}, knownTrustedDeviceIds = []) {
  const safe = classified?.safeDetails && typeof classified.safeDetails === "object"
    ? classified.safeDetails
    : {};
  const logLine = {
    endpoint,
    errorCode: classified?.code || "unauthorized",
    deviceId: safe.deviceId ?? null,
    scope: safe.scope ?? null,
    relativePath: safe.relativePath ?? null,
    timestampAgeMs: safe.timestampAgeMs ?? null,
    trustedPeerFound: Boolean(safe.trustedPeerFound),
    signatureVerified: Boolean(safe.signatureVerified),
    status: Number(classified?.status || 0),
    reason: String(classified?.error || err?.message || "unauthorized"),
    authFieldSources: {
      payload: diagnostics?.payloadSource || "unknown",
      signature: diagnostics?.signatureSource || "unknown",
    },
    request: {
      method: diagnostics?.method || null,
      path: diagnostics?.path || null,
      queryKeys: Array.isArray(diagnostics?.queryKeys) ? diagnostics.queryKeys : [],
      bodyKeys: Array.isArray(diagnostics?.bodyKeys) ? diagnostics.bodyKeys : [],
      headerKeys: Array.isArray(diagnostics?.headerKeys) ? diagnostics.headerKeys : [],
      payloadParsed: Boolean(diagnostics?.payloadFields?.parsed),
      payloadDeviceId: diagnostics?.payloadFields?.deviceId ?? null,
      payloadScope: diagnostics?.payloadFields?.scope ?? null,
      payloadRelativePath: diagnostics?.payloadFields?.relativePath ?? null,
      payloadTimestampPresent: Boolean(diagnostics?.payloadFields?.timestamp),
    },
    knownTrustedDeviceIds: Array.isArray(knownTrustedDeviceIds) ? knownTrustedDeviceIds : [],
  };
  console.warn("[peerRoutes] Rejected scoped stream request: %s", JSON.stringify(logLine));
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function firstNonEmpty(values = []) {
  for (const item of values) {
    const value = firstValue(item?.value);
    if (typeof value === "string" && value.trim()) {
      return { value, source: item.source };
    }
  }
  return { value: undefined, source: "missing" };
}

function headerValue(req, name) {
  if (!req?.headers) return undefined;
  return req.headers[name.toLowerCase()];
}

function safePayloadFieldSummary(payloadText) {
  if (typeof payloadText !== "string" || !payloadText.trim()) {
    return { parsed: false, deviceId: null, scope: null, relativePath: null, timestamp: null };
  }
  try {
    const parsed = JSON.parse(payloadText);
    return {
      parsed: Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed)),
      deviceId: typeof parsed?.deviceId === "string" && parsed.deviceId.trim() ? parsed.deviceId.trim() : null,
      scope: typeof parsed?.scope === "string" && parsed.scope.trim() ? parsed.scope.trim() : null,
      relativePath: typeof parsed?.relativePath === "string" && parsed.relativePath.trim() ? parsed.relativePath.trim() : null,
      timestamp: typeof parsed?.timestamp === "string" && parsed.timestamp.trim() ? parsed.timestamp.trim() : null,
    };
  } catch {
    return { parsed: false, deviceId: null, scope: null, relativePath: null, timestamp: null };
  }
}

export function extractSignedStreamAuth(req) {
  const body = req?.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const payload = firstNonEmpty([
    { source: "query", value: req?.query?.payload },
    { source: "header:x-nodevision-peer-payload", value: headerValue(req, "x-nodevision-peer-payload") },
    { source: "header:x-nodevision-payload", value: headerValue(req, "x-nodevision-payload") },
    { source: "body", value: body.payload },
  ]);
  const signature = firstNonEmpty([
    { source: "query", value: req?.query?.signatureBase64 },
    { source: "query", value: req?.query?.signature },
    { source: "header:x-nodevision-peer-signature", value: headerValue(req, "x-nodevision-peer-signature") },
    { source: "header:x-nodevision-signature-base64", value: headerValue(req, "x-nodevision-signature-base64") },
    { source: "body", value: body.signatureBase64 },
    { source: "body", value: body.signature },
  ]);

  return {
    payload: payload.value,
    signatureBase64: signature.value,
    diagnostics: {
      method: String(req?.method || ""),
      path: String(req?.path || req?.originalUrl || "").split("?")[0],
      payloadSource: payload.source,
      signatureSource: signature.source,
      queryKeys: Object.keys(req?.query || {}).sort(),
      bodyKeys: Object.keys(body).sort(),
      headerKeys: Object.keys(req?.headers || {})
        .filter((key) => key.toLowerCase().startsWith("x-nodevision"))
        .sort(),
      payloadFields: safePayloadFieldSummary(payload.value),
    },
  };
}

async function safeTrustedDeviceIds(options = {}) {
  try {
    const store = await loadTrustedPeers(options);
    return (store.trustedPeers || [])
      .map((peer) => String(peer?.deviceId || "").trim())
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

export function registerPeerRoutes(app, ctx) {
  app.post("/api/peer/hello", async (req, res) => {
    try {
      const { payload, signatureBase64 } = req.body || {};
      const verified = await verifySignedHello({ payload, signatureBase64 }, { runtimeRoot: ctx?.runtimeRoot });
      const response = await createSignedHello({ runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, peer: verified.peer, response });
    } catch { return res.status(401).json({ ok: false, error: "Unauthorized peer hello" }); }
  });

  app.post("/api/peer/file-push", async (req, res) => {
    if (await isProtectedFromPeerWrites({ runtimeRoot: ctx?.runtimeRoot })) {
      return res.status(423).json({ ok: false, error: "This peer is protected from incoming sync writes" });
    }
    let verified; let contentBuffer; let target;
    try {
      const { payload, signatureBase64 } = req.body || {};
      verified = await verifySignedFilePush({ payload, signatureBase64 }, { runtimeRoot: ctx?.runtimeRoot });
      contentBuffer = decodeFilePushContent(verified.message.contentBase64);
      target = resolveSyncTestTarget(ctx?.notebookDir, verified.message.relativePath);
    } catch { return res.status(401).json({ ok: false, error: "Unauthorized peer file push" }); }
    try {
      await fs.mkdir(path.dirname(target.targetPath), { recursive: true });
      await fs.writeFile(target.targetPath, contentBuffer);
      return res.json({ ok: true, peer: verified.peer, saved: { relativePath: target.normalizedRelativePath, bytes: contentBuffer.length } });
    } catch { return res.status(500).json({ ok: false, error: "Failed to save peer file push" }); }
  });

  app.post("/api/peer/file-get", async (req, res) => {
    let verified; let target;
    try {
      const { payload, signatureBase64 } = req.body || {};
      verified = await verifySignedFileRequest({ payload, signatureBase64 }, { runtimeRoot: ctx?.runtimeRoot });
      target = resolveSyncTestTarget(ctx?.notebookDir, verified.message.relativePath);
    } catch { return res.status(401).json({ ok: false, error: "Unauthorized peer file get" }); }
    try {
      const { fileBuffer, hash } = await readScopedFile({ targetPath: target.targetPath });
      return res.json({ ok: true, peer: verified.peer, file: { relativePath: target.normalizedRelativePath, contentBase64: fileBuffer.toString("base64"), contentType: "application/octet-stream", bytes: fileBuffer.length, sha256: hash } });
    } catch (err) {
      if (String(err?.message).includes("not found") || err?.code === "ENOENT") return res.status(404).json({ ok: false, error: "File not found" });
      if (String(err?.message).includes("exceeds")) return res.status(413).json({ ok: false, error: String(err.message) });
      return res.status(500).json({ ok: false, error: "Failed to read peer file" });
    }
  });

  app.post("/api/peer/manifest", async (req, res) => {
    let verified;
    try { const { payload, signatureBase64 } = req.body || {}; verified = await verifySignedManifestRequest({ payload, signatureBase64 }, { runtimeRoot: ctx?.runtimeRoot }); }
    catch { return res.status(401).json({ ok: false, error: "Unauthorized peer manifest request" }); }
    try { const manifest = await buildSyncTestManifest({ runtimeRoot: ctx?.runtimeRoot, notebookDir: ctx?.notebookDir }); return res.json({ ok: true, peer: verified.peer, manifest }); }
    catch { return res.status(500).json({ ok: false, error: "Failed to build peer manifest" }); }
  });

  app.post("/api/peer/scope/manifest", async (req, res) => {
    try {
      const { payload, signatureBase64 } = req.body || {};
      const verified = await verifySignedScopeManifestRequest({ payload, signatureBase64 }, { runtimeRoot: ctx?.runtimeRoot });
      const manifest = await buildScopeManifest({ notebookDir: ctx?.notebookDir, scope: verified.message.scope });
      return res.json({ ok: true, peer: verified.peer, manifest });
    } catch (err) {
      const classified = classifyScopedPeerRequestError(err, "Unauthorized peer scope manifest request");
      return res.status(classified.status).json({ ok: false, error: classified.error });
    }
  });

  app.post("/api/peer/scope/file-get", async (req, res) => {
    try {
      const { payload, signatureBase64 } = req.body || {};
      const verified = await verifySignedScopeFileRequest({ payload, signatureBase64 }, { runtimeRoot: ctx?.runtimeRoot });
      const scoped = resolveScopedTarget(ctx?.notebookDir, verified.message.scope, verified.message.relativePath);
      const { fileBuffer, hash } = await readScopedFile(scoped);
      return res.json({ ok: true, peer: verified.peer, file: { scope: verified.message.scope, relativePath: scoped.normalizedRelativePath, contentBase64: fileBuffer.toString("base64"), contentType: "application/octet-stream", bytes: fileBuffer.length, sha256: hash } });
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.startsWith("Scope is not enabled:")) return res.status(403).json({ ok: false, error: msg });
      if (msg.includes("not found") || err?.code === "ENOENT") return res.status(404).json({ ok: false, error: "File not found" });
      if (msg.includes("exceeds")) return res.status(413).json({ ok: false, error: msg });
      return res.status(401).json({ ok: false, error: "Unauthorized peer scope file request" });
    }
  });

  app.get("/api/peer/scope/file-stream", async (req, res) => {
    let streamAuthDiagnostics = {};
    try {
      const { payload, signatureBase64, diagnostics } = extractSignedStreamAuth(req);
      streamAuthDiagnostics = diagnostics;
      const verified = await verifySignedScopeFileRequest(
        { payload, signatureBase64 },
        {
          runtimeRoot: ctx?.runtimeRoot,
          maxMessageAgeMs: STREAM_SIGNED_REQUEST_MAX_AGE_MS,
          maxFutureSkewMs: STREAM_SIGNED_REQUEST_MAX_FUTURE_SKEW_MS,
        },
      );
      const scoped = resolveScopedTarget(ctx?.notebookDir, verified.message.scope, verified.message.relativePath);
      const stat = await fs.stat(scoped.targetPath);
      if (!stat.isFile()) return res.status(404).json({ ok: false, error: "File not found" });

      let knownSha = null;
      if (stat.size <= MAX_FILE_PUSH_BYTES) {
        const fileBuffer = await fs.readFile(scoped.targetPath);
        knownSha = sha256(fileBuffer);
      }

      res.set({
        "cache-control": "no-store",
        "content-length": String(stat.size),
        "content-type": "application/octet-stream",
        "x-nodevision-relative-path": scoped.normalizedRelativePath,
      });
      if (knownSha) {
        res.set("x-nodevision-sha256", knownSha);
      }

      const stream = createReadStream(scoped.targetPath);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.status(500).json({ ok: false, error: "Failed to read peer file stream" });
          return;
        }
        res.destroy();
      });
      stream.pipe(res);
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("not found") || err?.code === "ENOENT") return res.status(404).json({ ok: false, error: "File not found" });
      const classified = classifyScopedStreamRequestError(err, "Unauthorized peer scope file stream request");
      if (classified.status === 401 || classified.status === 400 || classified.status === 403) {
        logScopedStreamAuthRejection("scope/file-stream", classified, err, streamAuthDiagnostics, await safeTrustedDeviceIds({ runtimeRoot: ctx?.runtimeRoot }));
      }
      return res.status(classified.status).json({ ok: false, error: classified.error });
    }
  });

  app.post("/api/peer/scope/file-stream-push", async (req, res) => {
    if (await isProtectedFromPeerWrites({ runtimeRoot: ctx?.runtimeRoot })) {
      return res.status(423).json({ ok: false, error: "This peer is protected from incoming sync writes" });
    }
    let streamAuthDiagnostics = {};
    let verified;
    let scoped;
    let tempPath = null;
    try {
      const { payload, signatureBase64, diagnostics } = extractSignedStreamAuth(req);
      streamAuthDiagnostics = diagnostics;
      verified = await verifySignedScopeFileStreamPush(
        { payload, signatureBase64 },
        {
          runtimeRoot: ctx?.runtimeRoot,
          maxMessageAgeMs: STREAM_SIGNED_REQUEST_MAX_AGE_MS,
          maxFutureSkewMs: STREAM_SIGNED_REQUEST_MAX_FUTURE_SKEW_MS,
        },
      );
      scoped = resolveScopedTarget(ctx?.notebookDir, verified.message.scope, verified.message.relativePath);
      tempPath = `${scoped.targetPath}.nodevision-upload`;
    } catch (err) {
      const classified = classifyScopedStreamRequestError(err, "Unauthorized peer scope file stream push");
      if (classified.status === 401 || classified.status === 400 || classified.status === 403) {
        logScopedStreamAuthRejection("scope/file-stream-push", classified, err, streamAuthDiagnostics, await safeTrustedDeviceIds({ runtimeRoot: ctx?.runtimeRoot }));
      }
      return res.status(classified.status).json({ ok: false, error: classified.error });
    }

    try {
      await fs.mkdir(path.dirname(scoped.targetPath), { recursive: true });
      await fs.rm(tempPath, { force: true });

      const streamHash = createHash("sha256");
      let bytesReceived = 0;
      await pipeline(
        req,
        new Transform({
          transform(chunk, _encoding, callback) {
            try {
              const chunkBytes = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
              bytesReceived += chunkBytes;
              streamHash.update(chunk);
              callback(null, chunk);
            } catch (err) {
              callback(err);
            }
          },
        }),
        createWriteStream(tempPath, { flags: "wx" }),
      );

      const computedSha256 = streamHash.digest("hex");
      if (bytesReceived !== verified.message.size) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
        return res.status(400).json({ ok: false, error: "Byte mismatch" });
      }
      if (computedSha256 !== verified.message.sha256) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
        return res.status(400).json({ ok: false, error: "Invalid hash" });
      }

      let existingHash = null;
      let targetExists = false;
      try {
        const existingStat = await fs.stat(scoped.targetPath);
        if (!existingStat.isFile()) throw new Error("existing target path is not a file");
        targetExists = true;
        existingHash = await hashFileByStream(scoped.targetPath);
      } catch (err) {
        if (err?.code !== "ENOENT") throw err;
      }

      if (!targetExists) {
        await fs.rename(tempPath, scoped.targetPath);
        return res.json({
          ok: true,
          peer: verified.peer,
          saved: {
            relativePath: scoped.normalizedRelativePath,
            bytes: bytesReceived,
            sha256: computedSha256,
            mode: "created",
          },
        });
      }

      if (existingHash === computedSha256) {
        await fs.rm(tempPath, { force: true });
        return res.json({
          ok: true,
          peer: verified.peer,
          saved: {
            relativePath: scoped.normalizedRelativePath,
            bytes: bytesReceived,
            sha256: computedSha256,
            mode: "noop",
          },
        });
      }

      const conflictRelativePath = buildScopedConflictRelativePath(
        scoped.normalizedRelativePath,
        verified.peer.deviceId,
        new Date().toISOString(),
      );
      const conflictTarget = resolveScopedTarget(ctx?.notebookDir, verified.message.scope, conflictRelativePath);
      await fs.mkdir(path.dirname(conflictTarget.targetPath), { recursive: true });
      await fs.rename(tempPath, conflictTarget.targetPath);
      return res.json({
        ok: true,
        peer: verified.peer,
        saved: {
          relativePath: scoped.normalizedRelativePath,
          bytes: bytesReceived,
          sha256: computedSha256,
          mode: "conflict",
          conflictRelativePath,
        },
      });
    } catch (err) {
      if (tempPath) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
      }
      return res.status(500).json({ ok: false, error: "Failed to save peer scope file stream push" });
    }
  });

  app.post("/api/peer/scope/file-push", async (req, res) => {
    if (await isProtectedFromPeerWrites({ runtimeRoot: ctx?.runtimeRoot })) {
      return res.status(423).json({ ok: false, error: "This peer is protected from incoming sync writes" });
    }
    try {
      const { payload, signatureBase64 } = req.body || {};
      const verified = await verifySignedScopeFilePush({ payload, signatureBase64 }, { runtimeRoot: ctx?.runtimeRoot });
      const scoped = resolveScopedTarget(ctx?.notebookDir, verified.message.scope, verified.message.relativePath);
      const incoming = decodeFilePushContent(verified.message.contentBase64);
      const incomingHash = sha256(incoming);
      let existingHash = null;
      let exists = false;
      try { const existing = await fs.readFile(scoped.targetPath); exists = true; existingHash = sha256(existing); } catch {}
      if (!exists) {
        await fs.mkdir(path.dirname(scoped.targetPath), { recursive: true });
        await fs.writeFile(scoped.targetPath, incoming);
        return res.json({ ok: true, peer: verified.peer, saved: { relativePath: scoped.normalizedRelativePath, bytes: incoming.length, sha256: incomingHash, mode: "created" } });
      }
      if (existingHash === incomingHash) {
        return res.json({ ok: true, peer: verified.peer, saved: { relativePath: scoped.normalizedRelativePath, bytes: incoming.length, sha256: incomingHash, mode: "noop" } });
      }
      const conflictRelativePath = buildScopedConflictRelativePath(
        scoped.normalizedRelativePath,
        verified.peer.deviceId,
        new Date().toISOString(),
      );
      const conflictTarget = resolveScopedTarget(ctx?.notebookDir, verified.message.scope, conflictRelativePath);
      await fs.mkdir(path.dirname(conflictTarget.targetPath), { recursive: true });
      await fs.writeFile(conflictTarget.targetPath, incoming);
      return res.json({ ok: true, peer: verified.peer, saved: { relativePath: scoped.normalizedRelativePath, bytes: incoming.length, sha256: incomingHash, mode: "conflict", conflictRelativePath } });
    } catch (err) {
      const classified = classifyScopedPeerRequestError(err, "Unauthorized peer scope file push");
      return res.status(classified.status).json({ ok: false, error: classified.error });
    }
  });

  app.get("/api/peer/status", async (req, res) => {
    try {
      if (!req.identity && !isLocalhostRequest(req)) return res.status(401).json({ ok: false, error: "Authentication required" });
      const options = { runtimeRoot: ctx?.runtimeRoot };
      const localDevice = await getLocalPeerInfo(options);
      const store = await loadTrustedPeers(options);
      return res.json({ ok: true, localDevice, trustedPeers: store.trustedPeers.map(toTrustedPeerStatus) });
    } catch { return res.status(500).json({ ok: false, error: "Failed to load peer status" }); }
  });
}
