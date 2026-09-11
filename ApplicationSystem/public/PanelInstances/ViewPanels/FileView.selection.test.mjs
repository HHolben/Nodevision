// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileView.selection.test.mjs
// Source-level regression coverage for FileView canonical selection following and directory index resolution.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(here, "../..");
const fileViewSource = await readFile(path.join(here, "FileView.mjs"), "utf8");
const fileManagerSource = await readFile(path.join(publicRoot, "PanelInstances/InfoPanels/FileManagerCore.mjs"), "utf8");
const codeEditorSource = await readFile(path.join(publicRoot, "PanelInstances/EditorPanels/CodeEditor.mjs"), "utf8");
const graphicalEditorSource = await readFile(path.join(publicRoot, "PanelInstances/EditorPanels/GraphicalEditor.mjs"), "utf8");

assert.match(fileViewSource, /nodevision-selection-changed/, "FileView subscribes to canonical workspace selection changes");
assert.match(fileViewSource, /function handleNodevisionSelectionChanged[\s\S]*getSelectionFollowingFileViewRoot\(\)/, "FileView selection changes target the remembered visible follow-selection FileView, not the focused panel");
assert.match(fileViewSource, /function activateFileViewHost[\s\S]*rememberSelectionFollowingFileView\(viewDiv\)/, "Activating a FileView establishes it as the selection-following viewer");
assert.match(fileViewSource, /updateViewPanel\(path, \{ force: true, selectionReference, viewPanel \}\)/, "FileView passes canonical selection references into the explicitly targeted active viewer");
assert.match(fileViewSource, /function syncFileViewTabReference[\s\S]*candidate\.contentElement === tabContent/, "FileView updates the active tab reference by content element instead of retargeting every FileView");
assert.match(fileViewSource, /resolveDirectoryIndexReference/, "FileView resolves directory indexes through NodevisionReference helpers");
assert.doesNotMatch(fileViewSource, /cleanDirectory \? cleanDirectory \+ "\/index\.html"/, "FileView should not duplicate directory index path concatenation");
assert.match(fileViewSource, /preserveSelectedFolder = selectedDirectoryRequest/, "FileView keeps selected directory identity separate from resolved index render target");

assert.match(fileManagerSource, /setNodevisionSelectionEntries/, "FileManager publishes selection sets through NodevisionSelection");
assert.match(fileManagerSource, /markSelectedFileItem\(item, { silentSelection: true }\)/, "FileManager avoids duplicate canonical selection events after guarded single selection");
assert.doesNotMatch(codeEditorSource, /nodevision-selection-changed/, "CodeEditor must not retarget from workspace selection changes");
assert.doesNotMatch(graphicalEditorSource, /nodevision-selection-changed/, "GraphicalEditor must not retarget from workspace selection changes");

async function collectFiles(root) {
  const out = [];
  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "lib") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (/\.(mjs|js)$/.test(entry.name)) out.push(full);
    }
  }
  await visit(root);
  return out;
}

const owners = [];
for (const file of await collectFiles(publicRoot)) {
  const source = await readFile(file, "utf8");
  if (source.includes("Object.defineProperty(window, \"selectedFilePath\"")) {
    owners.push(path.relative(publicRoot, file));
  }
}
assert.deepEqual(owners, ["NodevisionSelection.mjs"], "NodevisionSelection remains the sole selectedFilePath property owner");

console.log("ok - FileView follows canonical selection without retargeting editors or inactive FileViews");
