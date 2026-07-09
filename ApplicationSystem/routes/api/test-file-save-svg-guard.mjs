// Nodevision/ApplicationSystem/routes/api/test-file-save-svg-guard.mjs
// Regression test: SVG saves must reject HTML payloads before a file can be overwritten.

import assert from "node:assert/strict";
import { isSvgSavePath, validateSvgSavePayload } from "./fileSaveRoutes/svgSaveGuard.js";

assert.equal(isSvgSavePath("Sketches/icon.svg"), true);
assert.equal(isSvgSavePath("Sketches/icon.html"), false);

assert.deepEqual(
  validateSvgSavePayload({
    relativePath: "Sketches/icon.svg",
    content: '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
  }),
  { ok: true },
);

assert.deepEqual(
  validateSvgSavePayload({
    relativePath: "Sketches/icon.svg",
    content: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8").toString("base64"),
    encoding: "base64",
  }),
  { ok: true },
);

assert.equal(
  validateSvgSavePayload({
    relativePath: "Sketches/icon.svg",
    content: "<!doctype html><html><body>wrong editor</body></html>",
  }).code,
  "SVG_HTML_PAYLOAD",
);

assert.equal(
  validateSvgSavePayload({
    relativePath: "Sketches/icon.svg",
    content: "<div>not svg</div>",
  }).code,
  "SVG_CONTENT_MISMATCH",
);

assert.deepEqual(
  validateSvgSavePayload({
    relativePath: "Notes/page.html",
    content: "<!doctype html><html><body>allowed</body></html>",
  }),
  { ok: true },
);

console.log("SVG save guard test passed");
