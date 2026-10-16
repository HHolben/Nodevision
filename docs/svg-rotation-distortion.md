# SVG rotation distortion investigation

## Root cause (recorded before implementation changes)

The real Chromium editor fixture `scripts/svg-rotation-browser.mjs` reproduced the defect at 15, 30, 45 and 90 degrees using a 100×50 rect rendered with `scale(2 1)`, both on the object and on a containing group.

`HandleSvgPointerSelectionStart` routes Shift-drag to `createStartRotateInteractionHandler`. `HandleSvgPointerDrawingMove` then appends `rotate(rootAngle rootCx rootCy)` after the existing object transform. The angle and pivot come from root coordinates (`toSvgPoint` uses inverse root screen CTM), but appended SVG operations act in object-local coordinates. Thus scale × rotation changes rendered side lengths and angles and can move the center. At 45 degrees a rendered 200×50 rectangle became approximately 158.1139×79.0569, with adjacent-edge dot product -7500 instead of zero. At 90 degrees it became 100×100.

The Rotate tool and keyboard preview use `applyRotationAngleToCommand`, which prepends rotation to the base transform. This works for scaling on the object itself, but only converts the pivot into parent coordinates. A root-space rotation is not the same rotation in a nonuniformly scaled parent coordinate system. The group fixture reproduced the same failures.

These are actual SVG transform errors, present during pointer movement and retained after release/serialization. Rect x/y/width/height are not rewritten or converted to paths. Affine transforms preserve parallelism, so the reproduced distorted quadrilateral is a parallelogram, not a literal trapezoid. Selection chrome displays root-space axis-aligned bounds and is not the source. Plain unscaled rectangles do not exhibit this defect.

## Intended correction

Use the existing rotation command snapshot and parent-space transform architecture for both gestures. For parent-to-root matrix P and root-space rotation R about the selected pivot, prepend P^-1 R P to the original transform B. The resulting root mapping is P P^-1 R P B = R P B. Every preview derives from the gesture-start snapshot, preserving geometry without cumulative preview error. Keep pointer release/commit and history semantics intact.

## Implementation and changed functions

All runtime files below are in `ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/`:

- `InstallSvgSelectionOrdering.mjs`: `buildRotationCommandItems` snapshots parent-to-root matrices and their inverses; `applyRotationAngleToCommand` applies the conjugated matrix to the original transform. Noninvertible ancestors reject rotation before any element changes.
- `CreateStartResizeInteractionHandler.mjs`: `createStartRotateInteractionHandler` routes Shift-drag through the existing rotation command, with a commit-on-release flag. Resize logic is unchanged.
- `HandleSvgPointerDrawingMove.mjs`: `handleSvgPointerDrawingMove` uses the shared command for all rotation previews, removing the erroneous local rotation and separate line-coordinate rewriting.
- `CreateAddEventListenerPointerupHandler.mjs`: commits Shift rotation via existing history on release; Rotate-tool release still leaves an explicit preview.
- `CreateAddEventListenerPointercancelHandler.mjs`: restores the Shift gesture snapshot on cancellation.

Test changes:

- `scripts/svg-rotation-browser.mjs`: production editor fixture checking root-space vertices, lengths, perpendicularity, parallelism, pivot, intermediate previews, release, overlay bounds, four quarter turns, inverse rotations, custom pivot, nested groups, existing object transforms, cross-layer multi-selection, ellipse/path/line rotation, cancel, undo/redo, and production SVG serialization/reload.
- `scripts/test-svg-layers-browser.py`: `--svg-rotation` selects the fixture using the existing real-clock Chromium runner.
- `SvgSelectionRefreshSplit.test.mjs`: checks geometry-only refresh in the shared rotation command rather than the deleted duplicate pointer branch.

The existing SVG layers/chrome browser suite passes, including resize-handle interaction, delegated dragging, layer movement, clipboard, history, serialization and cleanup. Five targeted Node suites pass: resize geometry, scale geometry, selection refresh split, layer preservation, and save recovery. `git diff --check` passes.

`SvgLineToolFeedback.test.mjs` fails at its existing assertion “finishing the Line tool removes transient vertex markers.” The same test fails identically against pristine HEAD files copied into `/tmp/nodevision-rotation-baseline`; it is unrelated and remains unchanged.

## Limits

Validation uses Chromium with real SVG layout and DOM pointer/keyboard events, plus application-shell stubs; it does not automate an OS mouse or a filesystem save dialog. Save/reopen exercises the actual editor serializer and document loader. The current editor exposes rotation through Shift-drag and the Rotate tool's object drag, not a separate rotation handle.

A singular parent transform (e.g. `scale(0 1)`) cannot be inverted and is left unchanged. Geometry that was already sheared by authored transforms retains its existing shape; rotation does not repair pre-existing distortion. The invariant is rigid rotation in SVG root user space. CSS 3D perspective and animated ancestor transforms changing during a gesture are outside this fix.

## Final regression result

`python3 scripts/test-svg-layers-browser.py --svg-rotation` passes **11,906 assertions**, including nested transforms, 40 successive pointer previews, and 20 exact keyboard rotations alternating +30/-30. Coordinate comparisons allow 0.003 SVG units for browser CTM and pointer-event floating-point conversion. Exact keyboard rotations isolate accumulation from pointer-coordinate quantization.

`python3 scripts/test-svg-layers-browser.py` passes the existing layers/chrome suite. The five targeted Node suites listed above pass (5/5). The unrelated baseline Line feedback failure is recorded above.
