// Nodevision/ApplicationSystem/server/routes/peerRoutes.mjs
// This file registers signed trusted peer endpoints for hello, status, SyncTest benchmark transfer, and generalized scope-limited manifest/file transfer with strict path confinement.

import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createSignedHello, verifySignedHello } from "../../Sync/PeerHello.mjs";
import { FILE_PUSH_ALLOWED_PREFIX, MAX_FILE_PUSH_BYTES, verifySignedFileRequest, verifySignedFilePush } from "../../Sync/PeerFileTransfer.mjs";
import { buildSyncTestManifest, verifySignedManifestRequest } from "../../Sync/SyncManifest.mjs";
import { getLocalPeerInfo, loadTrustedPeers } from "../../Sync/TrustedPeers.mjs";
import { buildScopeManifest, resolveScopeNotebookPath } from "../../Sync/SyncScopes.mjs";
import { verifySignedScopeFilePush, verifySignedScopeFileRequest, verifySignedScopeManifestRequest, validateScopedRelativePath } from "../../Sync/ScopePeerSync.mjs";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

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

function extractSignedQuery(req) {
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  return {
    payload: first(req?.query?.payload),
    signatureBase64: first(req?.query?.signatureBase64),
  };
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
    try {
      const { payload, signatureBase64 } = extractSignedQuery(req);
      const verified = await verifySignedScopeFileRequest({ payload, signatureBase64 }, { runtimeRoot: ctx?.runtimeRoot });
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
      if (msg.startsWith("Scope is not enabled:")) return res.status(403).json({ ok: false, error: msg });
      if (msg.includes("not found") || err?.code === "ENOENT") return res.status(404).json({ ok: false, error: "File not found" });
      if (msg.includes("relativePath") || msg.includes("scoped path") || msg.includes("traversal")) {
        return res.status(400).json({ ok: false, error: "Invalid scoped path" });
      }
      return res.status(401).json({ ok: false, error: "Unauthorized peer scope file stream request" });
    }
  });

  app.post("/api/peer/scope/file-push", async (req, res) => {
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
