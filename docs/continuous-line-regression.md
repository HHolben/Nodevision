# Continuous Line drawing correction

Investigation identified `bd29c86` (`more analysis tools`) as the introduction of the competing shared vector event binding. Its capture-phase listener classified Line as a drag tool and finished it on pointer release. SVG attempted to recover click chaining only when movement between down and up was less than three CSS pixels. This made the established multi-click interaction dependent on a drag threshold. Raster Line used the same drag controller without the fallback. Existing tests expected drag-created lines and tested only two vertices in the SVG fallback.

The preceding SVG implementation already maintained arbitrary committed vertices and a separate hover segment. Enter and double-click finished; Escape canceled (first clearing a transient constraint/grab when applicable); switching tools finished committed vertices. It used temporary individual lines and converted three or more vertices to a closed polygon. That older output behavior also needed correction to satisfy the requested single open SVG path.

SVG Line now bypasses the shared drag binding entirely, preserving its existing coordinate conversion, snapping, axis/angle entry, vertex grab, and feedback controller. Temporary segments carry the editor UI attribute, so they are excluded from serialization. Completion removes them and commits one open `M/L` path through snapshot history, selecting that path. Hover coordinates are never included. Undo during a draft cancels it; undo/redo after completion operates on the whole path. Pointer cancellation and panel deactivation clear drafts. SVG tool switching retains the established finish behavior.

Raster Line uses the shared multi-click lifecycle already used by Polygon, with open geometry and two vertices as the minimum. Each click appends a vertex, pointer release does not finish, and hover previews append only a transient endpoint. Enter/double-click commits, Escape/tool switching discards the draft. Measurements sum every segment. The geometry serializer accepts the previous start/end line representation as well as the new vertex array. Circle, Ellipse, Rectangle, Arc, Polygon, and Freehand retain their respective lifecycles.

Sharing geometry/serialization avoids duplicating path and length logic while retaining SVG's richer constraint controller. No global state, toolbar updates, Layers rebuilds, or document scans were added to pointer movement.

Raster annotations retain their existing in-memory lifetime; this change does not add cross-session annotation storage or modify image pixels. SVG save/reload is tested through the real editor's serialization and loading APIs; the isolated fixture does not write Notebook files.

Validation uses `node --test` for shared vector geometry/controller and existing SVG Line feedback checks, and `ApplicationSystem/tests/vectorDrawing.electron.cjs` under Electron for actual editor and image adapters. The Electron suite covers PNG, JPG, JPEG, oriented JPEG, all other vector tools, five-vertex Line drafts, cancellation, switching, history, and native SVG mouse input plus save/reload.

## Changed files

- `ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateAddEventListenerPointercancelHandler.mjs`
- `ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateBeginLineToolAtHandler.mjs`
- `ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSharedVectorTools.mjs`
- `ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgHistoryAndLifecycle.mjs`
- `ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/PersistSvgAttention.mjs`
- `ApplicationSystem/public/RasterAnalysis/VectorAnalysisTools.mjs`
- `ApplicationSystem/public/VectorDrawing/BindVectorInteraction.mjs`
- `ApplicationSystem/public/VectorDrawing/VectorDrawing.test.mjs`
- `ApplicationSystem/public/VectorDrawing/VectorGeometry.mjs`
- `ApplicationSystem/public/VectorDrawing/VectorInteraction.mjs`
- `ApplicationSystem/tests/vectorDrawing.electron.cjs`
- `ApplicationSystem/tests/vectorDrawingBrowser.mjs`
- `ApplicationSystem/tests/vectorDrawingSvgBrowser.mjs`
- `ApplicationSystem/tests/continuousLineBrowser.mjs`

- `docs/vector-drawing-analysis.md`
- `docs/continuous-line-regression.md`

## Test results

The expanded Node test run passed 18 of 21 test files. The three failures (`PencilSketchAngleFit.test.mjs`, `PencilSketchTriangleFit.test.mjs`, and `ShapeRecognition.test.mjs`) were reproduced with the same assertions on an untouched archive of HEAD. Shared vector, SVG Line feedback, SVG preservation/history-related checks, and raster statistics passed.

Final Electron run exited 0: PNG, JPG, JPEG, EXIF-oriented JPEG, all six SVG toolbar tools, annotation history/cleanup, and native pointer capture passed. Native five-click SVG Line (including five CSS pixels of movement during the initial press), released-pointer hover, Enter/double-click completion, Escape, tool switching, draft undo/pointer cancellation, full-path undo/redo, save/reload, and transformed-layer coordinates passed. Focused Node validation passed all three test files (vector geometry/interaction, SVG Line feedback, and raster pixel statistics). `git diff --check` passed.

Reproduce the full integration run:

```sh
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox ApplicationSystem/tests/vectorDrawing.electron.cjs
```

Append `--svg-only` for the SVG and native pointer subset.
