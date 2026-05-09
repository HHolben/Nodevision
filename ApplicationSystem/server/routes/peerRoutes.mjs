// Nodevision/ApplicationSystem/server/routes/peerRoutes.mjs
// This file registers peer sync endpoints for signed hello handshakes, trusted peer status, and benchmark-only trusted file pushes confined to Notebook/SyncTest.

import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createSignedHello, verifySignedHello } from "../../Sync/PeerHello.mjs";
import {
  FILE_PUSH_ALLOWED_PREFIX,
  MAX_FILE_PUSH_BYTES,
  verifySignedFilePush,
} from "../../Sync/PeerFileTransfer.mjs";
import { getLocalPeerInfo, loadTrustedPeers } from "../../Sync/TrustedPeers.mjs";

function isLocalhostRequest(req) {
  const candidates = [
    String(req.ip || "").trim(),
    String(req.socket?.remoteAddress || "").trim(),
    String(req.connection?.remoteAddress || "").trim(),
  ]
    .filter(Boolean)
    .map((value) => value.replace(/^::ffff:/, ""));

  return candidates.some((value) => value === "127.0.0.1" || value === "::1");
}

function toTrustedPeerStatus(peer) {
  return {
    deviceId: peer.deviceId,
    deviceName: peer.deviceName,
    status: peer.status,
    lastSeen: peer.lastSeen,
    lastHelloSuccess: peer.lastHelloSuccess,
  };
}

function decodeFilePushContent(contentBase64) {
  const encoded = String(contentBase64 ?? "");
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.toString("base64") !== encoded) {
    throw new Error("Invalid base64 content");
  }
  if (decoded.length > MAX_FILE_PUSH_BYTES) {
    throw new Error(`File push exceeds ${MAX_FILE_PUSH_BYTES} bytes`);
  }
  return decoded;
}

function resolveSyncTestTarget(notebookDir, relativePath) {
  const input = String(relativePath ?? "");

  if (input.includes("\0")) throw new Error("Invalid file path");
  if (input.includes("\\")) throw new Error("Invalid file path");
  if (path.posix.isAbsolute(input) || path.win32.isAbsolute(input)) throw new Error("Invalid file path");
  if (input.includes("..")) throw new Error("Invalid file path");
  if (!input.startsWith(FILE_PUSH_ALLOWED_PREFIX)) throw new Error("Invalid file path");

  const normalized = path.posix.normalize(input);
  if (normalized !== input) throw new Error("Invalid file path");
  if (normalized === FILE_PUSH_ALLOWED_PREFIX || normalized.endsWith("/")) throw new Error("Invalid file path");

  const syncTestRoot = path.resolve(String(notebookDir || ""), "SyncTest");
  const targetSubPath = normalized.slice(FILE_PUSH_ALLOWED_PREFIX.length);
  const targetPath = path.resolve(syncTestRoot, targetSubPath);
  const relative = path.relative(syncTestRoot, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid file path");
  }

  return { targetPath, normalizedRelativePath: normalized };
}

export function registerPeerRoutes(app, ctx) {
  app.post("/api/peer/hello", async (req, res) => {
    try {
      const { payload, signatureBase64 } = req.body || {};
      const verified = await verifySignedHello(
        { payload, signatureBase64 },
        { runtimeRoot: ctx?.runtimeRoot },
      );

      const response = await createSignedHello({ runtimeRoot: ctx?.runtimeRoot });
      return res.json({
        ok: true,
        peer: verified.peer,
        response,
      });
    } catch {
      return res.status(401).json({ ok: false, error: "Unauthorized peer hello" });
    }
  });

  app.post("/api/peer/file-push", async (req, res) => {
    let verified;
    let contentBuffer;
    let target;

    try {
      const { payload, signatureBase64 } = req.body || {};
      verified = await verifySignedFilePush(
        { payload, signatureBase64 },
        { runtimeRoot: ctx?.runtimeRoot },
      );
      contentBuffer = decodeFilePushContent(verified.message.contentBase64);
      target = resolveSyncTestTarget(ctx?.notebookDir, verified.message.relativePath);
    } catch {
      return res.status(401).json({ ok: false, error: "Unauthorized peer file push" });
    }

    try {
      await fs.mkdir(path.dirname(target.targetPath), { recursive: true });
      await fs.writeFile(target.targetPath, contentBuffer);
      return res.json({
        ok: true,
        peer: verified.peer,
        saved: {
          relativePath: target.normalizedRelativePath,
          bytes: contentBuffer.length,
        },
      });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to save peer file push" });
    }
  });

  app.get("/api/peer/status", async (req, res) => {
    try {
      if (!req.identity && !isLocalhostRequest(req)) {
        return res.status(401).json({ ok: false, error: "Authentication required" });
      }

      const options = { runtimeRoot: ctx?.runtimeRoot };
      const localDevice = await getLocalPeerInfo(options);
      const store = await loadTrustedPeers(options);

      return res.json({
        ok: true,
        localDevice,
        trustedPeers: store.trustedPeers.map(toTrustedPeerStatus),
      });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to load peer status" });
    }
  });
}
