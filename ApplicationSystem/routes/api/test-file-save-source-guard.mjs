// Nodevision/ApplicationSystem/routes/api/test-file-save-source-guard.mjs
// Regression test: declared editor buffers cannot be saved into a different target path.

import assert from "node:assert/strict";
import { normalizeSaveSourcePath, validateSaveSourcePath } from "./fileSaveRoutes/saveSourceGuard.js";

assert.equal(normalizeSaveSourcePath("/Notebook/Pages/a.html?cache=1"), "Pages/a.html");
assert.equal(normalizeSaveSourcePath("Pages\\a.html"), "Pages/a.html");

assert.deepEqual(
  validateSaveSourcePath({ relativePath: "Pages/a.html", sourcePath: "Notebook/Pages/a.html" }),
  { ok: true },
);

assert.deepEqual(
  validateSaveSourcePath({ relativePath: "Pages/a.html" }),
  { ok: true },
);

const mismatch = validateSaveSourcePath({
  relativePath: "Pages/a.html",
  sourcePath: "Pages/b.html",
});
assert.equal(mismatch.ok, false);
assert.equal(mismatch.code, "SAVE_SOURCE_PATH_MISMATCH");
assert.equal(mismatch.sourcePath, "Pages/b.html");
assert.equal(mismatch.targetPath, "Pages/a.html");

console.log("Save source guard test passed");
