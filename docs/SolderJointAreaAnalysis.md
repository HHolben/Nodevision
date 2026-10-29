# Solder Joint Area Analysis

## Launch and use

1. Open Nodevision’s Session selector and launch **Solder Joint Area Analysis**. The built-in session runs `solderAnalysis.open`.
2. Choose a `.jpg` or `.jpeg` with **Open JPEG**. Alternatively enter a Notebook-relative path and click **Open Notebook file**. This also accepts saved `.solder.json` files.
3. Choose **Total Area** in the shared Layers panel. Use **Polygon**, **Freehand**, or **Bezier** to outline each joint. Polygon: click vertices, then Enter, double-click, or click the first vertex. Freehand: drag; release closes the boundary. Bézier: click anchors or drag to create curve handles; Enter or click the first anchor closes the boundary. Escape cancels the draft.
4. Choose **Void Area** and draw internal regions. A void wholly contained by exactly one joint receives that parent automatically. Use the parent selector to correct an unassigned or incorrect parent. Parent relationships remain explicit when paths move.
5. Use **Select** and click an outline (or choose a region in the list). Drag the outline to move it, white vertices to reshape it, or yellow Bézier handles to adjust curves. **Delete region**, **Undo**, and **Redo** work on completed annotations. Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, and Ctrl/Cmd+Y control history. Deleting a parent retains its voids and warns that they need another parent.
6. Use **Pan** and drag, middle-button drag, or scrollbars. **Fit**, **100%**, **+**, **−**, and Ctrl+wheel control zoom. All coordinates remain native image coordinates. Visibility and locking apply independently to both layers; hidden regions still participate in analysis and reports.
7. The live panel shows the selected region’s area, mean RGBA, parent, joint percentages, counts, overall percentage, and validation warnings. **Dock / undock analysis panel** opens Nodevision’s standard panel shell; its normal docking controls remain available. Closing that panel returns its controls to the session.
8. **Save analysis** writes an editable `.solder.json` sidecar. Use **Reopen analysis** to resume it. The sidecar embeds the original JPEG bytes and stores its source name/reference, dimensions, stable region IDs, parent links, geometry, layer visibility/locks, and analysis options. History is session-local; reopening starts a fresh undo history.
9. Correct validation warnings, then click **Generate HTML Report**. For `sample.jpeg`, the suggested filename is `sample.html`. Reports contain the original image, annotated image, grouped measurements, and a void-only image. They work offline and include print CSS.

Notebook files save beside the source through Nodevision’s existing save API and overwrite prompt. Local browser uploads do not grant directory access: the native Save As dialog lets you choose the source directory and handles overwrite confirmation. Browsers without that API download the named file using their normal download conventions. The interface states which behavior applies. JPEG destinations are explicitly rejected by the native save adapter.

## Architecture and reuse

The built-in session uses the existing Session registry, command dispatcher, and session lifecycle. It temporarily disables the Session root’s Escape-to-exit behavior so Escape remains a drawing cancellation command, restoring that setting during cleanup.

`SolderJointAreaSession.mjs` owns the source, editable state, active selection, worker scheduling, and controls. `Editor.mjs` adapts the existing `BindVectorInteraction` controller and `VectorSvgRenderer` for polygons/freehand and the SVG editor’s `BezierToolController`/`BezierModel` for curved paths. It adds the session’s selection/movement/vertex handles to that shared model. History uses `createSvgUndoStack` custom transactions, with one entry per completed edit rather than per pointer movement.

Layers use the existing `createAnalysisLayers` registry and `SVGLayersPanel`. The shared panel accepts an optional session-owned provider without replacing the active document’s global Layers context. The information panel uses `createPanelDOM` and its normal docking/removal lifecycle. Existing SVG, PNG/JPG, and HTML editing entry points are unchanged.

`Measurement.mjs` is DOM-independent and reusable. It calls the existing `regionRow` rasterizer, `PathContours` curve subdivision, and `FilledRegion`/polygon-clipping geometry operations. `Worker.mjs` decodes the source JPEG once with `createImageBitmap` and reads an unscaled, unannotated OffscreenCanvas. The editor never supplies preview or overlay pixels to measurement. Color channels are the browser’s decoded sRGB values (including normal JPEG color-profile/orientation interpretation); alpha is 255. The original compressed bytes are retained unchanged.

The worker caches geometry, row spans, and mean colors by stable ID and geometry content. Only changed regions are rasterized again. Layer visibility, renumbering, and reparenting do not invalidate their pixel measurements. Bounding-box rejection avoids unnecessary polygon intersections. Union summaries and validation are recomputed after completed changes. Only one analysis request runs at a time; later edits replace pending work, stale results are ignored, and pointer movement does not enqueue measurements. Failed image loads preserve the previous analysis. Cleanup terminates workers and removes event listeners and panels.

The HTML report is generated directly from the same analysis result as the live panel. `Report.mjs` escapes metadata and emits semantic tables, original JPEG data URLs, SVG overlays, and self-contained CSS. There is no dependency on Nodevision at report-viewing time. An existing HTML editor document is not used as an intermediate: no conversion or raster recompression is needed.

## Measurement and validation

