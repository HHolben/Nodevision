// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgLayerPreservationSource.test.mjs
// Source-level guard for the former destructive layer materialization behavior.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../ElementLayers.mjs", import.meta.url), "utf8");

assert.doesNotMatch(source, /const layer1 = ensureGroup\(svgRoot, "Layer 1"\)/, "ordinary root children must not be auto-wrapped in a generated layer group");
assert.match(source, /svgRoot\.insertBefore\(node, firstUiNode\)/, "new elements still append to root when no authored layer is active");

console.log("SVG layer preservation source test passed");
