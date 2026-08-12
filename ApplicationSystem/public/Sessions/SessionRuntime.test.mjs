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
      if (id === "viewer.currentFile") return { path: "Notebook/Test.html" };
      if (id === "test.echo") return args[0];
      return { ok: true };
    },
    async wait(name) {
      calls.push({ type: "wait", name });
      return { value: "continue", input: "abc" };
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

{
  const context = makeContext();
  const runtime = new SessionRuntime(`
let current = run("viewer.currentFile");
let response = wait("overlay.submitted");
if (response.value === "continue" && response.input.length === 3 && current.path === "Notebook/Test.html") {
  run("overlay.show", current.path);
}
`, context);
  await runtime.start();
  assert.equal(runtime.state.current.path, "Notebook/Test.html");
  assert.equal(runtime.state.response.input, "abc");
  assert.equal(context.calls.at(-1).id, "overlay.show");
}

{
  const context = makeContext();
  context.run = async (id, args, runtime) => {
    context.calls.push({ type: "run", id, args });
    if (id === "session.quit") runtime.abort();
    return { ok: true };
  };
  const runtime = new SessionRuntime(`
run("session.quit");
run("overlay.show", "after quit");
`, context);
  await assert.rejects(runtime.start(), (err) => err.code === "SESSION_STOPPED");
  assert.equal(context.calls.length, 1);
}

console.log("SessionRuntime tests passed.");
