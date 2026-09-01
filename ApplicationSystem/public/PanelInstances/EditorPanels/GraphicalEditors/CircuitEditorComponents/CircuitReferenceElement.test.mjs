// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitReferenceElement.test.mjs
// Tests durable HTML reference markup, path resolution, and canvas renderer helpers for referenced circuits.

import assert from "node:assert/strict";
import { createBlankCircuitFileContent } from "./CircuitFileFormat.mjs";
import { circuitDocumentBounds, collectCircuitRenderDiagnostics } from "./CircuitCanvasRenderer.mjs";
import {
  buildCircuitReferenceMarkup,
  circuitReferenceSourceForHtml,
  normalizeCircuitNotebookPath,
  readCircuitReferenceFromElement,
} from "./CircuitReferenceElement.mjs";

assert.equal(
  normalizeCircuitNotebookPath("/Notebook/Electronics/Circuits/Test.cir?cache=1"),
  "Notebook/Electronics/Circuits/Test.cir",
);
assert.equal(
  circuitReferenceSourceForHtml({
    editorFilePath: "Notes/Topic/Page.html",
    notebookPath: "Notebook/Electronics/Circuits/Test.cir",
  }),
  "../../Electronics/Circuits/Test.cir",
);

const markup = buildCircuitReferenceMarkup({
  editorFilePath: "Notes/Topic/Page.html",
  notebookPath: "Notebook/Electronics/Circuits/Test.cir",
  width: 640,
  height: 360,
});
assert.match(markup, /data-nodevision-resource-type="circuit"/);
assert.match(markup, /data-nodevision-circuit-mode="referenced"/);
assert.match(markup, /data-nodevision-circuit-src="\.\.\/\.\.\/Electronics\/Circuits\/Test\.cir"/);
assert.match(markup, /<canvas class="nodevision-circuit-canvas"><\/canvas>/);
assert.match(markup, /style="width:640px;height:360px;"/);

const fakeElement = {
  nodeType: 1,
  matches: () => true,
  closest: () => fakeElement,
  getAttribute: (name) => ({
    "data-nodevision-circuit-src": "../../Electronics/Circuits/Test.cir",
    "data-nodevision-circuit-mode": "referenced",
  })[name] || "",
};
const reference = readCircuitReferenceFromElement(fakeElement, { sourcePath: "Notes/Topic/Page.html" });
assert.equal(reference.valid, true);
assert.equal(reference.linkedNotebookPath, "Notebook/Electronics/Circuits/Test.cir");

const blank = createBlankCircuitFileContent("Notebook/Electronics/Circuits/New.cir");
assert.match(blank, /^\* Netlist exported from Nodevision circuit editor/);
assert.match(blank, /\.END$/);

const bounds = circuitDocumentBounds({
  components: [{ id: "r1", type: "resistor", x: 100, y: 120, rotation: 0, properties: { ref: "R1", value: "1k" } }],
  wires: [{ id: "w1", points: [{ x: 10, y: 20 }, { x: 40, y: 20 }] }],
});
assert.equal(bounds.x1 <= 10, true);
assert.equal(bounds.x2 >= 170, true);
assert.deepEqual(
  collectCircuitRenderDiagnostics({ components: [{ id: "x1", type: "missing-symbol", properties: {} }] }),
  ["Missing schematic symbol: missing-symbol"],
);
assert.deepEqual(
  collectCircuitRenderDiagnostics({
    components: [{ id: "r2", type: "resistor", properties: { componentId: "missing-part" } }],
  }, { componentResources: [] }),
  ["Missing component resource: missing-part"],
);

console.log("ok - referenced circuit markup and renderer helpers");
