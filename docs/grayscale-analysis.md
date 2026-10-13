# Grayscale analysis

## Architecture audit

`ViewPNG.mjs` and `ViewJPG.mjs` already share `renderRasterFile` and `ImageViewport`; ModuleMap dispatches PNG, JPG, and JPEG case-insensitively. The browser decodes the original image, including EXIF orientation, before natural dimensions and canvas pixels are used. The raster editor uses the same analysis tools through `PNGeditorComponents/analysisTools.mjs`, which publishes presentation and pixel-change notifications.

`PngAnalysisTools` owns image-local polygon regions, a pointer-transparent SVG overlay, and the floating `PngAnalysis` results panel. `VectorAnalysisTools` provides polygon, circle, ellipse, and rectangle annotations that become regions through Analyze annotation. Lines, arcs, and freehand annotations remain open measurement paths. `PolygonStatistics` implements pixel-center scanlines, ordered region addition/subtraction, and alpha-weighted RGB statistics; its existing worker and geometry are reused.

There was no persisted raster annotation schema or general mask graph. The partial grayscale implementation already in the working tree supplied mask, layer, worker-client, and control modules. This implementation completes their integration and addresses stale worker transfers, hidden-overlay refresh, and restoration. The existing `EditorAttentionState` per-file context already accepts serializable `panels` data. Analysis adds `panels.rasterAnalysis` there, rather than a new storage backend, Notebook sidecar, or modified image format. Existing unrelated panel state is preserved.

## User workflow

Open PNG, JPG, or JPEG in File View or its graphical raster editor. Choose **View > Analysis Tools > Grayscale Analysis**. Lower and upper percentage controls default to 0 and 100 and update on input. Each slider has a numeric field supporting decimals; crossing a bound clamps the edited value to the other bound.

Each new grayscale layer has an explicit AND intersection with the current Vector region. Draw a Region polygon, or draw a Circle, Ellipse, Rectangle, or Polygon annotation and choose Analyze annotation. The intersection reports matching pixels, total region pixels, and **Selected Grayscale Area: xx.xx% of Region**. Changing thresholds retains the geometry. Open annotations remain available alongside grayscale layers. Existing RGB statistics continue to measure their original region, independently of grayscale.

Add grayscale layers, change their thresholds and visualization, edit intersection inputs, toggle visibility/enabled state, reorder overlays, or remove individual layers in the existing analysis results panel. Each layer's controls belong to its source image even while another panel is active.

## Numerical conventions

- Intensity is gamma-encoded sRGB luma, not linear-light relative luminance: `(0.2126 R + 0.7152 G + 0.0722 B) / 255 * 100`. Integer-equivalent coefficients and Float64 storage preserve exact black/white endpoints and decimal thresholds. Both limits are inclusive.
- The source is the browser-decoded, sRGB canvas representation. JPEG compression, EXIF orientation, and browser color management therefore affect decoded pixels consistently with the rendered source.
- Alpha zero is ineligible. Every nonzero-alpha pixel counts once using its decoded unpremultiplied RGB, without compositing onto a background or weighting its count by opacity. Partially transparent pixels are included. Browser precision when unpremultiplying very small alpha values remains applicable.
- Image percentage uses the number of nonzero-alpha image pixels as its denominator. Region percentage uses all covered region pixels, including transparent ones, preserving the existing area convention. A transparent pixel can be in the region but cannot match grayscale. Empty denominators report N/A.
- Regions sample pixel centers `(x + 0.5, y + 0.5)` clipped to decoded image dimensions. There is no fractional coverage or antialias weighting. Polygons use the existing even-odd scanline rule, with left boundaries included and right boundaries excluded; vertical crossing tests are half-open. Rectangles include top/left and exclude bottom/right. Circles and ellipses use analytic row intersections, exclude tangent rows, and use the same left-inclusive/right-exclusive convention. Visual antialiasing does not affect counts.

## Layer and mask contracts

`AnalysisLayers.mjs` maintains image-session records `{ id, type, name, enabled, visible, order, config }`. Types initially include `grayscale`, `region`, and `intersection`. Grayscale config holds thresholds, mode, color, and opacity. An intersection's `config.inputs` is an explicit array of layer IDs. The initial `regions` layer represents the current aggregate region, including existing ordered additions/subtractions.

`PixelMasks.mjs` produces image-sized, row-major `Uint8Array` masks containing zero or one. Masks stay in the worker. `AnalysisMaskEngine.mjs` resolves dependencies and caches masks, counts, and rendering signatures. Results returned to the panel contain layer IDs, availability, counts, denominators, percentages, and changed visualization buffers. Tools consume grayscale through explicit intersection inputs in this shared evaluator. Polygon, circle, ellipse, and rectangle region workflows therefore support grayscale-restricted pixel-area measurements without tool-specific grayscale code.

Visibility and ordering affect rendering only. Disabled or missing inputs make dependent intersections unavailable; they never imply an unrestricted mask. Dependency cycles and empty input lists are unavailable. Nested AND evaluation is supported by the engine; the initial UI offers primitive mask inputs. Deleting a layer preserves surviving layers and explicit references, making broken dependencies visible as unavailable. Drawing a new region can restore a removed region layer.

