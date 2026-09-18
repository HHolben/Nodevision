// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgLineToolFeedback.test.mjs
// Source-level guardrails for immediate stationary Line-tool vertex feedback.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "SVGeditorRuntime.mjs"), "utf8");
const preservationSource = readFileSync(join(here, "SvgPreservation.mjs"), "utf8");

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

assert.ok(source.includes('[SVG_UI_ATTR]: "line-tool-vertex-markers"'), "Line tool owns an editor-only vertex marker layer");
assert.ok(source.includes('[SVG_UI_ATTR]: "line-tool-vertex-marker"'), "Line tool creates editor-only vertex markers");
assert.ok(source.includes('lineToolVertexMarkerLayer.style.setProperty("pointer-events", "none", "important")'), "transient marker layer is pointer transparent even under document CSS");

const addMarker = functionBody("addLineToolVertexMarker");
assert.ok(addMarker.includes('fill: "#2f80ff"'), "accepted vertices use a visible editor marker fill");
assert.ok(addMarker.includes('stroke: "#ffffff"'), "accepted vertices use a contrasting marker stroke");
assert.ok(addMarker.includes("pointerToleranceInSvgUnits"), "accepted vertex markers scale with view zoom");
assert.ok(addMarker.includes("const svgUnitsPerCssPx = pointerToleranceInSvgUnits(1)"), "accepted vertex markers compute screen-scale once");
assert.equal((addMarker.match(/pointerToleranceInSvgUnits/g) || []).length, 1, "accepted vertex marker creation uses one getScreenCTM-backed sizing read");
assert.ok(addMarker.includes("lineToolVertexMarkerLayer.appendChild(marker)"), "accepted vertex marker is inserted into overlay layer");
assert.ok(addMarker.includes('marker.style.setProperty("pointer-events", "none", "important")'), "accepted vertex marker pointer handling cannot be overridden by document CSS");
assert.ok(addMarker.includes('marker.style.setProperty("fill", "#2f80ff", "important")'), "accepted vertex marker fill is hardened against document CSS");
assert.ok(addMarker.includes('marker.style.setProperty("stroke", "#ffffff", "important")'), "accepted vertex marker contrast stroke is hardened against document CSS");
assert.ok(addMarker.includes('marker.style.setProperty("display", "inline", "important")'), "accepted vertex marker cannot be hidden by broad circle display CSS");
assert.ok(addMarker.includes('marker.style.setProperty("visibility", "visible", "important")'), "accepted vertex marker visibility is hardened against document CSS");
assert.ok(addMarker.includes('marker.style.setProperty("opacity", "1", "important")'), "accepted vertex marker opacity is hardened against document CSS");

const begin = functionBody("beginLineToolAt");
assert.ok(begin.includes("clearLineToolVertexMarkers()"), "new Line sessions clear stale markers");
assert.ok(begin.includes("addLineToolVertexMarker(rootPoint)"), "first click creates immediate visible anchor feedback");
assert.ok(begin.indexOf("addLineToolVertexMarker(rootPoint)") < begin.indexOf("updateLineToolPreview(rootPoint)"), "anchor feedback is created during the click handler before relying on future pointermove preview");

const place = functionBody("placeLineToolVertex");
assert.ok(place.includes("addLineToolVertexMarker(rootPoint)"), "intermediate clicks create visible accepted vertex feedback");
assert.ok(place.includes("targetLayer.appendChild(seg)"), "intermediate clicks still commit the existing line segment geometry");
assert.ok(place.includes("updateLineToolPreview(rootPoint)"), "line preview behavior is preserved after placement");

const clearMarkers = functionBody("clearLineToolVertexMarkers");
assert.ok(clearMarkers.includes("lineToolState.vertexMarkers = []"), "Line marker cleanup forgets stale DOM handles");
assert.ok(clearMarkers.includes("lineToolVertexMarkerLayer.replaceChildren()"), "marker layer is emptied on cleanup");

const clear = functionBody("clearLineToolState");
assert.ok(clear.includes("clearLineToolVertexMarkers()"), "Line state cleanup removes transient vertex markers");
const finish = functionBody("finishLineTool");
assert.ok(finish.includes("clearLineToolVertexMarkers()"), "finishing the Line tool removes transient vertex markers");

assert.ok(source.includes("debugLineToolState()"), "SVG editor exposes debug state for visual feedback benchmarks");
assert.ok(source.includes("vertexMarkerCount"), "debug state reports current vertex marker count");

assert.ok(source.includes("el.closest(`[${SVG_UI_ATTR}]`)"), "editor UI overlays are excluded from selection membership");

assert.ok(source.includes("const els = getSelectableElements();"), "document snap discovery goes through selectable filtering");

const serialize = functionBody("serializeSvgForSave");
assert.ok(serialize.includes("cleanupSvgCloneForSave(clone") && serialize.includes("uiAttr: SVG_UI_ATTR"), "save serialization strips editor-only overlay markers");
assert.match(preservationSource, /removeAll\(clone,\s*`\[\$\{uiAttr\}\]`/, "preservation cleanup removes every editor-only node from saved SVG clones");

const setModeBody = functionBody("setMode");
assert.ok(setModeBody.includes('toolState.mode === "line"') && setModeBody.includes("finishLineTool()") && setModeBody.includes("clearLineToolState()"), "leaving Line mode clears or commits transient marker state");

console.log("SVG Line tool feedback guard test passed");
