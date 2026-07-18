// Nodevision/ApplicationSystem/server/routes/handwritingOcrTrainingRoutes.test.mjs
// Focused tests for handwriting OCR training storage helpers.

import assert from "node:assert/strict";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { normalizeRawHandwritingStrokes } from "../../public/PanelInstances/InfoPanels/HandwritingTrajectory.mjs";
import { handwritingOcrTrainingRouteInternals as internals } from "./handwritingOcrTrainingRoutes.mjs";

const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), "nv-handwriting-route-"));
const ctx = {
  userDataDir: path.join(root, "UserData"),
  notebookDir: path.join(root, "Notebook"),
};
await fsPromises.mkdir(ctx.userDataDir, { recursive: true });
await fsPromises.mkdir(ctx.notebookDir, { recursive: true });

{
  const a = internals.userTrainingDir(ctx, { id: 7, username: "alice" });
  const b = internals.userTrainingDir(ctx, { id: 8, username: "alice" });
  const c = internals.userTrainingDir(ctx, { username: "../alice" });
  assert.notEqual(a, b);
  assert.ok(a.startsWith(path.join(ctx.userDataDir, "HandwritingOcr", "users")));
  assert.ok(c.startsWith(path.join(ctx.userDataDir, "HandwritingOcr", "users")));
  assert.equal(c.includes(".."), false);
}

{
  assert.throws(() => internals.sanitizeLabel(""), /required/);
  assert.equal(internals.sanitizeLabel("AB"), "A");
  assert.throws(() => internals.sanitizeSample({ points: [] }), /required/);
  assert.throws(() => internals.sanitizeSample({ points: [{ x: "../x", y: 1 }] }), /Invalid/);
}

{
  const sample = { grid: 28, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] };
  const publicV1 = internals.publicSample({ id: "1", label: "O", recognizedChar: "0", sample });
  assert.equal(publicV1.schema, "nodevision-handwriting-correction-sample/1");
  assert.equal(publicV1.trajectory, null);
}

{
  const sample = { grid: 28, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] };
  const trajectory = normalizeRawHandwritingStrokes([[{ x: 0, y: 0 }, { x: 10, y: 10 }]], { character: "H", raster28: sample });
  const sanitized = internals.sanitizeTrajectorySample(trajectory, "H", sample);
  assert.equal(sanitized.schema, "nodevision-handwriting-sample/2");
  const publicV2 = internals.publicSample({ id: "2", label: "H", sample, trajectory: sanitized });
  assert.equal(publicV2.schema, "nodevision-handwriting-correction-sample/2");
  assert.equal(publicV2.trajectory.metadata.strokeCount, 1);
}

{
  const confusionPath = path.join(ctx.userDataDir, "bad-confusions.json");
  await fsPromises.writeFile(confusionPath, "{bad json", "utf8");
  const recovered = await internals.loadConfusions(confusionPath);
  assert.deepEqual(recovered.pairs, {});
}

{
  const fontDir = path.join(ctx.userDataDir, "HandwritingOcr", "fonts");
  await fsPromises.mkdir(fontDir, { recursive: true });
  const allowed = path.join(fontDir, "Allowed.ttf");
  const disallowed = path.join(root, "elsewhere.ttf");
  await fsPromises.writeFile(allowed, "font", "utf8");
  await fsPromises.writeFile(disallowed, "font", "utf8");
  assert.equal(await internals.existingFontPathInAllowedRoots(ctx, allowed), allowed);
  assert.equal(await internals.existingFontPathInAllowedRoots(ctx, disallowed), "");
  assert.equal(internals.isPathWithin(ctx.userDataDir, path.join(ctx.userDataDir, "../outside")), false);
}

console.log("Handwriting OCR training route helper tests passed");
