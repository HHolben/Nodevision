// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileView.performance.test.mjs
// Source-level regression checks for FileView low-risk performance repairs.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./FileView.mjs", import.meta.url), "utf8");

assert.match(source, /loadSharedModuleMap/, "FileView should use the shared ModuleMap loader");
assert.doesNotMatch(source, /nvViewer=.+Date\.now\(\)/, "FileView should not force viewer module reloads with per-render Date.now cache busting");
assert.match(source, /stableModuleImportUrl\(modulePath,\s*"v"\)/, "FileView should use the shared page-session module token");
assert.match(source, /const loadedViewerModuleUrls = new Set\(\)/, "FileView should track viewer import cache hits for diagnostics");
assert.match(source, /function installFileViewMessageListener\(\)/, "FileView should install the global message listener through a guarded helper");
assert.match(source, /__nvFileViewMessageListenerInstalled/, "FileView message listener should be singleton guarded");

console.log("ok - FileView avoids per-render viewer cache busting and message listener accumulation");
