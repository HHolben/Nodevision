// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLTypingLatencyDiagnostics.test.mjs

import assert from "node:assert/strict";
import { classifyHtmlMutationRecords } from "./HTMLTypingLatencyDiagnostics.mjs";

const textOnly = classifyHtmlMutationRecords([
  { type: "characterData" },
  { type: "characterData" },
]);
assert.equal(textOnly.textOnly, true, "characterData-only batches should be text-only");
assert.equal(textOnly.structural, false, "text-only batches should not be structural");
assert.equal(textOnly.characterData, 2);

const childList = classifyHtmlMutationRecords([
  { type: "childList", addedNodes: { length: 2 }, removedNodes: { length: 1 } },
]);
assert.equal(childList.textOnly, false, "childList batches should not be text-only");
assert.equal(childList.structural, true, "childList batches should be structural");
assert.equal(childList.addedNodes, 2);
assert.equal(childList.removedNodes, 1);

const attributes = classifyHtmlMutationRecords([
  { type: "attributes" },
]);
assert.equal(attributes.textOnly, false, "attribute batches should not be text-only");
assert.equal(attributes.structural, true, "attribute batches should be structural");

const mixed = classifyHtmlMutationRecords([
  { type: "characterData" },
  { type: "attributes" },
]);
assert.equal(mixed.textOnly, false, "mixed batches must not be treated as text-only");
assert.equal(mixed.structural, true, "mixed batches should trigger structural work");

const empty = classifyHtmlMutationRecords([]);
assert.equal(empty.textOnly, false, "empty batches are not typing work");
assert.equal(empty.structural, false, "empty batches have no structural work");

console.log("HTML typing mutation classification tests passed");
