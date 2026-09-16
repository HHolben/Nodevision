// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContext.test.mjs
// Focused tests for HTML Layers mutation filtering.

import assert from "node:assert/strict";

globalThis.Node = globalThis.Node || {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
};

const { htmlLayerMutationChangesStructure, htmlLayerVisibleRange } = await import("./htmlLayersContext.mjs");

const textNode = { nodeType: Node.TEXT_NODE };
const elementNode = { nodeType: Node.ELEMENT_NODE };

assert.equal(
  htmlLayerMutationChangesStructure({ type: "childList", addedNodes: [textNode], removedNodes: [] }),
  false,
  "text-node-only additions do not change the HTML layer tree"
);

assert.equal(
  htmlLayerMutationChangesStructure({ type: "childList", addedNodes: [], removedNodes: [textNode] }),
  false,
  "text-node-only removals do not change the HTML layer tree"
);

assert.equal(
  htmlLayerMutationChangesStructure({ type: "childList", addedNodes: [elementNode], removedNodes: [] }),
  true,
  "element additions change the HTML layer tree"
);

assert.equal(
  htmlLayerMutationChangesStructure({ type: "childList", addedNodes: [], removedNodes: [elementNode] }),
  true,
  "element removals change the HTML layer tree"
);

assert.equal(
  htmlLayerMutationChangesStructure({ type: "attributes", addedNodes: [], removedNodes: [] }),
  true,
  "attribute mutations can change layer names or visibility"
);

assert.deepEqual(
  htmlLayerVisibleRange({ clientHeight: 999999, scrollTop: 0 }, 4600),
  { start: 0, end: 56 },
  "large host heights are capped so virtualized lists do not render every layer"
);

assert.deepEqual(
  htmlLayerVisibleRange({ clientHeight: 999999, scrollTop: 3400 }, 4600),
  { start: 90, end: 146 },
  "virtualized lists preserve a capped overscan window while scrolling"
);
