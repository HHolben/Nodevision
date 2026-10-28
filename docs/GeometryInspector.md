# SVG Geometry Inspector

Open **View → Geometry Inspector** while an SVG editor or viewer is active. The inspector is a standard information-panel tab. Existing workspace commands move, dock, resize, close and restore it; repeated opening focuses the existing tab. It can share a cell with Layers or move to another cell. The inspector contains no editing controls.

## Integration and changed files

- `ApplicationSystem/public/ToolbarJSONfiles/viewToolbar.json`: document-based SVG menu entry, using the existing panel loader and instance lookup.
- `ApplicationSystem/public/PanelInstances/InfoPanels/GeometryInspectorPanel.mjs`: compact read-only display and panel cleanup.
- `ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSVG.mjs`: installs selection methods on the existing viewer Layers context.
- `ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/panel.mjs`: consumes shared displayed-child ordering.
- `ApplicationSystem/public/SvgGeometry/`: measurement, adaptive contours, fill-region winding, coordinates/units, shared ordering, viewer selection, inspector subscriptions, and unit tests.
- `scripts/svg-geometry-browser.mjs` and `scripts/test-svg-layers-browser.py`: browser regression coverage and runner option.

The inspector resolves providers through the existing `getActiveSvgLayersContext`. It reads editor selection directly, subscribing to existing selection, mutation and provider events. The viewer's existing Layers context now owns inspection selection outside the SVG DOM; the Layers panel calls the same selection-method interface as the editor. Closing Layers or the inspector does not discard viewer selection. No editor is initialized by inspection.

A document MutationObserver catches attribute edits, history restores, reorder/reparent operations and stylesheet changes within the SVG. Updates are coalesced to animation frames. Measurements are cached by selected element until document mutation; selection changes only measure the new selection. The inspector does not rebuild toolbars or Layers, parse a second document, or scan all document objects on pointer movement. Observers and subscriptions are removed on panel cleanup.

## Geometry and numerical conventions

Supported shapes are rectangles (including rounded corners), circles, ellipses, polygons, closed polylines, lines, SVG paths and groups of supported shapes. Paths accept absolute/relative M/L/H/V/C/S/Q/T/A/Z commands with repeated coordinate sets. The existing editable Bezier model supports fewer commands, so measurement uses a separate contour conversion utility without replacing document parsing or editor geometry state.

Quadratic and cubic Beziers use adaptive de Casteljau subdivision, controlling the control-polygon-length excess over its chord. Arcs use the SVG endpoint-to-center conversion and a curvature-dependent angular subdivision. The absolute contour tolerance is 0.00001 display units. Footprints use transformed contour extrema, not rotated bounding-box corners; curved bounds, areas and lengths are numerical approximations. Precision is independent of camera zoom and screen resolution. Depth/point budgets bound pathological inputs; supported budgets are not a guarantee of interactive performance on arbitrarily complex artwork.

The existing MIT-licensed `vendor/geographic/clipping.mjs` resolves compound regions. Evenodd uses symmetric differences. Nonzero partitions simple subpaths into integer winding regions, preserving opposite-winding cancellation through nested and overlapping subpaths. Closed-object perimeter is the boundary of the resulting region, including holes and excluding redundant interior edges. Groups use the union of supported child regions, so overlaps are not double-counted.

Open geometry reports **Path Length**, summing raw constituent segments. Open paths with meaningful fill receive area using SVG implicit closing edges; those implicit edges are excluded from path length. Open unfilled paths, open polylines and collinear open paths report unavailable area. A mixed open/closed group reports raw constituent path length, explicitly described in the panel. Zero and unavailable remain distinct.

Bounds and measurements exclude strokes, markers, masks, clipping and filter effects. Hidden and locked objects remain inspectable. Translation, rotation, nonuniform scale, skew and inherited SVG transform lists are applied in document coordinates without modifying those lists.

## Units

Without reliable physical dimensions, values use root SVG user units and square user units. Pixel dimensions never imply millimeters. When both root dimensions explicitly use mm, cm, in, pt, pc or Q, measurements use the width's unit, applying the viewBox and preserveAspectRatio scaling (including anisotropic `none`). Without a viewBox, physical conversion follows SVG's 96 CSS pixels per inch. Root CSS camera transforms and external editor zoom/pan do not affect measurements.

## Document order

Position is **N / Total**, top first, within the selected object's displayed sibling scope. `layerPanelChildren` is shared with Layers. Nested objects also display their parent group. Dedicated `data-layer` groups use their dedicated layer-header sibling scope; loose document objects use the document-content scope. Hidden and locked objects count. Definitions/metadata count when the existing Layers panel exposes them as selectable rows; editor overlays and sketch construction rows do not count. This preserves the existing hierarchy instead of introducing a flattened ordering.

## Limitations

- Text, images, linked `<use>` content, nested SVG viewports, and groups containing unsupported content report unavailable measurements.
- Self-intersecting/self-touching subpaths are not supported. Detected intersections report unavailable rather than an invented area. Degenerate overlapping collinear segments are not a supported winding case.
- CSS transform overrides/origins are unavailable. Geometry supplied through CSS geometry properties, animation, external stylesheets that change without a document mutation, and compact concatenated arc-flag syntax are not supported. Use SVG attributes and ordinary separated arc flags.
- Displayed curved geometry is approximate; this is not an exact symbolic geometry or manufacturing metrology engine.
- Multiple selection reports its count and does not calculate aggregate geometry.

## Validation

Run:

```
node --test ApplicationSystem/public/SvgGeometry/Geometry.test.mjs ApplicationSystem/public/PanelInstances/Common/Layers/svgLayersContext.test.mjs
python3 scripts/test-svg-layers-browser.py --svg-geometry
python3 scripts/test-svg-layers-browser.py
```

The geometry browser suite checks analytic rectangle, circle, ellipse, rounded rectangle, polygon, quadratic and cubic cases; arc and smooth commands; holes and opposite-winding overlaps; nested transforms and groups; physical/viewBox units; hidden and unsupported objects; 1/12 and 12/12 ordering; zoom independence; actual viewer Layers selection; actual editor edits, undo/redo and reparenting; empty/multiple selections; unchanged SVG serialization; duplicate tabs, coexistence with Layers, tab movement, layout serialization and close/reopen. Existing snapshot undo clears editor selection; the inspector respects that and shows restored measurements when the object is reselected.

Validation result: all 90 geometry/inspector browser checks passed, both Node test files passed, and the existing SVG Layers browser regression passed (including its 1,200-object drag-work checks). `git diff --check` passed.

The automated docking check exercises shared tab movement and serialization, not a manual drag/resize or application restart. There is no new dependency or change to SVG export/serialization.
