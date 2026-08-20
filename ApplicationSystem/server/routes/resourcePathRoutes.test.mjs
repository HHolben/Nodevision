// Nodevision/ApplicationSystem/server/routes/resourcePathRoutes.test.mjs
// This test file verifies authenticated HTTP access to Resource Paths settings and Notebook directory browsing.

import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerResourcePathRoutes } from "./resourcePathRoutes.mjs";

async function makeContext() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-resource-routes-"));
  const ctx = {
    runtimeRoot: root,
    notebookDir: path.join(root, "Notebook"),
    userSettingsDir: path.join(root, "UserSettings"),
  };
  await fs.mkdir(path.join(ctx.notebookDir, "Resources", "Fonts"), { recursive: true });
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  return ctx;
}

async function startApp(ctx, identity = { id: "tester" }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (identity) req.identity = identity;
    next();
  });
  registerResourcePathRoutes(app, ctx);
  const server = await new Promise((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function requestJson(baseUrl, pathName, options = {}) {
  const response = await fetch(baseUrl + pathName, options);
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function testAuthenticatedRoutes() {
  const ctx = await makeContext();
  const { server, baseUrl } = await startApp(ctx);
  try {
    let result = await requestJson(baseUrl, "/api/resource-paths");
    assert.equal(result.response.status, 200);
    assert(result.json.resourcePaths.some((entry) => entry.key === "fonts"));

    result = await requestJson(baseUrl, "/api/resource-paths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourcePaths: [{ key: "project.media", name: "Project Media", path: "Resources/Media" }] }),
    });
    assert.equal(result.response.status, 200);
    assert(result.json.resourcePaths.some((entry) => entry.key === "project.media"));

    result = await requestJson(baseUrl, "/api/resource-paths/browse?path=Resources");
    assert.equal(result.response.status, 200);
    assert(result.json.directories.some((entry) => entry.path === "Resources/Fonts"));

    result = await requestJson(baseUrl, "/api/resource-paths/fonts");
    assert.equal(result.json.resourcePath.exists, true);
    assert.equal(result.json.resourcePath.path, "Resources/Fonts");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function testAuthAndTraversalRejection() {
  const ctx = await makeContext();
  let running = await startApp(ctx, null);
  try {
    const result = await requestJson(running.baseUrl, "/api/resource-paths");
    assert.equal(result.response.status, 401);
  } finally {
    await new Promise((resolve) => running.server.close(resolve));
  }

  running = await startApp(ctx);
  try {
    const result = await requestJson(running.baseUrl, "/api/resource-paths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourcePaths: [{ key: "bad.path", name: "Bad", path: "../../outside" }] }),
    });
    assert.equal(result.response.status, 400);
    assert.match(result.json.error, /traversal/i);
  } finally {
    await new Promise((resolve) => running.server.close(resolve));
  }
}

await testAuthenticatedRoutes();
await testAuthAndTraversalRejection();
console.log("Resource Paths route tests passed.");
