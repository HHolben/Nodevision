// Nodevision/ApplicationSystem/Sync/test-peer-discovery.mjs
// This script validates discovery beacon signing, trust classification, self-beacon filtering, advertised-port handling, malformed datagram safety, post-bind socket option setup, and dedupe semantics without exposing private-key or notebook metadata.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";

import { ensureDeviceIdentity } from "./DeviceIdentity.mjs";
import { addTrustedPeer } from "./TrustedPeers.mjs";
import {
  applyDiscoverySocketOptionsAfterBind,
  createDiscoveryBeacon,
  createDiscoveryDeduper,
  isSelfDiscoveryBeacon,
  normalizeDiscoveredPeer,
  parseAndVerifyDiscoveryDatagram,
  verifyDiscoveryBeacon,
} from "./PeerDiscovery.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mutateSignature(signatureBase64) {
  const last = signatureBase64.at(-1);
  const replacement = last === "A" ? "B" : "A";
  return `${signatureBase64.slice(0, -1)}${replacement}`;
}

async function main() {
  const senderRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-discovery-sender-"));
  const trustedVerifierRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-discovery-trusted-"));
  const unknownVerifierRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-discovery-unknown-"));

  const senderIdentity = await ensureDeviceIdentity({
    runtimeRoot: senderRoot,
    deviceId: "nv_dev_sender_discovery",
    deviceName: "sender-discovery",
  });
  await ensureDeviceIdentity({
    runtimeRoot: trustedVerifierRoot,
    deviceId: "nv_dev_receiver_trusted",
    deviceName: "receiver-trusted",
  });
  await ensureDeviceIdentity({
    runtimeRoot: unknownVerifierRoot,
    deviceId: "nv_dev_receiver_unknown",
    deviceName: "receiver-unknown",
  });

  await addTrustedPeer({
    deviceId: senderIdentity.deviceId,
    deviceName: senderIdentity.deviceName,
    publicKey: senderIdentity.publicKey,
  }, {
    runtimeRoot: trustedVerifierRoot,
  });

  const originalEnvPort = process.env.PORT;
  process.env.PORT = "3001";
  const envPortBeacon = await createDiscoveryBeacon({
    runtimeRoot: senderRoot,
    timestamp: "2026-05-09T21:30:00.000Z",
    capabilities: { sync: true, conflictResolution: true },
  });
  if (originalEnvPort === undefined) delete process.env.PORT;
  else process.env.PORT = originalEnvPort;

  const trustedVerification = await verifyDiscoveryBeacon(envPortBeacon, {
    runtimeRoot: trustedVerifierRoot,
  });
  assert(trustedVerification.ok === true, "Expected valid trusted beacon verification");
  assert(trustedVerification.trusted === true, "Expected trusted peer classification");
  assert(trustedVerification.peer?.deviceId === senderIdentity.deviceId, "Expected trusted peer deviceId");
  assert(trustedVerification.message.port === 3001, "Expected process.env.PORT advertised port");

  const unknownVerification = await verifyDiscoveryBeacon(envPortBeacon, {
    runtimeRoot: unknownVerifierRoot,
  });
  assert(unknownVerification.ok === true, "Expected unknown beacon to remain visible");
  assert(unknownVerification.trusted === false, "Expected unknown peer classification");
  assert(unknownVerification.peer === null, "Expected no trusted peer object for unknown peer");

  const badSignatureResult = await verifyDiscoveryBeacon({
    payload: envPortBeacon.payload,
    signatureBase64: mutateSignature(envPortBeacon.signatureBase64),
  }, {
    runtimeRoot: trustedVerifierRoot,
  });
  assert(badSignatureResult.ok === false, "Expected invalid signature rejection for trusted peer");

  const malformedPayloadResult = await verifyDiscoveryBeacon({
    payload: "{ this-is-not-json }",
    signatureBase64: envPortBeacon.signatureBase64,
  }, {
    runtimeRoot: trustedVerifierRoot,
  });
  assert(malformedPayloadResult.ok === false, "Expected malformed payload rejection");

  const malformedDatagramResult = await parseAndVerifyDiscoveryDatagram(
    Buffer.from("{bad-json", "utf8"),
    { runtimeRoot: trustedVerifierRoot },
  );
  assert(malformedDatagramResult.ok === false, "Expected malformed datagram rejection");

  const normalized = normalizeDiscoveredPeer(
    { ...trustedVerification.message, trusted: trustedVerification.trusted },
    { address: "192.168.1.42", port: 39000 },
  );
  assert(normalized.deviceId === senderIdentity.deviceId, "normalizeDiscoveredPeer deviceId mismatch");
  assert(normalized.deviceName === senderIdentity.deviceName, "normalizeDiscoveredPeer deviceName mismatch");
  assert(normalized.trusted === true, "normalizeDiscoveredPeer trusted mismatch");
  assert(normalized.address === "192.168.1.42", "normalizeDiscoveredPeer address mismatch");
  assert(normalized.port === 3001, "normalizeDiscoveredPeer must use advertised beacon port");
  assert(normalized.capabilities.sync === true, "normalizeDiscoveredPeer sync capability mismatch");
  assert(normalized.capabilities.conflictResolution === true, "normalizeDiscoveredPeer conflict capability mismatch");
  assert(!path.isAbsolute(normalized.deviceId), "normalizeDiscoveredPeer must not contain absolute paths");

  const deduper = createDiscoveryDeduper({ ttlMs: 5_000 });
  assert(deduper.shouldEmit({
    deviceId: senderIdentity.deviceId,
    address: "192.168.1.42",
    port: 3001,
    trusted: true,
    capabilities: { sync: true, conflictResolution: true },
  }, 1_000) === true, "Expected first peer event to emit");
  assert(deduper.shouldEmit({
    deviceId: senderIdentity.deviceId,
    address: "192.168.1.42",
    port: 3001,
    trusted: true,
    capabilities: { sync: true, conflictResolution: true },
  }, 2_000) === false, "Expected repeated beacon suppression");
  assert(deduper.shouldEmit({
    deviceId: senderIdentity.deviceId,
    address: "192.168.1.42",
    port: 3011,
    trusted: true,
    capabilities: { sync: true, conflictResolution: true },
  }, 2_500) === true, "Expected advertised-port change to re-emit");
  assert(deduper.shouldEmit({
    deviceId: senderIdentity.deviceId,
    address: "192.168.1.42",
    port: 3011,
    trusted: false,
    capabilities: { sync: true, conflictResolution: true },
  }, 3_000) === true, "Expected trusted-state change to re-emit");
  assert(deduper.shouldEmit({
    deviceId: senderIdentity.deviceId,
    address: "192.168.1.42",
    port: 3011,
    trusted: false,
    capabilities: { sync: false, conflictResolution: true },
  }, 3_500) === true, "Expected capability change to re-emit");
  assert(deduper.shouldEmit({
    deviceId: senderIdentity.deviceId,
    address: "192.168.1.42",
    port: 3011,
    trusted: false,
    capabilities: { sync: false, conflictResolution: true },
  }, 4_000) === false, "Expected unchanged peer to stay suppressed");

  const socketCallOrder = [];
  const mockSocket = {
    setBroadcast() {
      socketCallOrder.push("setBroadcast");
    },
    setMulticastTTL() {
      socketCallOrder.push("setMulticastTTL");
    },
    setMulticastLoopback() {
      socketCallOrder.push("setMulticastLoopback");
    },
    addMembership() {
      socketCallOrder.push("addMembership");
    },
  };
  applyDiscoverySocketOptionsAfterBind(mockSocket, {
    multicastGroup: "239.255.255.250",
    context: "test",
    debug: false,
  });
  assert(
    socketCallOrder.join(",") === "setBroadcast,setMulticastTTL,setMulticastLoopback,addMembership",
    "Expected post-bind multicast option call order",
  );
  assert(
    isSelfDiscoveryBeacon("nv_dev_receiver_trusted", "nv_dev_receiver_trusted") === true,
    "Expected self-beacon helper to detect local device",
  );
  assert(
    isSelfDiscoveryBeacon("nv_dev_receiver_trusted", senderIdentity.deviceId) === false,
    "Expected self-beacon helper to ignore remote device",
  );

  console.log("PASS");
}

main().catch((err) => {
  console.error("Peer discovery test failed:", err);
  process.exitCode = 1;
});
