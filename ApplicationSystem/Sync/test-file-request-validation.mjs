// Nodevision/ApplicationSystem/Sync/test-file-request-validation.mjs
// This script validates signed file-request path constraints by confirming SyncTest-relative paths pass while traversal, absolute, and backslash paths are rejected.

import { validateFileRequestMessage } from "./PeerFileTransfer.mjs";

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

function createMessage(relativePath) {
  return {
    type: "nodevision.peer.fileRequest",
    version: 1,
    deviceId: "peer_request_test",
    deviceName: "Peer Request Test",
    timestamp: "2026-01-01T00:00:00.000Z",
    relativePath,
  };
}

async function main() {
  const valid = validateFileRequestMessage(createMessage("SyncTest/example.txt"));
  assert(valid.relativePath === "SyncTest/example.txt", "Expected valid SyncTest path to pass");

  expectThrow("relative traversal path", () => {
    validateFileRequestMessage(createMessage("../evil.txt"));
  });

  expectThrow("absolute path", () => {
    validateFileRequestMessage(createMessage("/absolute/path"));
  });

  expectThrow("nested traversal path", () => {
    validateFileRequestMessage(createMessage("SyncTest/../evil.txt"));
  });

  expectThrow("backslash path", () => {
    validateFileRequestMessage(createMessage("SyncTest\\evil.txt"));
  });

  console.log("PASS");
}

main().catch((err) => {
  console.error("File request validation test failed:", err);
  process.exitCode = 1;
});