- A pixel is included when its center `(x + 0.5, y + 0.5)` is inside the even-odd filled boundary. Scanline crossings use half-open coverage: left/top inclusive, right/bottom exclusive. Fractional coordinates use the same rule. Masks have no antialiasing weights.
- Area is an integer count of included original pixels. Mean RGBA is the sum of each decoded channel divided by that count; values remain unrounded internally. Display percentages and channel means use two decimal places.
- Bézier boundaries use the existing adaptive path subdivision with a configured tolerance of **0.001 image pixel**. Curve measurement is consequently a numerical approximation at that tolerance; it does not depend on zoom. The report preserves the actual vector curve.
- Geometric intersection/difference checks reject overlapping red interiors, out-of-image paths, voids extending outside their chosen parent, and voids intersecting another parent. Shared boundaries with zero intersection area are permitted. Checks are geometric, so subpixel boundary excursions cannot disappear merely because they contain no pixel centers.
- Invalid/self-intersecting or zero-area paths and regions containing no pixel centers are flagged. Geometry is never silently clipped. Reports remain unavailable until warnings are corrected. Unfinished gestures must be completed or canceled before saving/exporting.
- Per-parent void area merges child row spans, counting overlaps only once. A joint’s percentage is `100 × unionVoidArea / jointArea`. The overall percentage is `100 × sum(unionVoidAreas) / sum(jointAreas)`, never an average of percentages. Red overlap validation makes that total unambiguous.
- Stable IDs are separate from display labels. Red labels run A–Z, AA, AB, etc.; blue labels number independently within each parent. Labels may change after deletion or reassignment without changing IDs.

## Changed and added files

Integration:

- `ApplicationSystem/Sessions/BuiltIn/SolderJointAreaAnalysis.NodevisionSession.js` — discoverable session.
- `ApplicationSystem/public/Commands/CommandDefinitions.mjs`
- `ApplicationSystem/public/Commands/NodevisionCommandRegistry.mjs`
- `ApplicationSystem/public/Commands/handlers/SystemCommands.mjs` — command registration and lazy entry point.
- `ApplicationSystem/public/PanelInstances/InfoPanels/SVGLayersPanel.mjs` — optional session-owned provider.

Implementation:

- `ApplicationSystem/public/Sessions/SolderJointAreaSession.mjs`
- `ApplicationSystem/public/PanelInstances/InfoPanels/SolderAnalysisPanel.mjs`
- `ApplicationSystem/public/SolderAnalysis/Editor.mjs`
- `ApplicationSystem/public/SolderAnalysis/Measurement.mjs`
- `ApplicationSystem/public/SolderAnalysis/Worker.mjs`
- `ApplicationSystem/public/SolderAnalysis/Document.mjs`
- `ApplicationSystem/public/SolderAnalysis/Files.mjs`
- `ApplicationSystem/public/SolderAnalysis/Report.mjs`

Tests and documentation:

- `ApplicationSystem/public/SolderAnalysis/Measurement.test.mjs`
- `scripts/solder-analysis-browser.mjs`
- `scripts/test-solder-analysis-browser.py`
- `docs/SolderJointAreaAnalysis.md`

## Verification

Run deterministic measurement/document/report tests:

```sh
node --test --test-isolation=none ApplicationSystem/public/SolderAnalysis/Measurement.test.mjs
```

Run the Chromium workflow regression (requires a local loopback HTTP server):

```sh
python3 scripts/test-solder-analysis-browser.py
```

The browser fixture opens a real JPEG through the file-input handler, draws multiple parents/voids, checks union percentages, exports and inspects HTML, saves/reopens editable state, edits vertices, undoes/redoes, uses Bézier/freehand, cancels drafts, checks layer locking and zoom, verifies failed-reopen recovery, exercises the native-save adapter, and opens/closes the real dockable information panel. Pointer events are dispatched in browser coordinates through the production editor bindings; native OS file-picker dialogs are not automated. File writes are intercepted so tests do not create user files.

The deterministic suite includes known constant and variable pixel values, concavity, fractional boundaries, even-odd holes, invalid geometry, subpixel containment, duplicate/overlapping voids, weighted percentages, stable labels, persistence, report filename/sections, and cache invalidation on a 2048 × 2048 image with 100 regions.

Verified results:

- **14/14** new deterministic measurement, persistence, and report tests passed.
- **31/31** relevant existing vector, raster measurement, SVG geometry, Session registry/adapter, and command-registry regression checks passed (**45 total Node checks**).
- **30/30** Chromium workflow assertions passed using the production editor, worker, Layers panel, and dockable panel modules.
- `git diff --check` passed. Unrelated pre-existing graph-viewer changes were left untouched.

## Remaining limitations

- No automatic void detection: regions are manually drawn.
- The UI creates independent simple closed paths. Self-intersections are rejected; compound-path authoring is not exposed, although the measurement rasterizer supports even-odd multiple contours.
- Curves use numerical subdivision, as described above. Canvas decode limits and available memory bound supported JPEG size; a full-resolution RGBA buffer resides in the worker. The regression fixture is a representative cache/performance check, not a hardware-independent latency guarantee for arbitrarily large images.
- Local file output uses Save As/download conventions rather than unrestricted access to the upload’s original directory. Native Save As and server permission errors are surfaced to the user.
- Reports embed the JPEG in all four sections, increasing file size. Tables preserve parent/child grouping and are not sortable in this version.
- Saved geometry is editable, but the prior session’s undo history and current zoom/pan position are not persisted.
