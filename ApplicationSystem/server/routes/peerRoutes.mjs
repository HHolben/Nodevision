// Nodevision/ApplicationSystem/server/routes/peerRoutes.mjs
// This file registers a peer hello endpoint that authenticates incoming signed hello payloads against trusted peers and returns a locally signed hello response when verification succeeds.

import { createSignedHello, verifySignedHello } from "../../Sync/PeerHello.mjs";

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
}
