// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditor.performance.test.mjs
// Source-level regression checks for CodeEditor listener accumulation repair.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./CodeEditor.mjs", import.meta.url), "utf8");

assert.match(source, /function handleCodeEditorFileSaved\(evt\)/, "CodeEditor should own its file-saved handler");
assert.match(source, /function installCodeEditorFileSavedListener\(\)/, "CodeEditor should install file-saved listener through a guard");
assert.match(source, /codeEditorFileSavedListenerInstalled/, "CodeEditor should prevent repeated global file-saved listener registration");
assert.doesNotMatch(source, /window\.addEventListener\("nodevision-file-saved",\s*\(evt\)\s*=>/, "CodeEditor should not add anonymous file-saved listeners during Monaco initialization");
assert.match(source, /CodeEditor Monaco init/, "CodeEditor should expose Monaco init diagnostics");
assert.match(source, /CodeEditor.monacoDisposeCalls/, "CodeEditor should count Monaco dispose calls for diagnostics");

console.log("ok - CodeEditor file-saved listener is singleton guarded");
