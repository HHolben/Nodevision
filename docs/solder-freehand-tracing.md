# Solder joint freehand tracing

Freehand Trace is now the initial drawing mode. Both annotation layers also offer
Polygon / Vertex, Edit Perimeter, and the existing Bezier tool. Release closes a
trace geometrically. Edit Perimeter moves whole paths or individual anchors and
existing Bezier handles. Redraw selected replaces a boundary in one undoable step,
retaining its ID and layer; Escape preserves the original. Undo, redo, deletion,
save/reopen, and the four-section report use the existing session workflows.

## Components and files

- `ApplicationSystem/public/Sessions/SolderJointAreaSession.mjs`: toolbar modes,
  touch toggle, replacement history and measurements.
- `ApplicationSystem/public/SolderAnalysis/Editor.mjs`: default mode, frame-paced
  preview, redraw integration, image reuse and pointer ownership for edits/pan.
- `ApplicationSystem/public/VectorDrawing/FreehandCapture.mjs`: reusable lossless
  point accumulation and coalesced-event extraction.
- `ApplicationSystem/public/VectorDrawing/VectorInteraction.mjs`: opt-in precise
  freehand accumulation, preserving existing behavior for other clients.
- `ApplicationSystem/public/VectorDrawing/BindVectorInteraction.mjs`: shared
  pointer capture, coalesced samples, pointer ownership, cancellation and touch gate.
- `ApplicationSystem/public/VectorDrawing/FreehandCapture.test.mjs`: sampling,
  many-point accuracy, pointer identity, closure measurement and mean RGBA tests.
- `scripts/solder-analysis-browser.mjs`: expanded real-session browser regressions.

The SVG editor's existing freehand runtime and PointerInput helpers were inspected.
Their brush pressure, stabilization and shape recognition features are unsuitable
for silently changing a measured boundary. This implementation extends the shared
VectorDrawing binding already used by the session instead. Final geometry remains
the existing closed BezierModel with corner nodes, passed through modelToPathD,
shared SVG path contours and filled-region utilities. No document schema or report
format change is required.

## Sampling and measurement

The inverse SVG screen transform maps every sample to original image coordinates,
including under zoom and scroll. Coalesced samples are consumed in order, followed
by the dispatched endpoint, including on release. Duplicate samples and exactly
collinear forward interior points are removed adaptively; bends, tiny curves,
corners and reversals survive. There is no smoothing or approximate simplification.
Pressure does not change geometry or outline width. The final model is closed,
so a gap from the final sample to the initial sample becomes a straight segment.

The existing worker computes native pixel masks and mean RGBA after completion,
then updates percentages and validation. Outline width never enters the mask.
Void creation and replacement use existing containment-based parent assignment;
other edits retain existing parent relationships and validate containment.

## Performance and limitations

During capture, only samples and a temporary SVG preview change. Preview DOM work
is limited to one animation frame; image href is only updated when the image
changes. Masks are not calculated on movement. Curved traces can still contain
many points; displaying all their editing handles and final measurement may cost
time. No hardware latency benchmark was performed.

Only the owning pointer can finish or cancel its stroke. Additional pointers are
ignored during contact. Disable Touch drawing for pen-only use to prevent palm
marks before/after contact; hardware/browser palm classification still matters.
Touch drawing is enabled initially. Pan remains available through the Pan tool
or middle mouse button; Ctrl-wheel zoom is blocked during active strokes.

Local correction is available by moving perimeter points. Partial-boundary
re-tracing and creation of new curve handles on freehand nodes are not implemented;
whole-boundary redraw and the Bezier tool remain available. No smoothing or
configurable close-distance control is introduced.

## Verification

- `node --test ApplicationSystem/public/VectorDrawing/*.test.mjs ApplicationSystem/public/SolderAnalysis/*.test.mjs`: all four test files pass.
- `python3 scripts/test-solder-analysis-browser.py`: 49 browser checks pass.
- `git diff --check`: passes.

Coverage includes mouse/pen/touch controller strokes, coalesced fast movement,
release closure, foreign-pointer cancellation, pen tracing under zoom and scroll,
touch disabling, exact area/mean RGBA, 10,000 curve samples without area change,
undo/redo, redraw, point editing, serialization, and four-section report generation.
Browser pointer events are synthetic; physical stylus capture and palm rejection
should also be checked on the target touchscreen.

## Perimeter transform shortcuts

With a region selected, **G** starts moving and **S** starts scaling around the
boundary's bounding-box center. Move the pointer to preview, then click the image
or press Enter to commit; Escape restores the original. X/Y constrain either
operation. For scaling, type a factor (for example, `S 2 Enter`). For movement,
select X/Y then type a percentage of the image dimension (`G X 1 Enter` moves
one percent of image width). Backspace edits numeric input. Baked perimeter
coordinates have image-local axes, so RX/RY scaling uses the same axes as X/Y.

`SolderAnalysis/PerimeterTransform.mjs` reuses the SVG scale factor calculation
and numeric parser. Transform previews change anchors and Bezier handles together,
suspend measurement, and commit through the session's existing undo/redo path.
Shortcuts ignore text inputs, modified key combinations, active drawing gestures,
and hidden/locked regions. Browser regressions cover pointer and typed transforms,
zoom, measurement, cancellation, click confirmation, lock protection and history.

## Tablet toolbar

Select an area, then tap **Move** or **Scale** in the toolbar. Drag on the image
with touch, a pen, or a mouse and release to commit. For scaling, start away from
the area's center and drag outward or inward. **Cancel Transform** restores the
original without requiring Escape. Pointer cancellation also restores geometry.
Only the initiating pointer controls the gesture; pointer capture retains the
gesture outside the SVG. Explicit tablet transforms work independently of the
Touch drawing checkbox, which controls creating/editing strokes.

The toolbar **Delete** button and existing **Delete region** control share the
same undoable action and locked-layer protection. S/G keyboard behavior remains
available. Verification: 60 browser checks and all four targeted unit test files
pass, including touch movement/scaling, interrupted gestures, toolbar cancellation,
deletion and undo.

## Rotation

**R** starts rotation around the selected boundary's bounding-box center. Type
an angle in radians, or press **R**, then **D**, to enter degrees (for example,
`R D 90 Enter`). With an empty angle buffer, R returns to radians. Minus toggles
the typed angle's direction; plus selects positive rotation. Enter/click confirms,
Escape cancels, and Backspace edits numeric input.

The toolbar **Rotate** button starts free pen/touch/mouse rotation. Start a drag
away from the center, move around it, and release to commit. Anchors and Bezier
handles rotate together in image coordinates; measurements update after commit.
Cancel Transform, pointer cancellation, and undo/redo use the existing transform
workflow. This does not implement the SVG editor's separate rotation-origin tool.

Verification: 68 browser checks pass, including radians, degrees, negative angles,
undo/redo, Escape, free pen rotation with foreign touch input, and interrupted pen
gestures. All four targeted unit test files and `git diff --check` also pass.
