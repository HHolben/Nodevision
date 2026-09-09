// Nodevision/ApplicationSystem/public/PanelInstances/ModuleMapLoader.test.mjs
// Regression coverage for shared ModuleMap.csv loading and caching.

import assert from "node:assert/strict";
import {
  getModuleMapLoaderStats,
  invalidateModuleMapCache,
  loadModuleMap,
  parseModuleMapCsv,
} from "./ModuleMapLoader.mjs";

const csv = [
  "Extension,ViewerModule,GraphicalEditorModule,Family",
  "html,ViewHTML.mjs,HTMLeditor.mjs,document",
  "svg,ViewSVG.mjs,SVGeditor.mjs,image",
  ",ViewText.mjs,EditorFallback.mjs,text",
].join("\n");

const parsed = parseModuleMapCsv(csv);
assert.equal(parsed.html.viewer, "ViewHTML.mjs");
assert.equal(parsed.html.editor, "HTMLeditor.mjs");
assert.equal(parsed.svg.family, "image");
assert.equal(parsed[""].viewer, "ViewText.mjs");

invalidateModuleMapCache();
let fetchCount = 0;
const fetchImpl = async (url, options) => {
  fetchCount += 1;
  assert.equal(url, "/PanelInstances/ModuleMap.csv");
  assert.equal(options.cache, "no-store");
  return {
    ok: true,
    status: 200,
    async text() {
      return csv;
    },
  };
};

const first = await loadModuleMap({ fetchImpl });
const second = await loadModuleMap({ fetchImpl });
assert.strictEqual(first, second, "successful ModuleMap loads should reuse the same cached object");
assert.equal(fetchCount, 1, "multiple consumers should not refetch a successfully loaded ModuleMap");

await loadModuleMap({ fetchImpl, force: true });
assert.equal(fetchCount, 2, "force reload should intentionally invalidate the fetch count expectation");

const stats = getModuleMapLoaderStats();
assert.ok(stats.fetchCount >= 2, "loader stats should expose fetch count for diagnostics");
assert.equal(stats.cached, true);

console.log("ok - ModuleMapLoader reuses successful loads and supports force reload");
