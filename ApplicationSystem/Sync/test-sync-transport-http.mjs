// Nodevision/ApplicationSystem/Sync/test-sync-transport-http.mjs
// This test file verifies HTTP sync transport endpoint compatibility for manifest loading, file downloads, file pushes, and error reporting.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HttpSyncTransport, MultiEndpointHttpSyncTransport } from "./SyncTransport.mjs";
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
    if (String(url).endsWith("/api/peer/scope/file-push")) {
      return Response.json({ ok: true, saved: { relativePath: "Shared/example.txt", mode: "created" } });
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

    const combined = new MultiEndpointHttpSyncTransport({
      peerUrls: ["http://10.0.0.42:3000", "http://192.168.50.2:3000", "http://10.0.0.42:3000"],
      runtimeRoot,
    });
    assert.deepEqual(combined.peerUrls, ["http://10.0.0.42:3000", "http://192.168.50.2:3000"]);
    const combinedStatus = await combined.status();
    assert.equal(combinedStatus.ok, true);
    const manifestStartIndex = calls.length;
    const combinedManifest = await combined.listFiles("Shared");
    assert.equal(combinedManifest.scope, "Shared");
    const manifestUrls = calls.slice(manifestStartIndex).filter((call) => call.url.endsWith("/api/peer/scope/manifest")).map((call) => call.url).sort();
    assert.deepEqual(manifestUrls, [
      "http://10.0.0.42:3000/api/peer/scope/manifest",
      "http://192.168.50.2:3000/api/peer/scope/manifest",
    ].sort());
    const pushStartIndex = calls.length;
    await combined.putFile("Shared", "Shared/example.txt", Buffer.from("one"));
    await combined.putFile("Shared", "Shared/example.txt", Buffer.from("two"));
    const pushUrls = calls.slice(pushStartIndex).filter((call) => call.url.endsWith("/api/peer/scope/file-push")).map((call) => call.url);
    assert.deepEqual(pushUrls, [
      "http://10.0.0.42:3000/api/peer/scope/file-push",
      "http://192.168.50.2:3000/api/peer/scope/file-push",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("PASS");
}

main().catch((err) => {
  console.error("HTTP sync transport test failed:", err);
  process.exitCode = 1;
});
