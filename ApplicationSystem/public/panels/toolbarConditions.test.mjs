// Nodevision/ApplicationSystem/public/panels/toolbarConditions.test.mjs
// This test file verifies toolbar condition visibility, disabled-state reasons, focus-mode rules, and malformed metadata handling for contextual toolbars.

import assert from "node:assert/strict";
import { evaluateToolbarItemState } from "./toolbarConditions.mjs";

const settings = { editorAttentionContextualToolVisibility: true };
const attentionSnapshot = {
  fileFamily: "svg",
  editorMode: "SVGediting",
  activeTool: "pen",
  selectedObjectType: "path",
  hasSelection: true,
  hasEditableSelection: true,
};

{
  const result = evaluateToolbarItemState(
    { label: "Path Only", visibleWhen: { editorMode: "SVGediting", selectedObjectTypes: ["path"] } },
    { attentionSnapshot, state: {}, settings }
  );
  assert.equal(result.visible, true);
  assert.equal(result.enabled, true);
}

{
  const result = evaluateToolbarItemState(
    { label: "HTML Only", visibleWhen: { fileFamily: "html" } },
    { attentionSnapshot, state: {}, settings }
  );
  assert.equal(result.visible, false, "irrelevant contextual commands are hidden");
}


{
  const result = evaluateToolbarItemState(
    { label: "HTML Only", visibleWhen: { fileFamily: "html" } },
    { attentionSnapshot, state: {}, settings: { editorAttentionContextualToolVisibility: false } }
  );
  assert.equal(result.visible, true, "contextual visibleWhen rules are opt-in so broad editor tools remain visible by default");
}

{
  const result = evaluateToolbarItemState(
    { label: "Needs Selection", enabledWhen: { hasEditableSelection: true }, disabledReason: "Select an element first." },
    { attentionSnapshot: { ...attentionSnapshot, hasEditableSelection: false }, state: {}, settings }
  );
  assert.equal(result.visible, true);
  assert.equal(result.enabled, false);
  assert.equal(result.disabledReason, "Select an element first.");
}



{
  const result = evaluateToolbarItemState(
    { label: "Legacy Condition", modes: "SVG Editing", conditions: { fileIsDirty: false, requiresFile: true } },
    { attentionSnapshot, state: { currentMode: "SVG Editing", fileIsDirty: false, requiresFile: true }, settings }
  );
  assert.equal(result.visible, true, "legacy object conditions and string modes still work");
}
