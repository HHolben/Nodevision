// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionRefreshSplit.test.mjs
// This module verifies that geometry-only SVG refreshes remain separate from full selection-state updates.

import { readEditorFeatureSource } from '../../../../../../scripts/read-modular-source.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = await readEditorFeatureSource(new URL("./SVGeditorRuntime.mjs", import.meta.url));

function functionBody(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

const geometryVisuals = functionBody("refreshSelectionGeometryVisuals");
assert.ok(geometryVisuals.includes("getSelectedUnionBBox()"), "geometry visuals compute current selection bounds");
assert.ok(geometryVisuals.includes("refreshTransformHandles(bbox)"), "geometry visuals reuse the same bounds for handles");
assert.ok(!geometryVisuals.includes("getSelectableElements("), "geometry visuals do not rescan selectable elements");
assert.ok(!geometryVisuals.includes('querySelectorAll("*")'), "geometry visuals do not query every SVG descendant");

const stateVisuals = functionBody("refreshSelectionStateVisuals");
assert.ok(stateVisuals.includes("selectionMarkers.update(selectedElements)"), "state visuals reconcile only selection markers after initial cleanup");
assert.ok(!stateVisuals.includes("getSelectableElements()"), "selection changes do not rescan every SVG descendant");
assert.ok(stateVisuals.includes("refreshSelectionGeometryVisuals()"), "state visuals still refresh overlays after state reconciliation");

const geometryAfterMutation = functionBody("refreshSelectionGeometryAfterMutation");
assert.ok(geometryAfterMutation.includes("refreshSelectionGeometryVisuals()"), "geometry mutation uses geometry-only visuals");
assert.ok(!geometryAfterMutation.includes("refreshSelectionStateVisuals()") && !geometryAfterMutation.includes("refreshSelectionVisuals()") && !geometryAfterMutation.includes("getSelectableElements("), "geometry mutation must not use the full selection-state path");

const stateAfterMutation = functionBody("refreshSelectionAfterMutation");
assert.ok(stateAfterMutation.includes("refreshSelectionStateVisuals()"), "state mutation still uses the full selection-state path");

const transformHandles = functionBody("refreshTransformHandles");
assert.ok(source.includes("function refreshTransformHandles(selectionBBox = null)"), "transform handles accept a per-refresh bounds value");
assert.ok(transformHandles.includes("selectionBBox || getSelectedUnionBBox()"), "transform handles reuse caller-provided bounds when available");

for (const snippet of [
  'if (moved) refreshSelectionGeometryAfterMutation("move");',
  'refreshSelectionGeometryAfterMutation("line-handle");',
  'refreshSelectionGeometryAfterMutation("resize");',
  'refreshSelectionGeometryAfterMutation("rotate");',
]) {
  assert.ok(source.includes(snippet), `interactive transform path should use geometry-only refresh: ${snippet}`);
}

console.log("SVG selection refresh split test passed");
