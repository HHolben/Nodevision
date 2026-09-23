// Nodevision/ApplicationSystem/public/Sessions/SketchFocusModel.test.mjs
// This test verifies Sketch Focus pressure normalization, palm rejection decisions, undo/redo behavior, SVG vector serialization, filename sanitizing, and shared GIF encoding.

import assert from "node:assert/strict";
import { encodeGif } from "../Shared/GifEncoder.mjs";
import { sanitizeBasename } from "../PanelInstances/InfoPanels/SketchFocusExportPanel.mjs";
import { getNodevisionCommandDefinition } from "../Commands/NodevisionCommandRegistry.mjs";
import { readSession } from "../../Sessions/SessionRegistry.mjs";
import { isKnownNodevisionEvent } from "../Commands/NodevisionEventRegistry.mjs";
import { createSketchModel, normalizePressure } from "./SketchFocusModel.mjs";
import { shouldAcceptPointer } from "./SketchFocusInput.mjs";
import { serializeSketchSvg } from "./SketchFocusSvgExport.mjs";
import { normalizeNotebookPath, joinNotebookPath } from "./SketchFocusPath.mjs";

globalThis.btoa = globalThis.btoa || ((value) => Buffer.from(value, "binary").toString("base64"));

const builtIn = await readSession("builtin", "SketchFocus.NodevisionSession.js");
assert.equal(builtIn.title, "Sketch Focus Session");
assert.match(builtIn.source, /run\("sketchFocus\.open"\)/);
assert.equal(getNodevisionCommandDefinition("sketchFocus.open")?.sessionSafe, true);
assert.equal(isKnownNodevisionEvent("sketchFocus.finished"), true);
assert.equal(normalizePressure(0.75, "pen"), 0.75);
assert.equal(normalizePressure(0, "mouse", 1), 0.5);
assert.equal(shouldAcceptPointer({ pointerType: "touch", pointerId: 2 }, { activePenPointerId: 1 }), false);
assert.equal(shouldAcceptPointer({ pointerType: "mouse", pointerId: 3 }, { activePenPointerId: 1 }), true);

const model = createSketchModel({ width: 640, height: 480 });
model.beginStroke({ x: 1, y: 2, pressure: 0.4 }, { preset: "HB", size: 4 });
model.addSample({ x: 12, y: 14, pressure: 0.8, tiltX: 20, tiltY: 0 });
model.finishStroke();
assert.equal(model.state.strokes.length, 1);
model.undo();
assert.equal(model.state.strokes.length, 0);
model.redo();
assert.equal(model.state.strokes.length, 1);

const svg = serializeSketchSvg(model.snapshot(), { profile: "faithful", title: "Test" });
assert.match(svg, /<path /);
assert.doesNotMatch(svg, /<image\b/i);
assert.doesNotMatch(svg, /#[0-9a-f]{6}/i);
assert.match(svg, /rgb\((\d+),\1,\1\)/);

assert.equal(sanitizeBasename("drawing.png", "png"), "drawing");
assert.equal(sanitizeBasename("../bad/name", "jpg"), "-bad-name");
assert.equal(joinNotebookPath("Folder", "drawing.png"), "Folder/drawing.png");
assert.equal(normalizeNotebookPath("Notebook/Folder/../outside.png"), "Notebook/Folder/outside.png".replace(/^Notebook\//, ""));

const gif = encodeGif([{ indices: new Uint8Array([0, 1, 1, 0]), delayMs: 100 }], 2, 2);
assert.equal(String.fromCharCode(...gif.slice(0, 6)), "GIF89a");

console.log("SketchFocusModel tests passed.");
