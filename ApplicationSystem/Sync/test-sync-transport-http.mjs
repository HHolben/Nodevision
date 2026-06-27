// Nodevision/ApplicationSystem/Sync/test-sync-transport-http.mjs
// Focused test for HTTP sync transport endpoint compatibility.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HttpSyncTransport } from "./SyncTransport.mjs";
import { saveSyncScopes } from "./SyncScopes.mjs";

async function main() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-transport-http-"));
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot });
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: String(init.method || "GET"), body: init.body || "" });
    if (String(url).endsWith("/api/peer/status")) {
      return Response.json({ ok: true, localDevice: { deviceId: "peer", deviceName: "Peer" } });
    }
    if (String(url).endsWith("/api/peer/scope/manifest")) {
      return Response.json({ ok: true, manifest: { scope: "Shared", files: [] } });
    }
    return Response.json({ ok: false, error: "unexpected endpoint" }, { status: 404 });
  };

  try {
    const transport = new HttpSyncTransport({ peerUrl: "http://192.168.50.2:3000", runtimeRoot });
    const status = await transport.status();
    assert.equal(status.ok, true);
    const manifest = await transport.listFiles("Shared");
    assert.equal(manifest.scope, "Shared");
    assert.equal(calls[0].url, "http://192.168.50.2:3000/api/peer/status");
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[1].url, "http://192.168.50.2:3000/api/peer/scope/manifest");
    assert.equal(calls[1].method, "POST");
    assert.ok(String(calls[1].body).includes("signatureBase64"));
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("PASS");
}

main().catch((err) => {
  console.error("HTTP sync transport test failed:", err);
  process.exitCode = 1;
});
