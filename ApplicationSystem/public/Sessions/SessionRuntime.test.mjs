// Nodevision/ApplicationSystem/public/Sessions/SessionRuntime.test.mjs
// This test validates the constrained Nodevision Session parser and runtime without requiring the browser or ordinary Nodevision panels.

import assert from "node:assert/strict";
import { SessionRuntime } from "./SessionRuntime.mjs";
import { parseSessionScript } from "./SessionScriptParser.mjs";

function makeContext() {
  const calls = [];
  return {
    calls,
    async run(id, args) {
      calls.push({ type: "run", id, args });
      return { ok: true };
    },
    async wait(name) {
      calls.push({ type: "wait", name });
      return { ok: true };
    },
    cleanup() {},
  };
}

{
  const ast = parseSessionScript('let count = 1;\nrun("overlay.show", "Hi");');
  assert.equal(ast.body.length, 2);
}

{
  assert.throws(() => parseSessionScript("drawText('No parallel UI');"), /Unsupported Session statement/);
}

{
  const context = makeContext();
  const runtime = new SessionRuntime(`
let count = 0;
count += 1;
if (count === 1) {
  run("overlay.show", "ok");
}
wait("session.continue");
`, context);
  await runtime.start();
  assert.equal(runtime.state.count, 1);
  assert.deepEqual(context.calls.map((call) => call.type), ["run", "wait"]);
  assert.equal(context.calls[0].id, "overlay.show");
}

{
  const context = makeContext();
  const runtime = new SessionRuntime(`
let count = 0;
while (count < 3) {
  count += 1;
}
run("overlay.show", count);
`, context);
  await runtime.start();
  assert.equal(context.calls[0].args[0], 3);
}

console.log("SessionRuntime tests passed.");

