// Nodevision/ApplicationSystem/server/routes/graphExtras.test.mjs
// This test verifies batched graph edge persistence groups target buckets and maintains the disposable by-source index.

import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerGraphExtras } from "./graphExtras.mjs";

async function startApp(sharedDataDir) {
  const app = express();
  app.use(express.json());
  registerGraphExtras(app, { sharedDataDir });
  const server = await new Promise((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function postJson(baseUrl, body) {
  const response = await fetch(baseUrl + "/api/graph/save-edges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function readBucket(sharedDataDir, bucket, { bySource = false } = {}) {
  const parts = bySource ? [sharedDataDir, "edges", "by-source", bucket + ".json"] : [sharedDataDir, "edges", bucket + ".json"];
  const text = await fs.readFile(path.join(...parts), "utf8");
  return JSON.parse(text);
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-graph-extras-"));
const sharedDataDir = path.join(root, "public", "data");
const { server, baseUrl } = await startApp(sharedDataDir);
const seedEdges = [
  { source: "Beta.md", target: "Alpha.md", label: "Beta incoming" },
  { source: "Gamma.md", target: "Alpha.md", label: "Gamma incoming" },
  { source: "Alpha.md", target: "Zebra.md", label: "Z outgoing" },
  { source: "Alpha.md", target: "Yankee.md", label: "Y outgoing" },
  { source: "Index.html", target: "_private.md", label: "Private" },
];

try {
  let result = await postJson(baseUrl, { data: seedEdges });

  assert.equal(result.response.status, 200);
  assert.equal(result.json.success, true);
  assert.equal(result.json.edgeCount, 5);
  assert.deepEqual(new Set(result.json.results.map((entry) => entry.bucket)), new Set(["A", "Z", "Y", "#"]));
  assert.deepEqual(new Set(result.json.sourceResults.map((entry) => entry.bucket)), new Set(["B", "G", "A", "I"]));
  assert.equal((await readBucket(sharedDataDir, "A")).length, 2);
  assert.equal((await readBucket(sharedDataDir, "A", { bySource: true })).length, 2);
  assert.equal((await readBucket(sharedDataDir, "B", { bySource: true })).length, 1);
  assert.equal((await readBucket(sharedDataDir, "G", { bySource: true })).length, 1);

  result = await postJson(baseUrl, {
    filename: "Gamma.md",
    data: [{ source: "Index.html", target: "Gamma.md", label: "G" }],
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.json.bucket, "G");
  assert.equal((await readBucket(sharedDataDir, "G")).length, 1);

  result = await postJson(baseUrl, {
    data: [{ source: "Beta.md", target: "Alpha.md", label: "Updated" }],
  });
  assert.equal(result.response.status, 200);
  const alphaTargetEdges = await readBucket(sharedDataDir, "A");
  assert.equal(alphaTargetEdges.length, 2);
  assert.equal(alphaTargetEdges.find((edge) => edge.source === "Beta.md")?.label, "Updated");

  await fs.rm(path.join(sharedDataDir, "edges", "by-source"), { recursive: true, force: true });
  await assert.rejects(() => readBucket(sharedDataDir, "A", { bySource: true }), /ENOENT/);
  result = await postJson(baseUrl, { data: seedEdges });
  assert.equal(result.response.status, 200);
  assert.equal((await readBucket(sharedDataDir, "A", { bySource: true })).length, 2);
  assert.equal((await readBucket(sharedDataDir, "B", { bySource: true })).length, 1);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("graphExtras route tests passed.");
