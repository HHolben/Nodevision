// Nodevision/ApplicationSystem/server/routes/peerRoutes.mjs
// This file registers a peer hello endpoint that authenticates incoming signed hello payloads against trusted peers and returns a locally signed hello response when verification succeeds.

import { createSignedHello, verifySignedHello } from "../../Sync/PeerHello.mjs";
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
