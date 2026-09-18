// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgEditorDeferredModeLayout.test.mjs
// Source-level regression guard for deferring SVG editor mode-layout work until after core editor readiness.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./SVGeditorRuntime.mjs", import.meta.url), "utf8");

assert.match(source, /function scheduleSvgEditorModeLayout\(\)/, "SVG editor schedules mode layout through a named helper");
assert.match(source, /function cancelDeferredSvgModeLayout\(\)/, "SVG editor owns cancellation for deferred mode layout");
assert.match(source, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*window\.setTimeout\(async \(\) => \{/,
  "mode layout is deferred past at least one animation frame and timer turn");
assert.match(source, /container\.__nvEditorRenderToken !== scheduledToken/, "deferred mode layout checks render token before mutating workspace");
assert.match(source, /!wrapper\.isConnected[\s\S]*!editorCell\.isConnected/, "deferred mode layout checks teardown/disconnect state");
assert.match(source, /cancelDeferredSvgModeLayout\(\);[\s\S]*container\.removeEventListener\("scroll"/, "cleanup cancels queued layout before releasing editor listeners");

const contextReadyIndex = source.indexOf('window.dispatchEvent(new CustomEvent("nv-svg-editor-context-ready"');
const scheduleIndex = source.indexOf("scheduleSvgEditorModeLayout();");
assert.ok(contextReadyIndex > 0 && scheduleIndex > contextReadyIndex, "context-ready dispatch happens before deferred side-panel layout scheduling");

const scheduleFunctionIndex = source.indexOf("function scheduleSvgEditorModeLayout()");
const savedAttentionIndex = source.indexOf("const savedSvgAttention = getEditingContext(filePath);", scheduleFunctionIndex);
assert.ok(scheduleFunctionIndex > 0 && savedAttentionIndex > scheduleFunctionIndex, "test can isolate the deferred mode-layout helper");

const scheduleFunctionSource = source.slice(scheduleFunctionIndex, savedAttentionIndex);
assert.match(scheduleFunctionSource, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*window\.setTimeout\(async \(\) => \{[\s\S]*await ensureSvgEditorModeLayout\(\{ editorCell \}\)/,
  "the mode-layout await in this region is inside the deferred helper callback");

const linearInitializationSource = source.slice(savedAttentionIndex, contextReadyIndex);
assert.doesNotMatch(linearInitializationSource, /ensureSvgEditorModeLayout/,
  "core initialization between restored attention and context-ready does not synchronously touch SVG mode layout");

const previousSynchronousBlock = `try {
    const editorCell = container?.closest?.(".panel-cell");
    if (editorCell) {
      await ensureSvgEditorModeLayout({ editorCell });`;
assert.equal(source.includes(previousSynchronousBlock), false, "previous synchronous mode-layout block is absent");

console.log("ok - SVG editor defers and cancels mode-layout initialization");
