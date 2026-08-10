// Nodevision/ApplicationSystem/public/Sessions/SessionCommandAdapter.test.mjs
// This test validates that the Nodevision Session command registry exposes audited Session commands while preserving console command metadata separately.

import assert from "node:assert/strict";
import { getNodevisionCommandDefinitions, searchNodevisionCommands } from "./SessionCommandAdapter.mjs";

const commands = getNodevisionCommandDefinitions();
const overlay = commands.find((entry) => entry.id === "overlay.show");
const consoleState = commands.find((entry) => entry.id === "console.show-state");

const focus = commands.find((entry) => entry.id === "htmlDraftFocus.open");

assert.equal(overlay?.sessionSafe, true);
assert.deepEqual(overlay?.arguments, ["message"]);
assert.equal(focus?.sessionSafe, true);
assert.equal(consoleState?.sessionSafe, false);
assert.ok(consoleState?.consoleCommand);
assert.ok(searchNodevisionCommands("overlay").some((entry) => entry.id === "overlay.show"));

console.log("SessionCommandAdapter tests passed.");

