// Nodevision/ApplicationSystem/public/Commands/NodevisionCommandRegistry.test.mjs
// This test validates shared Nodevision command registration, metadata discovery, validation, dispatch, and console glossary export.

import assert from "node:assert/strict";
import { getNodevisionConsoleCommands } from "../NodevisionConsoleCommands.mjs";
import { dispatchNodevisionCommand } from "./NodevisionCommandDispatcher.mjs";
import {
  getConsoleCommandDefinitions,
  getNodevisionCommandDefinition,
  getSessionSafeCommandDefinitions,
  registerNodevisionCommand,
  searchNodevisionCommands,
} from "./NodevisionCommandRegistry.mjs";

registerNodevisionCommand({
  id: "test.echo",
  label: "Echo",
  description: "Return the first argument.",
  sessionSafe: true,
  arguments: [{ name: "value", type: "string", required: true }],
}, ([value]) => value);

registerNodevisionCommand({
  id: "test.path",
  label: "Path",
  description: "Return a normalized Notebook path.",
  sessionSafe: true,
  arguments: [{ name: "path", type: "notebookPath", required: true }],
}, ([path]) => path);

registerNodevisionCommand({ id: "test.unsafe", label: "Unsafe", sessionSafe: false, arguments: [] }, () => true);
registerNodevisionCommand({ id: "test.fail", label: "Fail", sessionSafe: true, arguments: [] }, () => { throw new Error("boom"); });

assert.equal(getNodevisionCommandDefinition("overlay.show")?.sessionSafe, true);
assert.ok(getSessionSafeCommandDefinitions().some((entry) => entry.id === "test.echo"));
assert.ok(searchNodevisionCommands("overlay").some((entry) => entry.id === "overlay.show"));
assert.equal(await dispatchNodevisionCommand("test.echo", ["hello"], { requireSessionSafe: true }), "hello");
assert.equal(await dispatchNodevisionCommand("test.path", ["Notebook/Docs/a.txt"], { requireSessionSafe: true }), "Docs/a.txt");
await assert.rejects(
  dispatchNodevisionCommand("test.path", ["../../outside"], { requireSessionSafe: true }),
  /may not contain \.\./,
);
await assert.rejects(
  dispatchNodevisionCommand("test.unsafe", [], { requireSessionSafe: true }),
  (err) => err.code === "COMMAND_NOT_SESSION_SAFE",
);
await assert.rejects(
  dispatchNodevisionCommand("missing.command", [], { requireSessionSafe: true }),
  (err) => err.code === "UNKNOWN_COMMAND",
);
await assert.rejects(
  dispatchNodevisionCommand("test.fail", [], { requireSessionSafe: true }),
  (err) => err.code === "COMMAND_EXECUTION_FAILED" && /test.fail/.test(err.message),
);
assert.ok(getConsoleCommandDefinitions().some((entry) => entry.id === "overlay.show" && entry.consoleCommand));
assert.ok(getNodevisionConsoleCommands().some((entry) => entry.id === "show-state"));
assert.ok(getNodevisionConsoleCommands().some((entry) => entry.id === "shared-overlay.show"));

console.log("NodevisionCommandRegistry tests passed.");
