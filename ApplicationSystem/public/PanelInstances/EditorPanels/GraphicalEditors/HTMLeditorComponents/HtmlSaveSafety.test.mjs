// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSaveSafety.test.mjs
// Regression tests for graphical HTML save guards that prevent transient empty editor states from overwriting real documents.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  htmlEditableBodyHasMeaningfulContent,
  validateGraphicalHtmlSave,
} from "./HtmlSaveSafety.mjs";
import { validateHtmlWysiwygSavePayload } from "../../../../../routes/api/fileSaveRoutes/htmlWysiwygSaveGuard.js";

const original = `<!doctype html>
<html>
<head><title>Existing page</title></head>
<body><p>Keep this content.</p></body>
</html>`;

assert.equal(htmlEditableBodyHasMeaningfulContent(original), true);
assert.equal(
  htmlEditableBodyHasMeaningfulContent(`<!doctype html>
<html>
<head><title>Existing page</title></head>
<body></body>
</html>`),
  false,
);
assert.equal(
  htmlEditableBodyHasMeaningfulContent(`<!doctype html>
<html>
<head><title>Existing page</title></head>
<body><br></body>
</html>`),
  false,
);

const emptyWithHeadOnly = validateGraphicalHtmlSave({
  path: "Pages/example.html",
  originalContent: original,
  content: `<!doctype html>
<html>
<head><title>Existing page</title></head>
<body></body>
</html>`,
});
assert.equal(emptyWithHeadOnly.ok, false);
assert.equal(emptyWithHeadOnly.code, "HTML_WYSIWYG_EMPTY_PAYLOAD");

const blankParagraph = validateGraphicalHtmlSave({
  path: "Pages/example.html",
  originalContent: original,
  content: `<!doctype html><html><head></head><body><p><br></p></body></html>`,
});
assert.equal(blankParagraph.ok, false);
assert.equal(blankParagraph.code, "HTML_WYSIWYG_EMPTY_PAYLOAD");

assert.deepEqual(
  validateGraphicalHtmlSave({
    path: "Pages/example.html",
    originalContent: original,
    content: `<!doctype html><html><body><img src="image.png" alt=""></body></html>`,
  }),
  { ok: true },
);

assert.equal(
  validateGraphicalHtmlSave({
    path: "Pages/example.html",
    originalContent: original,
    content: "<p>body fragment from stale save hook</p>",
  }).code,
  "HTML_WYSIWYG_INVALID_SERIALIZATION",
);

assert.deepEqual(
  validateGraphicalHtmlSave({
    path: "Notes/example.txt",
    originalContent: original,
    content: "",
  }),
  { ok: true },
);

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-html-save-"));
try {
  const filePath = path.join(tempDir, "example.html");
  await fs.writeFile(filePath, original, "utf8");

  const guardedPayload = await validateHtmlWysiwygSavePayload({
    relativePath: "Pages/example.html",
    filePath,
    editorKind: "html-wysiwyg",
    content: `<!doctype html><html><head><title>Existing page</title></head><body></body></html>`,
  });
  assert.equal(guardedPayload.ok, false);
  assert.equal(guardedPayload.code, "HTML_WYSIWYG_EMPTY_PAYLOAD");

  assert.deepEqual(
    await validateHtmlWysiwygSavePayload({
      relativePath: "Pages/example.html",
      filePath,
      content: "",
    }),
    { ok: true },
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

console.log("HTML save safety test passed");
