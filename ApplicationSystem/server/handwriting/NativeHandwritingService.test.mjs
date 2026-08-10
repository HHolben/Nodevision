// Nodevision/ApplicationSystem/server/handwriting/NativeHandwritingService.test.mjs
// This file tests the experimental native handwriting process boundary with controlled fixture executables instead of requiring the real C++ binary.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createNativeHandwritingService } from "./NativeHandwritingService.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "nv-native-handwriting-"));
const ctx = {
  runtimeRoot: root,
  applicationSystemRoot: path.join(root, "ApplicationSystem"),
};
await fs.mkdir(ctx.applicationSystemRoot, { recursive: true });

function payload() {
  return {
    requestId: "hw-node-test",
    canvas: { width: 600, height: 240 },
    strokes: [
      { pointerType: "pen", points: [{ x: 10, y: 20, time: 0, pressure: 0.5 }, { x: 50, y: 80, time: 12, pressure: 0.5 }] },
    ],
    options: { candidateLimit: 3 },
  };
}

async function fixture(name, body) {
  const file = path.join(root, name);
  await fs.writeFile(file, `#!${process.execPath}\n${body}\n`, "utf8");
  await fs.chmod(file, 0o755);
  return file;
}

function serviceFor(executablePath, settings = {}) {
  return createNativeHandwritingService(ctx, {
    allowedExecutableRoots: [root],
    settings: { enabled: true, executablePath, timeoutMs: 400, candidateLimit: 3, ...settings },
  });
}

const validFixture = await fixture("valid-native.mjs", `
import fs from "node:fs";
if (process.argv[2] === "--capabilities") {
  console.log(JSON.stringify({ name: "fixture", version: "0.test", protocolVersion: 1 }));
  process.exit(0);
}
const req = JSON.parse(fs.readFileSync(0, "utf8"));
console.error("diagnostic only");
console.log(JSON.stringify({
  protocolVersion: 1,
  requestId: req.requestId,
  ok: true,
  engine: { name: "fixture", version: "0.test" },
  result: { text: "A", confidence: 0.8, candidates: [{ text: "A", confidence: 0.8 }], normalizedBounds: { x: 0, y: 0, width: 1, height: 1 } },
  warnings: []
}));
`);

{
  const disabled = createNativeHandwritingService(ctx, { settings: { enabled: false } });
  const result = await disabled.recognize(payload());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "NATIVE_UNAVAILABLE");
}

{
  const missing = serviceFor(path.join(root, "missing"));
  const result = await missing.recognize(payload());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "NATIVE_UNAVAILABLE");
}

{
  const service = serviceFor(validFixture);
  const status = await service.status({ force: true });
  assert.equal(status.available, true);
  const result = await service.recognize(payload());
  assert.equal(result.ok, true);
  assert.equal(result.result.text, "A");

  const invalidTimePayload = payload();
  invalidTimePayload.strokes[0].points[0].time = -1;
  const invalidTime = await service.recognize(invalidTimePayload);
  assert.equal(invalidTime.ok, false);
  assert.equal(invalidTime.error.code, "INVALID_STROKES");
}

const malformedFixture = await fixture("malformed-native.mjs", `
if (process.argv[2] === "--capabilities") console.log(JSON.stringify({ version: "x", protocolVersion: 1 }));
else console.log("not json");
`);

{
  const result = await serviceFor(malformedFixture).recognize(payload());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_NATIVE_RESPONSE");
}

const mismatchFixture = await fixture("mismatch-native.mjs", `
if (process.argv[2] === "--capabilities") console.log(JSON.stringify({ version: "x", protocolVersion: 1 }));
else console.log(JSON.stringify({ protocolVersion: 1, requestId: "wrong", ok: true, result: { text: "A", confidence: 0.7, candidates: [] } }));
`);

{
  const result = await serviceFor(mismatchFixture).recognize(payload());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_NATIVE_RESPONSE");
}

const timeoutFixture = await fixture("timeout-native.mjs", `
if (process.argv[2] === "--capabilities") console.log(JSON.stringify({ version: "x", protocolVersion: 1 }));
else setTimeout(() => {}, 2000);
`);

{
  const result = await serviceFor(timeoutFixture, { timeoutMs: 120 }).recognize(payload());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "NATIVE_TIMEOUT");
}

const exitFixture = await fixture("exit-native.mjs", `
if (process.argv[2] === "--capabilities") console.log(JSON.stringify({ version: "x", protocolVersion: 1 }));
else process.exit(9);
`);

{
  const result = await serviceFor(exitFixture).recognize(payload());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "RECOGNITION_FAILED");
}

const oversizedFixture = await fixture("oversized-native.mjs", `
if (process.argv[2] === "--capabilities") console.log(JSON.stringify({ version: "x", protocolVersion: 1 }));
else process.stdout.write("x".repeat(600 * 1024));
`);

{
  const result = await serviceFor(oversizedFixture).recognize(payload());
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_NATIVE_RESPONSE");
}

console.log("Native handwriting service tests passed");
