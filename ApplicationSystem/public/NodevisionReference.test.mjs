// Nodevision/ApplicationSystem/public/NodevisionReference.test.mjs
// Regression coverage for canonical Nodevision Notebook object references.

import assert from "node:assert/strict";
import {
  createDirectoryReference,
  createFileReference,
  createNotebookReference,
  deserializeNodevisionReference,
  normalizeNodevisionReferencePath,
  referenceDisplayName,
  referenceFullDisplayName,
  referenceToApiPath,
  referenceToNotebookAssetUrl,
  resolveDirectoryImageReferences,
  resolveDirectoryIndexReference,
  resolveDirectoryStylesheetReference,
  sameNodevisionReference,
  serializeNodevisionReference,
} from "./NodevisionReference.mjs";

assert.equal(normalizeNodevisionReferencePath("/Notebook//docs/./Alpha.md?draft=1#top"), "docs/Alpha.md");
assert.equal(normalizeNodevisionReferencePath("Notebook/a/../b.md"), "b.md");

const alpha = createFileReference({ path: "Notebook/docs/Alpha.md" });
assert.deepEqual(serializeNodevisionReference(alpha), {
  type: "notebook",
  rootId: "local-notebook",
  kind: "file",
  path: "docs/Alpha.md",
});
assert.equal(referenceDisplayName(alpha), "Alpha.md");
assert.equal(referenceFullDisplayName(alpha), "docs/Alpha.md");
assert.equal(referenceToApiPath(alpha), "docs/Alpha.md");
assert.equal(referenceToNotebookAssetUrl(alpha), "/Notebook/docs/Alpha.md");
assert.ok(sameNodevisionReference(alpha, deserializeNodevisionReference(serializeNodevisionReference(alpha))));

const alphaElsewhere = createFileReference({ path: "archive/Alpha.md" });
assert.equal(sameNodevisionReference(alpha, alphaElsewhere), false, "same basename in different directories must remain distinct");

const lowerCasePath = createFileReference({ path: "docs/alpha.md" });
assert.equal(sameNodevisionReference(alpha, lowerCasePath), false, "Notebook references are case-sensitive");

const otherRoot = createNotebookReference({ rootId: "portable-copy", path: "docs/Alpha.md" });
assert.equal(sameNodevisionReference(alpha, otherRoot), false, "root ids participate in identity");

const directory = createDirectoryReference("Notebook/projects/site");
assert.equal(directory.kind, "directory");
assert.equal(referenceDisplayName(directory), "site");
assert.deepEqual(resolveDirectoryIndexReference(directory), createFileReference({ path: "projects/site/index.html" }));
assert.deepEqual(resolveDirectoryStylesheetReference(directory), createFileReference({ path: "projects/site/directory.css" }));
assert.deepEqual(resolveDirectoryImageReferences(directory).map((ref) => ref.path), [
  "projects/site/.directory.svg",
  "projects/site/directory.svg",
  "projects/site/.directory.png",
  "projects/site/directory.png",
]);

const nestedDirectory = createDirectoryReference("Notebook/Parent/Child");
assert.deepEqual(resolveDirectoryIndexReference(nestedDirectory), createFileReference({ path: "Parent/Child/index.html" }), "nested directory indexes resolve locally, not to a parent index");

const directoryA = createDirectoryReference("Notebook/A");
const directoryB = createDirectoryReference("Notebook/B");
assert.notDeepEqual(resolveDirectoryIndexReference(directoryA), resolveDirectoryIndexReference(directoryB), "same index basename in different directories remains distinct");

const caseVariant = createFileReference({ path: "Parent/Child/Index.html" });
assert.equal(sameNodevisionReference(resolveDirectoryIndexReference(nestedDirectory), caseVariant), false, "Index.html is not silently treated as index.html by canonical references");

const missingTargetReference = createFileReference("missing/NotCreatedYet.md");
assert.equal(missingTargetReference.path, "missing/NotCreatedYet.md", "references describe Notebook targets without requiring existence");

console.log("ok - Nodevision references preserve canonical object identity");
