// Nodevision/ApplicationSystem/public/Sessions/SketchFocusBenchmark.mjs
// This diagnostic feeds a long stylus-like path through the Sketch Focus model and SVG serializer to expose input-processing and replay-data costs.

import { createSketchModel } from "./SketchFocusModel.mjs";
import { serializeSketchSvg } from "./SketchFocusSvgExport.mjs";

const now = () => Number(globalThis.performance?.now?.() || Date.now());
const sampleCount = Number(process.argv[2] || 25000);
const model = createSketchModel({ width: 1600, height: 900 });
const start = now();
model.beginStroke({ x: 20, y: 420, pressure: 0.3, tiltX: 0, tiltY: 0 }, { preset: "HB", size: 5 });
for (let i = 1; i < sampleCount; i += 1) {
  model.addSample({
    x: 20 + i * 0.055,
    y: 420 + Math.sin(i / 28) * 120,
    pressure: 0.25 + (i % 100) / 160,
    tiltX: (i % 45) - 22,
    tiltY: 6,
    time: i,
  });
}
model.finishStroke();
const inputMs = now() - start;
const svgStart = now();
const svg = serializeSketchSvg(model.snapshot(), { profile: "compact" });
const svgMs = now() - svgStart;

console.log(JSON.stringify({
  sampleCount,
  strokeCount: model.state.strokes.length,
  domNodesCreated: 0,
  inputMs: Math.round(inputMs * 100) / 100,
  svgMs: Math.round(svgMs * 100) / 100,
  compactSvgBytes: Buffer.byteLength(svg, "utf8"),
}, null, 2));
