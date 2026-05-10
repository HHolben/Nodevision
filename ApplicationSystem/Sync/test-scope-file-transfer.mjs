// Nodevision/ApplicationSystem/Sync/test-scope-file-transfer.mjs
// This script validates scoped transfer message/path guards and scope confinement checks.

import { Buffer } from "node:buffer";

import { validateScopeFileRequestMessage, validateScopeFilePushMessage, validateScopedRelativePath } from "./ScopePeerSync.mjs";

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

console.log("PASS");
