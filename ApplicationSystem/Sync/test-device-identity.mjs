// Nodevision/ApplicationSystem/Sync/test-device-identity.mjs
// This script validates identity bootstrap and deterministic message signing by checking canonical JSON stability, malformed-value rejection, and local signature verification.

import {
  canonicalizeMessage,
  ensureDeviceIdentity,
  signMessage,
  verifyMessage,
} from "./DeviceIdentity.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(label, fn) {
  let didThrow = false;
  try {
    fn();
  } catch {
    didThrow = true;
  }
  assert(didThrow, `${label} should throw`);
}

async function main() {
  const identity = await ensureDeviceIdentity();

  console.log(`deviceId: ${identity.deviceId}`);
  console.log(`deviceName: ${identity.deviceName}`);
  console.log(`publicKeyPath: ${identity.publicKeyPath}`);

  const hello = {
    type: "nodevision.peer.hello",
    version: 1,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: new Date().toISOString(),
  };

  const { payload, signatureBase64 } = await signMessage(hello);
  const verified = await verifyMessage(payload, signatureBase64, identity.publicKey);
  assert(verified, "Signature verification failed");

  const a = { b: 2, a: 1 };
  const b = { a: 1, b: 2 };
  assert(canonicalizeMessage(a) === canonicalizeMessage(b), "Flat key order canonicalization mismatch");

  const c = { z: { b: 2, a: 1 }, a: [{ d: 4, c: 3 }] };
  const d = { a: [{ c: 3, d: 4 }], z: { a: 1, b: 2 } };
  assert(canonicalizeMessage(c) === canonicalizeMessage(d), "Nested canonicalization mismatch");

  expectThrow("NaN", () => canonicalizeMessage({ bad: NaN }));
  expectThrow("undefined inside object", () => canonicalizeMessage({ bad: undefined }));
  expectThrow("function value", () => canonicalizeMessage({ bad: () => "x" }));

  console.log("PASS");
}

main().catch((err) => {
  console.error("Identity test failed:", err);
  process.exitCode = 1;
});
