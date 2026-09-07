// Nodevision/ApplicationSystem/public/Resources/ResourceReference.test.mjs
// Focused tests for normalized runtime resource acquisition results.

import assert from "node:assert/strict";
import {
  createInlineResourceReference,
  createNotebookResourceReference,
  createUrlResourceReference,
  isInlineResourceReference,
  isNotebookResourceReference,
  normalizeNotebookResourcePath,
  RESOURCE_SOURCE_KINDS,
} from "./ResourceReference.mjs";

assert.equal(normalizeNotebookResourcePath("Notebook/Images/cat.png"), "Notebook/Images/cat.png");
assert.equal(normalizeNotebookResourcePath("Images/cat.png"), "Notebook/Images/cat.png");

const notebook = createNotebookResourceReference({
  resourceType: "image",
  notebookPath: "Notebook/Images/cat.png",
  sourcePath: "Notebook/Pages/index.html",
  sourceName: "cat.png",
});
assert.equal(notebook.resourceType, "image");
assert.equal(notebook.source.kind, RESOURCE_SOURCE_KINDS.NOTEBOOK);
assert.equal(notebook.notebookPath, "Notebook/Images/cat.png");
assert.equal(notebook.src, "../Images/cat.png");
assert.equal(isNotebookResourceReference(notebook), true);

const url = createUrlResourceReference({ resourceType: "audio", url: "https://example.test/tone.wav" });
assert.equal(url.source.kind, RESOURCE_SOURCE_KINDS.URL);
assert.equal(url.src, "https://example.test/tone.wav");

const inline = createInlineResourceReference({ resourceType: "model", dataUrl: "data:model/stl;base64,AAAA", sourceName: "shape.stl" });
assert.equal(inline.source.kind, RESOURCE_SOURCE_KINDS.INLINE);
assert.equal(inline.inlineDataUrl, "data:model/stl;base64,AAAA");
assert.equal(isInlineResourceReference(inline), true);

console.log("ok - resource references normalize notebook, url, and inline results");
