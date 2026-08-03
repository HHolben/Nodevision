// Nodevision/ApplicationSystem/Sync/test-wired-sync-diagnostics.mjs
// This test module exercises the wired sync diagnostics workflow without requiring real network peers or destructive file operations.
// Focused tests for wired/direct-network sync diagnostics.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { registerPeerRoutes } from "../server/routes/peerRoutes.mjs";
import {
  buildPeerUrl,
  collectNetworkInterfaceInventory,
  compareDiagnosticReports,
  runLocalDiagnostics,
  selectLikelyWiredInterface,
} from "./WiredSyncDiagnostics.mjs";

async function writeFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, String(value), "utf8");
}

async function writeInterface(root, name, fields = {}) {
  const dir = path.join(root, "sys/class/net", name);
  await fs.mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(path.join(dir, "operstate"), fields.operstate ?? "up"),
    writeFile(path.join(dir, "carrier"), fields.carrier ?? "1"),
    writeFile(path.join(dir, "flags"), fields.flags ?? "0x1003"),
    writeFile(path.join(dir, "address"), fields.address ?? "02:11:22:33:44:55"),
    writeFile(path.join(dir, "mtu"), fields.mtu ?? "1500"),
    writeFile(path.join(dir, "type"), fields.type ?? "1"),
  ]);
}

