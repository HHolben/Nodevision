// Nodevision/ApplicationSystem/Sync/test-file-push-validation.mjs
// This script validates benchmark file-push message safety rules by checking SyncTest path allow-listing, traversal/absolute-path rejection, and 64KB content-size enforcement.

import { Buffer } from "node:buffer";

import { MAX_FILE_PUSH_BYTES, validateFilePushMessage } from "./PeerFileTransfer.mjs";

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

function createMessage(relativePath, contentBase64) {
  return {
    type: "nodevision.peer.filePush",
    version: 1,
    deviceId: "peer_device_a",
    deviceName: "Peer Device A",
    timestamp: "2026-01-01T00:00:00.000Z",
    relativePath,
    contentBase64,
    contentType: "text/plain",
  };
}

async function main() {
  const validBase64 = Buffer.from("Hello SyncTest", "utf8").toString("base64");
  const valid = validateFilePushMessage(createMessage("SyncTest/hello-from-peer.txt", validBase64));
  assert(valid.relativePath === "SyncTest/hello-from-peer.txt", "Expected valid SyncTest path to pass");

  expectThrow("relative traversal path", () => {
    validateFilePushMessage(createMessage("../evil.txt", validBase64));
  });

  expectThrow("absolute path", () => {
    validateFilePushMessage(createMessage("/absolute/path", validBase64));
  });

  expectThrow("nested traversal path", () => {
    validateFilePushMessage(createMessage("SyncTest/../evil.txt", validBase64));
  });

  const oversizedBase64 = Buffer.alloc(MAX_FILE_PUSH_BYTES + 1, 0x61).toString("base64");
  expectThrow("oversized content", () => {
    validateFilePushMessage(createMessage("SyncTest/too-large.txt", oversizedBase64));
  });

  console.log("PASS");
}

main().catch((err) => {
  console.error("File push validation test failed:", err);
  process.exitCode = 1;
});
