// Nodevision/ApplicationSystem/public/Sessions/SessionCommandAdapter.test.mjs
// This test validates that Sessions execute shared commands only through the explicit Session-safe adapter.

import assert from "node:assert/strict";
import { registerNodevisionCommand } from "../Commands/NodevisionCommandRegistry.mjs";
import {
  getNodevisionCommandDefinitions,
  runNodevisionCommand,
  searchNodevisionCommands,
} from "./SessionCommandAdapter.mjs";

registerNodevisionCommand({
  id: "adapter.safe",
  label: "Adapter Safe",
  description: "Test safe command.",
  sessionSafe: true,
  arguments: [{ name: "value", type: "string", required: true }],
}, ([value]) => ({ ok: true, value }));

registerNodevisionCommand({
  id: "adapter.unsafe",
  label: "Adapter Unsafe",
  description: "Test unsafe command.",
  sessionSafe: false,
  arguments: [],
}, () => ({ ok: true }));

const commands = getNodevisionCommandDefinitions();
const overlay = commands.find((entry) => entry.id === "overlay.show");
const focus = commands.find((entry) => entry.id === "htmlDraftFocus.open");
const sectionals = commands.find((entry) => entry.id === "sectionals.update");

assert.equal(overlay?.sessionSafe, true);
assert.equal(overlay?.arguments?.[0]?.name, "message");
assert.equal(focus?.sessionSafe, true);
assert.equal(sectionals?.sessionSafe, true);
assert.ok(searchNodevisionCommands("overlay").some((entry) => entry.id === "overlay.show"));
assert.deepEqual(await runNodevisionCommand("adapter.safe", ["ok"], {}), { ok: true, value: "ok" });
await assert.rejects(runNodevisionCommand("adapter.unsafe", [], {}), (err) => err.code === "COMMAND_NOT_SESSION_SAFE");
await assert.rejects(runNodevisionCommand("nope.missing", [], {}), (err) => err.code === "UNKNOWN_COMMAND");

console.log("SessionCommandAdapter tests passed.");
