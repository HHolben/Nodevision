// Nodevision/ApplicationSystem/server/routes/worldRoutes.test.mjs
// This test module exercises first-world initialization through the HTML loading endpoint. It verifies that existing definitions and explicitly empty worlds remain unchanged.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerWorldRoutes } from './worldRoutes.mjs';
const notebookDir = await mkdtemp(join(tmpdir(), 'nv-world-'));
try {
  let handler;
  registerWorldRoutes({ post(_path, fn) { handler = fn; } }, { notebookDir });
  const load = async html => {
    await writeFile(join(notebookDir, 'page.html'), html);
    let result, status = 200;
    await handler({ body: { worldPath: 'page.html' } }, { status(n) { status = n; return this; }, json(value) { result = value; } });
    assert.equal(status, 200); return result.worldDefinition;
  };
  const fresh = await load('<!doctype html><title>Page</title><h1>Page</h1>');
  assert.equal(fresh.objects.length, 2);
  const [plane, frame] = fresh.objects;
  assert.equal(plane.equationCollider.infinite, true); assert.equal(plane.equationCollider.d, 0);
  assert.deepEqual(plane.position, [0, 0, 0]); assert.deepEqual(frame.position, [0, 1.75, -1]);
  assert.equal(frame.src, '/Notebook/page.html'); assert.equal(frame.iframeSourceKind, 'webpage');
  for (const saved of [{ objects: [] }, { worldType: 'NodevisionMetaWorld', objects: [], metadata: { objectGroundOnly: true } }, { objects: [{ type: 'box' }] }]) {
    assert.deepEqual(await load(`<script type="application/json">${JSON.stringify(saved)}</script>`), saved);
  }
  console.log('HTML world initialization and existing-world preservation passed');
} finally { await rm(notebookDir, { recursive: true, force: true }); }
