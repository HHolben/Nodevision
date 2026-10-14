# Active Line vertex snapping

Shift now considers only committed vertices of the currently drawn Line in SVG and Image Analysis. The tolerance is 18 CSS pixels, retaining SVG's previous nominal radius while measuring through the full screen transform. The nearest eligible vertex wins; equal distances favor the first vertex, then commit order. The live endpoint, the current endpoint (including earlier occurrences at the same coordinates), other objects, and completed paths are excluded. Hidden ancestors/markers, transparent ancestors, locked SVG layers, and collapsed transforms are excluded.

The first vertex becomes eligible after three distinct vertices. Shift+Click there commits a closed Line without appending a duplicate start coordinate. Shift+Click at an intermediate vertex reconnects without finishing. Enter and double-click retain open completion. Shift press/release refreshes the preview without requiring pointer motion. Existing vertices are never moved.

## Investigation and root cause

The tools do not share their full controllers. SVG retains its established Line controller, including axis/number constraints; raster annotations use `VectorInteraction`. The old SVG resolver searched the general `line-tool` snap cache, which could include unrelated objects and did not enforce active-path eligibility. The raster controller had no vertex-snapping branch.

Git history shows `c136ed3` replaced SVG's earlier multi-point polygon commit with an open SVG path to preserve continuous open Lines. That fixed open-path semantics but did not provide an explicit closed-Line state or a first-vertex completion branch. This correction retains open paths and adds explicit closure rather than reverting that change. It also clears the completed SVG operation's layer reference: otherwise a subsequent Line could still commit into the previous layer after the user selected another layer.

**Angular behavior discrepancy:** the checked-in SVG helper (`InstallSvgSelectionGeometry.snapAngleEndpointInRoot`) rounds absolute root-space angles to 15 degrees, not angles relative to the previous segment. The Image Analysis controller has no angular fallback. In accordance with the explicit instruction not to change angular calculations, both existing fallback behaviors are preserved. This patch does not add relative angular snapping or claim to test it. SVG's existing helper, radius calculation, rounding, and independent constraint fallback remain unchanged; an eligible vertex bypasses them.

## Changed implementation

- `VectorDrawing/ActivePathVertexSnap.mjs`: shared eligibility, nearest-vertex selection, visibility checks, and transform-aware distance.
- `VectorDrawing/VectorInteraction.mjs`: raster Line preview snapping, intermediate reconnection, and explicit closed completion.
- `VectorDrawing/BindVectorInteraction.mjs`: injected snap resolver and Line-only Shift preview refresh, with normal listener cleanup.
- `VectorDrawing/VectorGeometry.mjs`: closed Lines serialize with `Z`; length includes the closing segment.
- SVG runtime parts `InstallSvgLinePlacement`, `HandleSvgPointerDrawingStart`, `CreateBeginLineToolAtHandler`, `PersistSvgAttention`, and `InstallSharedVectorTools`: resolve active committed vertices, preserve exact layer-local coordinates, invoke normal history/finish with a closure flag, and refresh on Shift changes.
- `RasterAnalysis/VectorAnalysisTools.mjs` and `PolygonStatistics.mjs`: visible active-path snapping and closed-Line handoff to the existing even-odd polygon region pipeline. The `closed` flag persists through the existing annotation session store and undo/redo.

No source raster pixels are changed. SVG remains native path geometry. No dependencies or persistence formats were added.

## Validation

Commands:

```sh
node --test ApplicationSystem/public/VectorDrawing/*.test.mjs ApplicationSystem/public/RasterAnalysis/*.test.mjs
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox ApplicationSystem/tests/vectorDrawing.electron.cjs --snap-only
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox ApplicationSystem/tests/vectorDrawing.electron.cjs
```

`ActivePathVertexSnap.test.mjs` covers eligibility, insufficient distinct vertices, nearest/ties, hidden candidates, zero-length rejection, transform-invariant tolerance, preview/commit identity, closure serialization, closing-edge length, and closed region coverage. `lineVertexSnapBrowser.mjs` exercises both actual tools at 0.75×, 1×, and 3× with pan/rotation; it verifies intermediate and start targeting, Shift release/press, leaving/reentering the radius, hidden/completed/current vertex exclusion, open completion, SVG angular fallback, transformed layer coordinates, undo/redo, SVG save/reload, and raster region handoff. The harness's existing native mouse tests check continuous multi-click drawing and completion.

The focused browser suite, all five unit-test files, and the full PNG/JPG/JPEG/EXIF/SVG browser regression suite passed on 2026-10-14. Native continuous-Line input, pointer capture, and Escape cleanup also passed. Shift snapping itself is exercised with browser-dispatched pointer/keyboard events; physical keyboard input, touch/pen input, arbitrary SVG clipping/masking, and occlusion by another window have not been manually verified. Visibility checks cover CSS visibility/display/opacity and locked ancestors, not geometric SVG clip-path/mask evaluation.
