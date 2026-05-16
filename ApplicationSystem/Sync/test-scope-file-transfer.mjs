// Nodevision/ApplicationSystem/Sync/test-scope-file-transfer.mjs
// This script validates scoped transfer message/path guards and scope confinement checks.

import { Buffer } from "node:buffer";

import {
  validateScopeFileRequestMessage,
  validateScopeFilePushMessage,
  validateScopeFileStreamPushMessage,
  validateScopedRelativePath,
} from "./ScopePeerSync.mjs";

const assert = (c, m) => { if (!c) throw new Error(m); };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

const base = { deviceId: "a", deviceName: "b", timestamp: new Date().toISOString(), scope: "Shared", version: 1 };

assert(validateScopedRelativePath("Shared/example.md", "Shared") === "Shared/example.md", "valid path");
assert(throws(() => validateScopedRelativePath("../evil", "Shared")), "reject traversal");
assert(throws(() => validateScopedRelativePath("/abs", "Shared")), "reject absolute");
assert(throws(() => validateScopedRelativePath("SyncTest/file.txt", "Shared")), "reject outside scope");

const req = validateScopeFileRequestMessage({ ...base, type: "nodevision.peer.scopeFileRequest", relativePath: "Shared/example.md" });
assert(req.scope === "Shared", "request scope");

const push = validateScopeFilePushMessage({ ...base, type: "nodevision.peer.scopeFilePush", relativePath: "Shared/example.md", contentBase64: Buffer.from("hello").toString("base64") });
assert(push.relativePath === "Shared/example.md", "push path");
const zeroPush = validateScopeFilePushMessage({ ...base, type: "nodevision.peer.scopeFilePush", relativePath: "Shared/empty.txt", contentBase64: "" });
assert(zeroPush.contentBase64 === "", "zero-byte base64 payload allowed");

const streamPush = validateScopeFileStreamPushMessage({
  ...base,
  type: "nodevision.peer.scopeFileStreamPush",
  relativePath: "Shared/example.md",
  size: 5,
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
});
assert(streamPush.relativePath === "Shared/example.md", "stream push path");
assert(streamPush.size === 5, "stream push size");
assert(streamPush.sha256.length === 64, "stream push sha");
assert(throws(() => validateScopeFileStreamPushMessage({ ...base, type: "nodevision.peer.scopeFileStreamPush", relativePath: "Shared/example.md", size: -1, sha256: "a".repeat(64) })), "reject negative stream size");
assert(throws(() => validateScopeFileStreamPushMessage({ ...base, type: "nodevision.peer.scopeFileStreamPush", relativePath: "Shared/example.md", size: 1, sha256: "xyz" })), "reject invalid stream sha");

console.log("PASS");
