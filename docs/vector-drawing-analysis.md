# Vector drawing and raster analysis

## Architecture audit

The SVG editor is assembled by `SVGeditorRuntimeParts`. `drawToolbar.json` and the dynamic toolbar callback loader expose Draw commands; callbacks activate `SVGEditorContext.setMode`. The contextual cursor provider also exposes SVG modes. Previously, Line used click-to-chain placement with snapping, numerical constraints, previews, and its own history finalization. Circle and three-point-through Arc implementations existed behind cursor modes, but the five requested shapes were not exposed together under Vector Draw.

SVG pointer handlers live in `ConnectSvgPointerEvents` and its handler modules. `svgDom.toSvgPoint`, root/layer conversions, the active-layer manager, selection methods, and `runSvgSnapshotOperation` provide the existing coordinate, styling, selection, and history infrastructure. Serialization removes editor UI with `SvgPreservation`; new artwork therefore needs no custom saved representation.

PNG viewing used `ViewPNG` and `ImageViewport`. JPEG already had ModuleMap entries but used a separate `ViewJPG` mounting path without analysis. The viewport retains the decoded image, uses natural dimensions, and publishes transform changes for fit, zoom, pan, rotation, and resize. The raster editor exposes a compatible canvas adapter through `PNGeditorComponents/analysisTools.mjs`.

`PngAnalysisTools` registers View → Analysis Tools through `AnalysisToolsContext`, scoped to the active panel. It stores transient ordered regions as `{ operation, points }`, renders an SVG mask, and sends original decoded pixels to `PolygonStatisticsWorker`. Statistics use pixel-center scanlines, ordered addition/subtraction, and alpha-weighted color averages. There was no persisted annotation format, analytic shape measurement system, or physical-unit calibration in this workflow.

## Implementation

Shared modules under `ApplicationSystem/public/VectorDrawing/`:

- `VectorGeometry.mjs`: six tool identifiers, validated native-coordinate geometry, native SVG attributes, and analytic dimensions/area. Arc records include separate radii and rotation for a future elliptical implementation.
- `VectorInteraction.mjs`: drag gestures, three-click arcs, polygon editing, live previews, and cancellation, independent of the DOM.
- `BindVectorInteraction.mjs`: pointer capture/release, pointer identity, keyboard routing, panel/window cancellation, and disposable event bindings.
- `VectorSvgRenderer.mjs`: native SVG elements and disposable draft previews.

`InstallSharedVectorTools.mjs` adapts these modules to SVG active layers, current styles, selection, and snapshot undo/redo. Mode changes, history restoration, and editor disposal cancel unfinished gestures. Preview elements are marked as editor UI and excluded from saved SVG. Line supports drag creation; a stationary click hands off to the established click-chain interaction so its numerical/axis controls remain available. Legacy line segments use the shared geometry validator and SVG attributes.

Five toolbar callback modules and five entries in `drawToolbar.json` extend the existing registration conventions. The SVG cursor provider and supported-mode set consume the shared tool identifiers. Existing drawing tools remain available. The superseded circle/three-point-arc placement implementations and pointer branches were removed; the Line angle-feedback helper remains.

`VectorAnalysisTools.mjs` adds all six tools to the existing analysis subtoolbar. It exposes transient `analysis.annotations`, `selectedGeometry`, and `measurements`; annotation undo/redo affects only this overlay. Select annotation enables outline selection. Analyze annotation sends a closed shape to the existing region worker. Rectangle, circle, and ellipse scanlines use analytic boundaries, while polygon coverage retains the existing even-odd implementation. Existing region records retain their format; geometry-backed records are transient additions, not a migration of saved data. `AnalysisPolygonTool` now adapts the original Region/Add/Subtract controls to the shared polygon controller.

## Coordinates, formats, and preservation

Raster overlays use a viewBox matching decoded native dimensions and exactly the image's CSS size and transform. Pointer coordinates use the inverse overlay screen CTM. Zoom, pan, rotation, and panel resize change presentation only; annotation coordinates and measurements remain unchanged. The raster editor adapter uses the live canvas dimensions and invalidates pixel snapshots after edits; dimension changes clear obsolete annotations and regions.

ModuleMap continues to route PNG through `ViewPNG` and both JPG/JPEG through `ViewJPG`; JPEG now delegates to the same `renderRasterFile` implementation. The existing extension resolver is case-insensitive and strips query/fragment suffixes. JPEG variants use `image/jpeg`; browser image decoding handles the response content type. No image conversion or re-encoding is introduced. The PNG-only Vectorize command retains its original scope.

The displayed image explicitly uses `image-orientation: from-image`. The Electron regression uses an EXIF orientation-6 JPEG and verifies both oriented natural dimensions and canvas pixel orientation. PNG transparency remains intact. Analysis never writes source pixels or saves over source image files.

## Interaction and manual checks