An intersection with a direct region input reports that region's denominator. Intersections of grayscale bands report eligible-image percentages. Future operators can be added to the evaluator alongside AND without deriving their inputs from visual order. OR, inversion, and mask subtraction are not implemented; existing polygon add/subtract region construction is retained.

## Rendering, performance, and lifecycle

Highlight overlays use configurable color and opacity (default gold at 45%). Binary mode renders white selected pixels and black unselected pixels, including ineligible transparent pixels. Isolate mode leaves selected pixels untouched and dims other pixels with black at alpha 200/255. Modes never alter masks or source pixels. Multiple visible overlays blend in their declared visual order.

Canvases copy the existing image-coordinate SVG presentation size/transform and use native pixel dimensions. They have no pointer handling; vector tools continue receiving input through the SVG. Zoom, pan, arbitrary presentation rotation, and panel resize require no mask recomputation. Viewport buttons remain above analysis overlays.

The worker client reads/transfers source pixels once per image revision and coalesces updates behind one outstanding request. Luma, region coverage, masks, counts, and existing RGB statistics are cached independently. Only changed visible outputs allocate/transmit RGBA buffers. Discarded stale replies trigger a rendering refresh because their transferred buffers were never displayed. Visibility changes also consult the worker so newly visible masks cannot display an old threshold. Canvas backing stores own rendered results; panel state does not retain duplicate RGBA arrays.

Source edits invalidate worker caches. Raster-editor dimension changes clear geometry that no longer describes the original coordinate extent. Threshold settings survive. Disposal terminates workers and releases canvases, listeners, pixel buffers, and layer caches. Pixel readback and `putImageData` occur on the UI thread; scanning, thresholding, intersections, and visualization generation occur in the worker.

## Persistence and limits

The existing editing-context store saves dimensions, layer settings, explicit input IDs, regions, and vector annotations. Changes are debounced, and page-hide/disposal flush the snapshot. No masks or pixel buffers are stored. Reopening restores geometry only when image dimensions match; configuration survives dimension changes and masks are recomputed from current source pixels.

Persistence inherits the existing browser-local storage limits and per-file path identity; it is not a portable analysis export or a multi-user format. Concurrent views of the same file keep independent live sessions; the last saved context wins on reopening. Annotation undo history is session-local. Existing raster tools do not offer general vertex/handle editing after creation; region replacement, add/subtract, and annotation undo/redo remain available. Viewer rotation is non-destructive presentation; graphical-editor rotate/crop commands retain their existing destructive-edit semantics.

Large images still require full-resolution source, luma, and per-layer masks in worker memory, plus backing canvases for rendered layers. There is no tiling or GPU mask pipeline. Future work can add those for very large datasets, additional mask operators, portable analysis export, and consumers such as masked RGB statistics.

## Files and validation

Core files are under `ApplicationSystem/public/RasterAnalysis`: `PixelMasks`, `AnalysisLayers`, `AnalysisMaskEngine`, `ImageAnalysisWorkerClient`, `GrayscaleAnalysisSession`, `GrayscaleLayerControls`, `AnalysisSessionState`, and their tests. Existing integration files are `PngAnalysisTools`, `VectorAnalysisTools`, `PolygonStatisticsWorker`, `PanelInstances/InfoPanels/PngAnalysis`, and `ToolbarJSONfiles/viewToolbar.json`. The new menu callback is `ToolbarCallbacks/view/GrayscaleAnalysis.mjs`.

Focused checks:

```sh
node ApplicationSystem/public/RasterAnalysis/GrayscaleAnalysis.test.mjs
node ApplicationSystem/public/RasterAnalysis/ImageAnalysisWorkerClient.test.mjs
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox ApplicationSystem/tests/grayscaleAnalysis.electron.cjs
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox ApplicationSystem/tests/vectorDrawing.electron.cjs
```

The grayscale browser suite covers opaque/transparent PNG, JPG/JPEG decoding, sliders/numeric controls, all visual modes, polygon/circle intersections, hidden/disabled/reordered/removed layers, transformed alignment, session restoration, and actual raster-editor edit/rotate/undo invalidation. It also checks narrow/desktop panel layout and writes screenshots to `/tmp/nodevision-grayscale-{1100,390}.png`. The existing vector browser suite covers all raster drawing tools, EXIF-oriented JPEGs, actual SVG editing/save/history, toolbar ownership, and native pointer capture. Node regressions cover thresholds, alpha, boundaries, dependencies/cycles, stale worker transfers, existing pixel statistics, vector geometry, image transforms, SVG preservation, panel context, and editing-context state.

Validation completed on 2026-10-13: all 12 grayscale unit cases, the worker-coalescing test, nine existing regression files, and both Electron suites passed. Desktop and 390-pixel screenshots were inspected; controls fit without horizontal overflow. A local 2048-by-2048 evaluation measured about 411 ms initially, 87 ms after a threshold change, and under 1 ms for an unchanged cached evaluation. These timings measure the evaluator, not end-to-end browser latency, and are machine-specific. No external dependencies were added.
