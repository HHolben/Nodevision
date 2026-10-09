# PNG region analysis

In the PNG viewer and graphical editor, choose **View → Analysis Tools** to show the analysis subtoolbar. It is hidden on initial load and after changing files; there is no inline analysis dropdown. Clicking the View button again hides it and cancels any unfinished path. The command targets only the active raster panel. Choose **Region**, click polygon vertices, and close by clicking the first vertex, pressing Enter, or using **Finish path**. Escape cancels an unfinished path. Completing a path opens a normal undocked **Analysis** panel. The original PNG is never edited.

**Add polygon** unions pixels into the current selection; **Subtract polygon** removes pixels. Operations apply in drawing order, so a later addition can restore a previously removed area. Shading represents the resulting Boolean selection. Dashed outlines identify subtraction polygons. **Undo region** removes the last completed operation. **Clear** removes all regions. **Show results** reopens a dismissed results panel. Starting and completing another Region replaces the reference and all secondary operations; cancelling it preserves the old selection.

The first polygon is the fixed percentage reference. Each later polygon reports its overlap with that original area, divided by the original pixel count. Combined secondary coverage counts the union of these overlaps once, for both addition and subtraction polygons. It therefore stays between 0% and 100%. The panel separately reports the current selection size, net additions outside the original, and net removals inside it. Regions outside the original can enlarge the current selection without inflating the secondary coverage percentage.

Pixels are selected when their centers lie inside the polygon under the even-odd rule, clipped to the decoded image bounds. Transparent pixels count toward area. RGB averages weight sRGB channel values by alpha, excluding fully transparent RGB from the color average; mean opacity is reported separately. Empty/fully transparent selections have no average color. A zero-pixel original region has no percentage denominator, displayed as N/A. These are original-image measurements, independent of screen interpolation, zoom, rotation, and pan.

## Graphical editor

The same tools analyze the current raster canvas, including unsaved edits. Analysis adds no raster undo entries and changes no export pixels. Results refresh after brush/shape/fill completion, selection edits, canvas replacement, flips/rotations, and undo/redo. Regions remain at fixed canvas-pixel coordinates when pixels change. A canvas dimension change clears the reference and secondary regions; draw a new reference for the new dimensions. Closing the editor removes its analysis controls, worker, and floating panel.

`PNGeditorComponents/analysisTools.mjs` adapts the editor's canvas and native display scale to the shared analysis implementation. A resize observer aligns the SVG overlay; explicit editor mutation hooks invalidate cached worker pixels, coalesced to one refresh per animation frame. Scrolling moves the canvas and overlay together. The existing editor zoom capability and raster history remain authoritative.

## Integration

- `ToolbarJSONfiles/viewToolbar.json` registers Analysis Tools as a standard View callback with automatic subtoolbar creation disabled. The callback toggles the existing analysis controls and never appends menu buttons. `AnalysisToolsContext.mjs` resolves its target through the existing active-panel ownership rules.
- `ViewPNG.mjs` installs a hidden analysis subtoolbar and composes disposal with the raster viewport. The ModuleMap PNG viewer entry is unchanged.
- `ImageViewport.mjs` provides a small render subscription so the analysis SVG shares the image's presentation transform. It does not introduce another zoom controller.
- `RasterAnalysis/AnalysisPolygonTool.mjs` adapts the SVG editor's existing begin/place-line handlers to a private SVG drawing session. It reuses their consecutive line vertices without mounting an SVG editor, entering its history, or activating editing. This polygon tool exposes click-to-place, close, and cancel; it does not expose the editor's distance/axis/angle commands.
- `AnalysisRegionOverlay.mjs` uses an ordered SVG mask for selection shading. Masks, outlines, and temporary lines belong only to viewer UI.
- `PolygonStatistics.mjs` performs scanline pixel-center calculations. `PolygonStatisticsWorker.mjs` retains the source pixel buffer and computes away from the UI thread; request revisions discard stale responses. Decoding and the initial canvas read occur on the main thread.
- `PngAnalysisTools.mjs` owns the regions, worker, controls, and results-panel lifetime. `InfoPanels/PngAnalysis.mjs` presents results through the existing panel factory in floating mode. Source changes and viewer disposal terminate the worker and close its panel, including pending asynchronous opens. The FileView destruction hook now invokes the viewer's normal `_dispose` hook.

Regions are temporary per viewer and are not persisted or exported. Cross-origin images require readable canvas pixels; failures appear in the results panel rather than fabricated statistics. Large images require memory for one decoded RGBA buffer in the worker, and computation grows with image size and polygon count. Measurements use pixel centers rather than fractional edge-pixel coverage. No fisheye or zoom-routing behavior changes are included.

## Regression checks

```sh
node --test ApplicationSystem/public/RasterAnalysis/PolygonStatistics.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ImageViewportGeometry.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgLineToolFeedback.test.mjs ApplicationSystem/public/panels/panelContentLifecycle.test.mjs
python3 scripts/test-png-analysis-browser.py
```

The Chromium fixture loads the actual PNG viewer and floating-panel factory with synthetic red/blue source pixels. It covers average color, ordered addition/subtraction, percentages without duplicate overlaps, drawing after arbitrary rotation/pan/zoom, cancellation, undo, clearing, panel reopening, independent viewers, file reload, and disposal while a panel is still opening. Unit cases include clipping, empty and transparent selections, concave/self-intersecting polygons, and source immutability. No Notebook files are accessed.

The browser suite also exercises the real PNG graphical editor: unsaved canvas pixels, Boolean selection after native zoom and scrolling, automatic result refresh after replacement and brush strokes, undo/redo, dimension-change clearing, unchanged export pixels/history during analysis, and editor destruction.

The browser suite verifies hidden initial state in both surfaces, the View menu entry and button, per-panel activation, cancellation on hiding, reuse on reopening, and hidden state after reload.

Duplicate-menu regression: `python3 scripts/test-png-analysis-browser.py --toolbar` exercises the real toolbar renderer and callback loader. Six consecutive clicks must each toggle once and leave exactly one Analysis Tools button, without creating an automatic duplicate subtoolbar. The former script-widget entry appended another button on every click; the View entry now uses `ToolbarCallbacks/view/AnalysisTools.mjs` instead.