1. Open an SVG in the graphical editor. Choose Draw → Vector Draw and verify Line, Circle, Ellipse, Arc, Rectangle, and Polygon. The contextual cursor family also lists all six.
2. Drag a line or center-to-edge circle. Drag rectangles and ellipses in each diagonal direction. Check live previews, current stroke/fill settings, selection, and undo/redo.
3. For Arc, click center, radius/start, then end. Move the pointer before the last click. Clockwise is the default; hold Shift at the endpoint for counterclockwise. Try arcs larger and smaller than 180 degrees.
4. For Polygon, click at least three non-collinear vertices. Backspace removes the latest vertex; Enter or double-click completes it. Escape cancels any unfinished shape. Repeat while switching tools and panels.
5. For legacy Line, click and release without dragging, then click another endpoint. Confirm numerical/axis controls and Enter completion still work.
6. Draw in a translated/scaled SVG layer. Save and reopen; inspect native `line`, `circle`, `ellipse`, `path`, `rect`, and `polygon` elements. Confirm drafts are absent from saved markup.
7. Open PNG, JPG, JPEG, and uppercase-extension variants in File View. Open View → Analysis Tools. Draw each shape, choose Select annotation, click an outline, and inspect pixel measurements.
8. Choose Analyze annotation for a closed shape. Verify pixel statistics. Also exercise the original Region, Add polygon, Subtract polygon, Undo region, Clear, and Show results controls.
9. At 50%, 100%, and 400% zoom, pan, rotate, and resize the panel. Check that outlines remain registered to the same pixels and measurements remain unchanged. Test a transparent PNG and an EXIF-rotated JPEG.
10. Verify annotation undo/redo, Escape during a drag, a panel switch during polygon placement, and reopening a different image. Source images should remain unchanged. The same analysis toolbar is available over the raster editor canvas.

## Automated validation

Run from the repository root:

```sh
node ApplicationSystem/public/VectorDrawing/VectorDrawing.test.mjs
node ApplicationSystem/public/RasterAnalysis/PolygonStatistics.test.mjs
node --test ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgLineToolFeedback.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgPreservation.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgLayerPreservationSource.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgPathPreservation.test.mjs ApplicationSystem/public/panels/panelTabContextRegression.test.mjs
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox ApplicationSystem/tests/vectorDrawing.electron.cjs
```

Geometry/interaction: 12 tests pass, covering radii, axes, all rectangle drag directions, directed arcs and flags, polygon closure/editing, invalid geometry, pointer identity, cancellation, DOMPoint-style coordinates, and freehand sampling/cancellation. Pixel statistics: 8 tests pass, including existing Boolean/alpha regressions and analytic vector ROIs. Existing Line feedback, SVG preservation, panel-context, and contextual cursor-registry regressions pass (eight test files total, including the two focused suites).

The Electron harness uses generated in-memory PNG/JPEG fixtures and a temporary profile; it writes no Notebook fixtures. It covers all six tools per format, uppercase dispatch, actual statistics-worker results, original region controls, native dimensions, EXIF orientation, transparency, overlay transforms, annotation history, SVG toolbar callbacks/save/history, transformed layers, legacy Line, panel cancellation, and real mouse pointer capture/Escape release. The complete browser checks, including original region controls and native pointer capture/Escape release, pass.

## Limitations

- Raster annotations remain transient, as existing analysis regions were; reopening a viewer discards them. No persistence format was introduced.
- Arc creation is circular. The model leaves room for elliptical radii, but elliptical-arc interaction and measurements are deferred.
- Measurements use pixels/pixels squared. No physical calibration system was found in this analysis path.
- Analytic polygon area uses the shoelace formula; use simple polygons for area measurements. Pixel coverage continues to use even-odd scanlines, including existing self-intersecting region behavior.
- The overlay supports drawing, selection, and undo/redo; general post-creation vector editing in raster analysis is deferred. SVG objects retain the editor's existing selection/editing capabilities.
- Automated browser tests cover the shared File View pipeline and actual SVG editor. Raster-editor canvas resize/edit invalidation and touch/stylus interaction should also receive manual testing.

## Freehand analysis annotations

View → Analysis Tools now also offers **Freehand** for PNG/JPG/JPEG images and the shared raster-editor analysis overlay. Drag to trace an open stroke; release to commit it. Samples remain in native image coordinates, and the selected annotation reports the total sampled path length in pixels. Each stroke is one annotation undo/redo action. Escape, tool changes, and panel changes cancel unfinished strokes. Stationary clicks do not create empty annotations.

Freehand uses the shared vector controller, renderer, selection, and transient annotation history. It renders as an unfilled SVG polyline with rounded joins. It does not modify source pixels or replace SVG editing's existing freehand brush. Open freehand strokes are not pixel-analysis regions; use a closed shape for Analyze annotation. The geometry suite adds two freehand tests, and the Electron suite checks creation, preview, native path length, transformed coordinates, undo/redo, and cancellation on PNG, JPG, JPEG, and EXIF-oriented JPEG.
