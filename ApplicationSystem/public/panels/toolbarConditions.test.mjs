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

const defaultToolbar = JSON.parse(await readFile(new URL("../ToolbarJSONfiles/defaultToolbar.json", import.meta.url), "utf8"));
const insertToolbar = JSON.parse(await readFile(new URL("../ToolbarJSONfiles/insertToolbar.json", import.meta.url), "utf8"));

{
  const tableItems = defaultToolbar.filter((item) => item.heading === "Table" && item.callbackKey === "openTableToolbar");
  const htmlTableItem = tableItems.find((item) => item.modes?.includes("HTMLediting"));
  const csvTableItem = tableItems.find((item) => item.modes?.includes("CSVediting"));
  assert.ok(htmlTableItem, "default toolbar has an HTML-specific Table item");
  assert.ok(csvTableItem, "default toolbar has a CSV-specific Table item");
  assert.deepEqual(htmlTableItem.modes, ["HTMLediting"], "HTML Table item is no longer shared with CSV");
  assert.deepEqual(csvTableItem.modes, ["CSVediting", "GraphicalEditing"], "CSV Table item is independent and covers the graphical CSV editor mode");
  assert.deepEqual(htmlTableItem.conditions, { htmlTableSelected: true }, "HTML Table item still requires an active HTML table cell");
  assert.deepEqual(csvTableItem.conditions, { activeFileIsCsv: true }, "CSV Table item depends on active CSV file state, not HTML table selection state");
}

{
  const csvTableItem = defaultToolbar.find((item) => item.heading === "Table" && item.modes?.includes("CSVediting"));
  const result = evaluateToolbarItemState(
    csvTableItem,
    { attentionSnapshot: {}, state: { currentMode: "GraphicalEditing", activeFileIsCsv: true, htmlTableSelected: false }, settings }
  );
  assert.equal(result.visible, true, "CSV-specific Table item is visible in the graphical CSV editor without HTML table selection");

  const nonCsvResult = evaluateToolbarItemState(
    csvTableItem,
    { attentionSnapshot: {}, state: { currentMode: "GraphicalEditing", activeFileIsCsv: false, htmlTableSelected: false }, settings }
  );
  assert.equal(nonCsvResult.visible, false, "CSV-specific Table item stays hidden for non-CSV graphical editors");
}

{
  const htmlTableItem = defaultToolbar.find((item) => item.heading === "Table" && item.modes?.includes("HTMLediting"));
  const result = evaluateToolbarItemState(
    htmlTableItem,
    { attentionSnapshot: {}, state: { currentMode: "HTMLediting", htmlTableSelected: false }, settings }
  );
  assert.equal(result.visible, false, "HTML-specific Table item still requires an actual selected table cell");
}

{
  const rowColumnCallbacks = new Set([
    "tableInsertRowAbove",
    "tableInsertRowBelow",
    "tableInsertColumnLeft",
    "tableInsertColumnRight",
    "tableDeleteRow",
    "tableDeleteColumn",
  ]);
  for (const callbackKey of rowColumnCallbacks) {
    const variants = insertToolbar.filter((item) => item.parentHeading === "Table" && item.callbackKey === callbackKey);
    assert.ok(variants.some((item) => item.modes?.includes("HTMLediting") && item.conditions?.htmlTableSelected === true), callbackKey + " keeps an HTML table-selection variant");
    assert.ok(variants.some((item) => item.modes?.includes("CSVediting") && item.modes?.includes("GraphicalEditing") && item.conditions?.activeFileIsCsv === true), callbackKey + " has a CSV-specific graphical-editor variant gated by active CSV file state");
  }
}

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

  assert.match(createToolbarSource, /activeFileIsCsv:\s*isToolbarActiveFileCsv\(state\)/, "toolbar state exposes active CSV file detection for CSV-specific toolbar items");

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
