// Nodevision/ApplicationSystem/public/panels/toolbarConditions.test.mjs
// This test file verifies toolbar condition visibility, disabled-state reasons, focus-mode rules, and malformed metadata handling for contextual toolbars.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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


function fakeMappedImage(hasMap = true) {
  const map = { getAttribute: (name) => name === "name" ? "diagram" : "" };
  const root = { querySelectorAll: () => hasMap ? [map] : [] };
  return {
    ownerDocument: root,
    closest: () => root,
    getAttribute: (name) => name === "usemap" ? "#diagram" : "",
  };
}

{
  const result = evaluateToolbarItemState(
    { label: "Mapped Image", conditions: { htmlImageMapSelected: true } },
    { attentionSnapshot: {}, state: { activeHtmlImageContext: { element: fakeMappedImage(true) } }, settings }
  );
  assert.equal(result.visible, true, "mapped image condition passes when the selected image resolves to a map");
}

{
  const result = evaluateToolbarItemState(
    { label: "Mapped Image", conditions: { htmlImageMapSelected: true } },
    { attentionSnapshot: {}, state: { activeHtmlImageContext: { element: fakeMappedImage(false) } }, settings }
  );
  assert.equal(result.visible, false, "mapped image condition fails when the selected image has no matching map");
}


{
  const createToolbarSource = await readFile(new URL("./createToolbar.mjs", import.meta.url), "utf8");

  assert.match(
    createToolbarSource,
    /export function updateToolbarState\(newState = \{\}, options = \{\}\) \{[\s\S]*const \{ rebuildDropdowns = true \} = options \|\| \{\};/,
    "updateToolbarState keeps full dropdown rebuilding as the default for ordinary callers"
  );

  assert.match(
    createToolbarSource,
    /const onToolbarAttentionChange = \(\) => \{[\s\S]*updateToolbarState\(\{\}, \{ rebuildDropdowns: false \}\);[\s\S]*showSubToolbar\(currentSubToolbarHeading, \{ force: true, toggle: false \}\)[\s\S]*subscribeEditorAttention\(onToolbarAttentionChange, \{ immediate: false \}\)/,
    "editor-attention changes refresh visible toolbar state without synchronously rebuilding every dropdown"
  );

  assert.match(
    createToolbarSource,
    /if \(rebuildDropdowns\) \{[\s\S]*rebuildPrebuiltDropdowns\(\);[\s\S]*\} else \{[\s\S]*invalidatePrebuiltDropdowns\(\);/,
    "skipped dropdown rebuilds dirty the dropdown cache instead of silently reusing stale entries"
  );

  assert.match(
    createToolbarSource,
    /function refreshPrebuiltDropdownForAnchor\(dropdown, anchor\) \{[\s\S]*if \(!prebuiltDropdownsDirty\) return dropdown;[\s\S]*rebuildPrebuiltDropdowns\(\);[\s\S]*anchor\?\.appendChild\?\.\(refreshed\);/,
    "dirty dropdowns are rebuilt lazily before display and reattached to the active toolbar button"
  );

  assert.match(
    createToolbarSource,
    /function showToolbarDropdown\(dropdown, anchor\) \{\n  dropdown = refreshPrebuiltDropdownForAnchor\(dropdown, anchor\);/,
    "dropdown display always passes through the lazy refresh guard"
  );
}
