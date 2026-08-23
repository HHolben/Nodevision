// Nodevision/ApplicationSystem/routes/api/scad.test.mjs
// This test verifies SCAD STL rendering route behavior with a configured OpenSCAD executable.

import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import createSCADRouter from "./scad.js";

async function makeContext() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scad-route-"));
  const ctx = {
    runtimeRoot: root,
    applicationSystemRoot: path.join(root, "ApplicationSystem"),
    cacheDir: path.join(root, "cache"),
  };
  await fs.mkdir(ctx.applicationSystemRoot, { recursive: true });
  await fs.mkdir(ctx.cacheDir, { recursive: true });
  return ctx;
}

async function writeFakeOpenSCAD(root) {
  const bin = path.join(root, "fake-openscad.mjs");
  const source = `#!${process.execPath}
import fs from "node:fs/promises";

const outputFlag = process.argv.indexOf("-o");
if (outputFlag < 0 || !process.argv[outputFlag + 1] || !process.argv[outputFlag + 2]) {
  console.error("missing output or input path");
  process.exit(2);
}

const outputPath = process.argv[outputFlag + 1];
const inputPath = process.argv[outputFlag + 2];
const scad = await fs.readFile(inputPath, "utf8");
if (!scad.includes("cube")) {
  console.error("unexpected SCAD source");
  process.exit(3);
}
await fs.writeFile(outputPath, "solid fake\\nendsolid fake\\n", "utf8");
`;
  await fs.writeFile(bin, source, "utf8");
  await fs.chmod(bin, 0o755);
  return bin;
}

async function startApp(ctx, identity = { id: "tester" }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (identity) req.identity = identity;
    next();
  });
  app.use("/api", createSCADRouter(ctx));
  const server = await new Promise((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function postRender(baseUrl, scadCode = "cube(1);") {
  return fetch(baseUrl + "/api/scad/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scadCode, format: "stl" }),
  });
}

async function testConfiguredOpenSCADRender() {
  const ctx = await makeContext();
  ctx.openscadBin = await writeFakeOpenSCAD(ctx.runtimeRoot);
  const { server, baseUrl } = await startApp(ctx);
  try {
    const response = await postRender(baseUrl);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /application\/sla/);
    assert.equal(await response.text(), "solid fake\nendsolid fake\n");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(ctx.runtimeRoot, { recursive: true, force: true });
  }
}

async function testMissingConfiguredOpenSCAD() {
  const ctx = await makeContext();
  ctx.openscadBin = path.join(ctx.runtimeRoot, "missing-openscad");
  const { server, baseUrl } = await startApp(ctx);
  try {
    const response = await postRender(baseUrl);
    const json = await response.json();
    assert.equal(response.status, 503);
    assert.equal(json.error, "OpenSCAD CLI not found.");
    assert.match(json.hint, /Configured OpenSCAD command/);
    assert.match(json.hint, /NODEVISION_OPENSCAD_BIN/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(ctx.runtimeRoot, { recursive: true, force: true });
  }
}

await testConfiguredOpenSCADRender();
await testMissingConfiguredOpenSCAD();
console.log("SCAD route tests passed.");
