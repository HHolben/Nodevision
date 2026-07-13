# SVG Drawing Assist Implementation

This document describes the first major Nodevision SVG drawing-assistance phase. The implementation extends the existing SVG graphical editor runtime rather than creating a parallel editor.

## Existing Integration Points

- Viewer/editor entry: `ModuleMap.csv` maps SVG files to `ViewSVG.mjs` and `SVGeditor.mjs`; `SVGeditor.mjs` delegates to `SVGeditorComponents/SVGeditorImpl.mjs` and `SVGeditorRuntime.mjs`.
- Editing surface: `SVGeditorRuntime.mjs` owns `#editor-root`, the scrollable SVG viewport, `svgRoot` (`#svg-editor`), ruler canvases, the overlay layer tagged with `data-nv-editor-ui`, selection handles, pointer/keyboard handlers, and save hooks.
- Serialization: `window.getEditorHTML()` clones `svgRoot` and removes editor UI overlays and transient selection attributes before `window.saveWYSIWYGFile()` posts to `/api/save`.
- Tooling: existing SVG toolbar callbacks set `window.NodevisionState.svgDrawTool` and call `window.SVGEditorContext.setMode()`. The new tools follow that pattern.
- History: `SvgUndoStack.mjs` is still the central undo/redo stack. This phase adds element create/remove and custom snapshot operations so structural commands can undo as one operation.
- Layers: `ElementLayers.mjs` and `ElementLayers/panel.mjs` remain the SVG Layers panel provider. This phase enhances that panel in place.

## Architecture

The drawing-assist work is split into focused modules:

- `DrawingAssistSettings.mjs`: default settings, sanitization, SVG metadata read/write.
- `PointerInput.mjs`: Pointer Events normalization for mouse, touch, and pen.
- `StrokeStabilizer.mjs`: stroke sampling, smoothing, corner preservation, simplification.
- `ShapeRecognition.mjs`: draw-and-hold recognition and SVG primitive conversion.
- `ShapeCorrectionPreview.mjs`: editor-only preview and contextual subtoolbar.
- `VectorBrushPresets.mjs`: data-driven brush preset schema and built-in presets.
- `VectorBrushRenderer.mjs`: centerline and outlined SVG vector brush rendering.
- `QuickMenuWidget.mjs`: compact configurable popover menu.
- `EyedropperTool.mjs`: SVG paint sampling and transient indicator.
- `DrawingGuides.mjs`: editor-only guide overlays, snapping, and guide insertion.
- `SymmetryGenerator.mjs`: linked `<use>` clones and expanded symmetry copies.
- `SvgMaskClipCommands.mjs`: native `<mask>` and `<clipPath>` command helpers.

`SVGeditorRuntime.mjs` coordinates these modules but does not contain all geometry logic.

## Brush Preset Schema

Brush presets are JSON-compatible objects normalized by `VectorBrushPresets.mjs`:

```json
{
  "id": "pencil",
  "name": "Pencil",
  "representation": "outline",
  "size": 5,
  "opacity": 0.72,
  "minWidthRatio": 0.24,
  "maxWidthRatio": 1.1,
  "dynamics": {
    "pressureToWidth": 0.65,
    "speedToWidth": 0.28,
    "pressureToOpacity": 0.38,
    "tiltToAngle": 0.2,
    "twistToRotation": 0
  },
  "tip": { "angle": 0, "aspect": 1 },
  "taper": { "start": 0, "end": 0 },
  "stroke": { "linecap": "round", "linejoin": "round" }
}
```

Built-in presets are Monoline, Technical Pen, Pencil, Tapered Ink, Calligraphy, and Marker. Extra presets can later be loaded into `window.NodevisionVectorBrushPresets`, then moved to Notebook-hosted JSON files and linked through Nodevision edges.

## Shape Recognition Strategy

Draw-and-hold starts from stabilized pointer samples. Recognition is run after the hold delay, not on every pointer movement. The recognizer evaluates candidates for line, rectangle, triangle, ellipse/circle, polygon, polyline, arc, and smooth open curve, then commits only when confidence exceeds the configured threshold.

The recognizer reuses the existing pencil sketch triangle and quadrilateral fitters as advisory confidence boosts, while keeping the draw-and-hold logic single-stroke friendly.

SVG primitives are preferred where faithful:

- `line` for straight strokes.
- `rect` for axis-aligned rectangles and rounded rectangles.
- `circle` and `ellipse` for closed oval strokes.
- `polygon` and `polyline` for supported point shapes.
- `path` for arcs, smooth curves, rotated rectangles, and explicit Convert to Path.

The original live stroke remains in the overlay during preview. Escape restores the original preview, Enter commits the correction, and release commits the active preview.

## Stabilization Strategy

`StrokeStabilizer.mjs` separates raw samples from stabilized output. Modes are None, Light, Medium, Strong, Technical, and Delayed Rope. The pipeline is:

1. Filter finite samples and minimum point distance.
2. Optionally apply delayed-rope cursor smoothing.
3. Detect intentional corners.
4. Smooth non-corner samples.
5. Run Ramer-Douglas-Peucker simplification while preserving endpoints and corner indices.

The algorithm uses SVG user coordinates only; zoom is not an input to stabilization. Pointer-to-SVG conversion remains in the runtime via `toSvgPoint()`.

## Variable-Width Stroke Representation

This phase uses two SVG-native representations:

- Centerline strokes for monoline/technical pens: editable `<path>` with stroke attributes.
- Outlined variable-width strokes for pressure brushes: filled `<path>` geometry generated from centerline normals.

Brush paths include Nodevision metadata attributes:

