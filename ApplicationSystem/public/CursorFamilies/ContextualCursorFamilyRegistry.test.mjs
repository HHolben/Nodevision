// Nodevision/ApplicationSystem/public/CursorFamilies/ContextualCursorFamilyRegistry.test.mjs
// Source and model guardrails for contextual cursor-family providers and toolbar widget lifecycle.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTEXTUAL_TOOL_CATALOG, chooseFallbackTool, extensionFromPath, normalizeToolList, resetCursorProviderResolverForTests, snapshotCursorFamily } from "./ContextualCursorFamilyRegistry.mjs";
import { invalidateModuleMapCache, parseModuleMapCsv } from "../PanelInstances/ModuleMapLoader.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(here, "..");
const moduleMapCsv = readFileSync(join(publicRoot, "PanelInstances/ModuleMap.csv"), "utf8");
const defaultToolbar = JSON.parse(readFileSync(join(publicRoot, "ToolbarJSONfiles/defaultToolbar.json"), "utf8"));
const registrySource = readFileSync(join(here, "ContextualCursorFamilyRegistry.mjs"), "utf8");
const widgetSource = readFileSync(join(publicRoot, "ToolbarJSONfiles/contextualCursorFamilyWidget.mjs"), "utf8");
const svgProviderSource = readFileSync(join(here, "providers/SVGCursorProvider.mjs"), "utf8");
const htmlProviderSource = readFileSync(join(here, "providers/HTMLCursorProvider.mjs"), "utf8");
const csvProviderSource = readFileSync(join(here, "providers/CSVCursorProvider.mjs"), "utf8");
const rasterProviderSource = readFileSync(join(here, "providers/RasterCursorProvider.mjs"), "utf8");

for (const id of ["text-select", "rectangle-select", "ellipse-select", "lasso-select", "object-select"]) {
  assert.ok(CONTEXTUAL_TOOL_CATALOG[id], `catalog should represent ${id}`);
}

assert.equal(extensionFromPath("Notebook/Art.Icon.SVG?x=1"), "svg", "extension resolver handles query strings and case");
assert.deepEqual(normalizeToolList([{ id: "rectangle-select" }])[0], {
  ...CONTEXTUAL_TOOL_CATALOG["rectangle-select"],
  id: "rectangle-select",
}, "tool metadata is filled from the shared catalog");
assert.equal(chooseFallbackTool({ getActiveToolId: () => "missing", getFallbackToolId: () => "text-select" }, [{ id: "object-select" }, { id: "text-select" }]), "text-select", "invalid active tools fall back to provider fallback");
assert.equal(chooseFallbackTool({ getActiveToolId: () => "rectangle-select", getFallbackToolId: () => "text-select" }, [{ id: "rectangle-select" }]), "rectangle-select", "valid active tools are preserved");

const parsedMap = parseModuleMapCsv(moduleMapCsv);
assert.equal(parsedMap.svg.cursorProvider, "SVGCursorProvider.mjs", "ModuleMap owns SVG provider discovery");
assert.equal(parsedMap.html.cursorProvider, "HTMLCursorProvider.mjs", "ModuleMap owns HTML provider discovery");
assert.equal(parsedMap.csv.cursorProvider, "CSVCursorProvider.mjs", "ModuleMap owns CSV provider discovery");
assert.equal(parsedMap.png.cursorProvider, "RasterCursorProvider.mjs", "ModuleMap owns PNG provider discovery");
assert.equal(parsedMap.txt?.cursorProvider || null, null, "unintegrated file types do not get provider rules");

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
try {
  resetCursorProviderResolverForTests();
  invalidateModuleMapCache();
  globalThis.window = { NodevisionState: { selectedFile: "diagram.svg", currentMode: "SVG Editing" }, dispatchEvent() {} };
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => moduleMapCsv });

  const svgSnapshot = await snapshotCursorFamily({ extension: "svg", currentMode: "SVG Editing", filePath: "diagram.svg" });
  assert.equal(svgSnapshot.provider?.id, "svg-cursor-tools", "SVG provider resolves through ModuleMap ownership");
  assert.ok(svgSnapshot.tools.some((tool) => tool.id === "line-draw"), "SVG provider exposes contextual drawing tools");

  const htmlSnapshot = await snapshotCursorFamily({ extension: "html", currentMode: "HTMLediting", filePath: "index.html" });
  assert.equal(htmlSnapshot.provider?.id, "html-cursor-tools", "HTML provider resolves through ModuleMap ownership");
  assert.ok(htmlSnapshot.tools.every((tool) => tool.kind !== "drawing"), "HTML provider does not expose drawing tools");
} finally {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  resetCursorProviderResolverForTests();
  invalidateModuleMapCache();
}

assert.match(moduleMapCsv.split("\n")[0], /CursorProviderModule/, "provider ownership is declared in the module map column");
assert.match(registrySource, /entry\?\.cursorProvider/, "provider ownership is read from parsed module map entries");
assert.doesNotMatch(moduleMapCsv, /lasso-select|rectangle-select|freehand-draw|brush-draw/, "ModuleMap must not contain runtime tool availability rules");

const toolWidgetItem = defaultToolbar.find((item) => item.script === "contextualCursorFamilyWidget.mjs");
assert.ok(toolWidgetItem, "default toolbar includes the contextual cursor-family widget");
assert.equal(toolWidgetItem.preventDropdown, true, "cursor-family widget does not ask the main toolbar to build a static dropdown");
assert.ok(toolWidgetItem.modes.includes("SVG Editing"), "cursor-family widget is visible for SVG mode");
assert.ok(toolWidgetItem.modes.includes("CSVediting"), "cursor-family widget is visible for CSV mode");
assert.match(widgetSource, /snapshotCursorFamily/, "widget queries the active provider snapshot");
assert.match(widgetSource, /provider\.activateTool/, "widget activates tools through the owning provider");
assert.doesNotMatch(widgetSource, /updateToolbarState\(/, "switching subtools should not trigger a full toolbar rebuild");
assert.match(widgetSource, /data-open/, "widget owns a compact dropdown state in-place");
assert.match(widgetSource, /aria-checked/, "dropdown marks the active tool");

assert.match(svgProviderSource, /freehand-draw/, "SVG provider may expose drawing tools because SVG drawing is meaningful");
assert.match(rasterProviderSource, /brush-draw/, "Raster provider may expose drawing tools because raster drawing is meaningful");
assert.doesNotMatch(htmlProviderSource, /kind:\s*"drawing"|-draw/, "HTML provider should not expose drawing tools by default");
assert.doesNotMatch(csvProviderSource, /kind:\s*"drawing"|-draw/, "CSV provider should not expose drawing tools");
assert.match(csvProviderSource, /rectangle-select/, "CSV provider maps rectangle selection to range selection rather than geometric drawing");

console.log("ok - contextual cursor-family provider ownership and widget lifecycle are guarded");