function createMockApp() {
  const routes = new Map();
  return {
    get(routePath, handler) { routes.set(`GET ${routePath}`, handler); },
    post(routePath, handler) { routes.set(`POST ${routePath}`, handler); },
    registered(method, routePath) { return routes.has(`${method} ${routePath}`); },
    async request(method, routePath, { body = {}, identity = null } = {}) {
      const handler = routes.get(`${method} ${routePath}`);
      if (!handler) throw new Error(`Route not registered: ${method} ${routePath}`);
      const req = { body, identity, ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" }, connection: { remoteAddress: "127.0.0.1" } };
      const res = {
        statusCode: 200,
        payload: null,
        status(code) { this.statusCode = Number(code); return this; },
        json(payload) { this.payload = payload; return this; },
      };
      await Promise.resolve(handler(req, res));
      return { statusCode: res.statusCode, payload: res.payload };
    },
  };
}

async function testPeerUrlConstruction() {
  assert.equal(buildPeerUrl({ host: "169.254.20.2", port: 3012 }), "http://169.254.20.2:3012");
  assert.equal(buildPeerUrl({ host: "fe80::1234", port: 3000 }), "http://[fe80::1234]:3000");
  assert.equal(buildPeerUrl({ host: "fe80::1234%enxabc", port: 3000 }), "http://[fe80::1234%25enxabc]:3000");
  assert.throws(() => buildPeerUrl({ host: "localhost", port: 3000 }), /localhost/);
  assert.throws(() => buildPeerUrl({ host: "169.254.20.2", port: 70000 }), /port/);
}

async function testInterfaceSelectionAndAddressDiagnostics(tmp) {
  await writeInterface(tmp, "lo", { type: "772", address: "00:00:00:00:00:00" });
  await writeInterface(tmp, "wlp1s0", { address: "02:aa:bb:cc:dd:01" });
  await writeInterface(tmp, "enx001122334455", { address: "00:11:22:33:44:55", carrier: "1" });
  await writeFile(path.join(tmp, "proc/net/route"), [
    "Iface\tDestination\tGateway\tFlags\tRefCnt\tUse\tMetric\tMask\tMTU\tWindow\tIRTT",
    "wlp1s0\t00000000\t0100A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0",
    "enx001122334455\t0014FEA9\t00000000\t0001\t0\t0\t100\t0000FFFF\t0\t0\t0",
    "",
  ].join("\n"));

  const inventory = collectNetworkInterfaceInventory({
    systemRoot: tmp,
    networkInterfaces: {
      lo: [{ family: "IPv4", address: "127.0.0.1", netmask: "255.0.0.0", internal: true }],
      wlp1s0: [{ family: "IPv4", address: "192.168.0.44", netmask: "255.255.255.0", internal: false }],
      enx001122334455: [{ family: "IPv4", address: "169.254.20.1", netmask: "255.255.0.0", internal: false }],
    },
  });
  const selected = selectLikelyWiredInterface(inventory.interfaces);
  assert.equal(selected.name, "enx001122334455");
  assert.equal(selected.appearsUsbEthernet, false);
  assert.equal(selected.ipv4Addresses[0].scope, "link-local");
  assert.equal(selected.hasDefaultRoute, false);

  const localReport = await runLocalDiagnostics({
    systemRoot: tmp,
    networkInterfaces: {
      enx001122334455: [{ family: "IPv6", address: "fe80::1234", netmask: "ffff:ffff:ffff:ffff::", internal: false }],
    },
    env: { HOST: "0.0.0.0", PORT: "65530" },
  });
  assert(localReport.results.some((result) => result.code === "WIRED_ADDRESS_MISSING"));
}

async function testRouteRegistration(tmp) {
  const app = createMockApp();
  registerPeerRoutes(app, { runtimeRoot: tmp, notebookDir: path.join(tmp, "Notebook"), port: 3000 });
  assert.equal(app.registered("GET", "/api/sync/diagnostics/ping"), true);
  assert.equal(app.registered("GET", "/api/peer/diagnostics/ping"), true);
  assert.equal(app.registered("GET", "/api/sync/capabilities"), true);
  assert.equal(app.registered("GET", "/api/peer/capabilities"), true);
  assert.equal(app.registered("POST", "/api/sync/diagnostics/peer-auth"), true);
  assert.equal(app.registered("POST", "/api/peer/diagnostics/peer-auth"), true);
  assert.equal(app.registered("POST", "/api/sync/diagnostics/capabilities"), true);
  assert.equal(app.registered("POST", "/api/peer/diagnostics/capabilities"), true);
  assert.equal(app.registered("POST", "/api/sync/diagnostics/scope-manifest-summary"), true);
  assert.equal(app.registered("POST", "/api/peer/diagnostics/scope-manifest-summary"), true);
  assert.equal(app.registered("POST", "/api/sync/diagnostics/scope-file-stream-auth"), true);
  assert.equal(app.registered("POST", "/api/peer/diagnostics/scope-file-stream-auth"), true);
  assert.equal(app.registered("POST", "/api/sync/diagnostics/scope-file-stream-push-auth"), true);
  assert.equal(app.registered("POST", "/api/peer/diagnostics/scope-file-stream-push-auth"), true);
  const ping = await app.request("GET", "/api/sync/diagnostics/ping");
  assert.equal(ping.statusCode, 200);
  assert.equal(ping.payload.ok, true);
  assert.equal(ping.payload.service, "nodevision-sync");
  assert.equal(ping.payload.identityPresent, false);
}

async function testCompareReports(tmp) {
  await fs.mkdir(tmp, { recursive: true });
  const reportA = {
    runId: "a",
    ok: true,
    results: [{ test: "peer-tcp-connectivity", status: "pass", required: true }],
    localIdentity: { deviceId: "a-device" },
    network: { selectedInterfaceName: "enxA", interfaces: [{ name: "enxA", ipv4Addresses: [{ address: "169.254.20.1", prefixLength: 16, usableForPeerUrl: true }] }] },
  };
  const reportB = {
    runId: "b",
    ok: false,
    results: [{ test: "peer-tcp-connectivity", status: "fail", code: "PEER_PORT_REFUSED", required: true }],
    localIdentity: { deviceId: "b-device" },
    network: { selectedInterfaceName: "enxB", interfaces: [{ name: "enxB", ipv4Addresses: [{ address: "169.254.20.2", prefixLength: 16, usableForPeerUrl: true }] }] },
  };
  const aPath = path.join(tmp, "a.json");
  const bPath = path.join(tmp, "b.json");
  await fs.writeFile(aPath, JSON.stringify(reportA), "utf8");
  await fs.writeFile(bPath, JSON.stringify(reportB), "utf8");
  const comparison = await compareDiagnosticReports([aPath, bPath]);
  assert.equal(comparison.ok, false);
  assert(comparison.issues.some((issue) => issue.code === "DIRECTIONAL_CONNECTIVITY_FAILURE"));
}

async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-wired-diag-test-"));
  await testPeerUrlConstruction();
  await testInterfaceSelectionAndAddressDiagnostics(path.join(tmp, "system"));
  await testRouteRegistration(path.join(tmp, "runtime"));
  await testCompareReports(path.join(tmp, "compare"));
  console.log("PASS");
}

main().catch((err) => {
  console.error("Wired sync diagnostics test failed:", err);
  process.exitCode = 1;
});