- `data-nv-vector-brush`
- `data-nv-brush-schema-version`
- `data-nv-brush-preset`
- `data-nv-brush-centerline`
- `data-nv-brush-samples`

This keeps the saved result valid SVG while preserving enough metadata for future brush editing.

## Guide Metadata Representation

Guide settings are stored in a root-level SVG `<metadata id="nv-drawing-assist-metadata">` JSON payload. Visible guide overlays are editor UI nodes tagged with `data-nv-editor-ui` and are removed during serialization. Guides become visible SVG artwork only when the user invokes Insert Guides into SVG.

Settings are sanitized on read/write to reject malformed numeric values, invalid modes, and unsafe preset identifiers.

## Symmetry Representation

Symmetry output supports horizontal, vertical, quadrant, and radial modes. The default output strategy is linked SVG clones using `<use href="#source-id">`. Source IDs are generated only when needed and are collision checked. Alternate strategies create independent transformed copies.

Completed symmetry output stays in the SVG. Disabling symmetry only affects future strokes. Existing linked clones can be expanded into independent geometry through the Drawing Assist panel.

## Masks And Clipping Paths

Mask and clipping commands use native SVG:

- `<defs>` is created or reused.
- `<mask>` and `<clipPath>` receive stable unique IDs.
- Artwork receives `mask="url(#id)"` or `clip-path="url(#id)"`.
- Selected objects can be cloned into mask or clipPath definitions.
- Disable/enable stores and restores the original reference.
- Detach removes the reference without deleting the definition.
- Release Clip clones clip content back into artwork before removing the clip reference.
- Edit Mask and Edit Clip select the definition contents in `<defs>` and show an editor-only dashed banner with an Edit Artwork escape hatch.
- Escape or Edit Artwork returns selection to the masked/clipped artwork when the original object is still connected.
- Invert Mask toggles simple black/white mask paint where SVG-native inversion is practical without rasterizing.

The commands are non-destructive foundations. Selecting mask or clip-path contents lets existing transform controls edit those definition objects independently; transform-with-artwork remains a future refinement.

## History Integration

A brush stroke commits as one undoable element-create action, including symmetry outputs. Structural UI actions use `recordSvgSnapshot(label, operation)` on `window.SVGEditorContext` so layer reorder, lock, solo, masks, clipping paths, guide insertion, grouping, ungrouping, duplicate, paste, and arrange actions produce one undo step.

## Known Limitations

- Browser-level pointer tests were not added because this checkout does not expose a browser test harness and this environment has no JavaScript runtime available on PATH.
- Eraser modes beyond Delete Object are scaffolded in settings/UI and now leave unsupported SVG untouched with a status message. Path splitting/subtraction needs a dedicated boolean geometry pass.
- Mask inversion is limited to simple black/white mask content in this phase; arbitrary luminance masks need a fuller compositing strategy.
- Layer thumbnails are not generated yet; the Layers panel focuses on structure, locking, visibility, solo, selection, and reorder.
- Variable-width outlined brush geometry is editable as SVG paths but not yet round-tripped into a high-level brush editor.
- Visible rendered-color sampling is limited to direct SVG paint attributes and inherited paint, not a full rasterized canvas sample.

## Future Extension Points

- Notebook-hosted brush preset files.
- SVG brush-tip assets.
- Color palettes.
- ColorDrop-style enclosed-region filling.
- Vector liquify.
- Reference-image panel.
- Time-lapse operation replay.
- SVG Animation Assist and timeline integration.
- Dedicated browser interaction tests for pen pressure, pointer capture, QuickMenu, and shape correction.

## Manual Test Plan

1. Draw a rough line with Freehand, hold at the end until Shape Correction appears, release to commit a native line.
2. Draw a rough circle, hold, toggle Perfect Circle in the correction subtoolbar, then commit.
3. Draw any rough stroke, wait for correction, press Escape or Restore Original, then release and confirm the freehand stroke remains.
4. Draw with a mouse using Pencil or Marker and confirm fallback pressure produces visible geometry.
5. Draw with a pressure-sensitive pen and confirm width/opacity change for Pencil, Tapered Ink, Calligraphy, and Marker.
6. Switch stabilization modes in Vector Draw > Drawing Assist Controls and compare node count/responsiveness.
7. Use Eyedropper tool to sample fill and stroke colors; also press-hold on an object in Select mode to sample.
8. Open QuickMenu with the configured key and long press empty canvas; verify actions switch tools or call existing commands.
9. In Layers, create groups, expand/collapse rows, multi-select rows, rename, lock, hide, solo, duplicate, group/ungroup, and drag reorder.
10. Select artwork, use Drawing Assist > Add Mask, Edit Mask, transform the mask rect, press Escape or Edit Artwork, then disable/enable/detach the mask and undo/redo each step.
11. Select source plus artwork, use Use Selected As Clip, Edit Clip, then Release Clip and verify both source-derived clip geometry and artwork remain.
12. Enable horizontal symmetry, draw a stroke, save and reload, and verify linked `<use>` references survive.
13. Enable radial symmetry, change segment count and mirrored radial, draw a stroke, then Expand Symmetry.
14. Show one-point and two-point perspective guides; toggle snapping independently from visibility.
15. Undo and redo brush strokes, correction commits, layers actions, masks, clips, guide insertion, and symmetry expansion.
16. Save, close, and reopen the SVG in Nodevision; confirm no overlay, cursor, guide preview, QuickMenu, or correction preview was serialized.
17. Open the saved SVG in a normal browser and confirm it remains valid SVG with masks, clip paths, and linked clones intact.
