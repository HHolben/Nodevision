// Nodevision/ApplicationSystem/Sessions/SessionRegistry.test.mjs
// This test validates Nodevision Session storage boundaries, exact file recognition, and built-in versus user-owned Session listing.

import assert from "node:assert/strict";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createUserSession, listSessions, readSession, saveUserSession } from "./SessionRegistry.mjs";
import { isSessionFilename, normalizeSessionId } from "./SessionPaths.mjs";

const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), "nodevision-sessions-"));
const ctx = {
  runtimeRoot: root,
  applicationSystemRoot: path.join(root, "ApplicationSystem"),
  notebookDir: path.join(root, "Notebook"),
  userDataDir: path.join(root, "UserData"),
};
await fsPromises.mkdir(path.join(ctx.applicationSystemRoot, "Sessions", "BuiltIn"), { recursive: true });
await fsPromises.mkdir(ctx.notebookDir, { recursive: true });

await fsPromises.writeFile(
  path.join(ctx.applicationSystemRoot, "Sessions", "BuiltIn", "Demo.NodevisionSession"),
  '// @title Demo\nrun("overlay.show", "Demo");\n',
);

assert.equal(isSessionFilename("Demo.NodevisionSession"), true);
assert.equal(isSessionFilename("HTMLdraftFocus.NodevisionSession.js"), true);
assert.equal(isSessionFilename("Demo.nodevisionsession"), false);
assert.equal(isSessionFilename("Legacy.NodevisionTemplate"), false);
assert.throws(() => normalizeSessionId("../Demo.NodevisionSession"), /unsafe path/);

const listed = await listSessions(ctx);
assert.equal(listed.builtIn.length, 1);
assert.equal(listed.builtIn[0].readOnly, true);

const created = await createUserSession({ name: "My Session" }, ctx);
assert.equal(created.scope, "user");
assert.ok(created.id.endsWith(".NodevisionSession"));

const saved = await saveUserSession(created.id, '// @title Changed\nlet x = 1;\n', ctx);
assert.equal(saved.title, "Changed");

const readBack = await readSession("user", created.id, ctx);
assert.match(readBack.source, /let x = 1/);

console.log("SessionRegistry tests passed.");

