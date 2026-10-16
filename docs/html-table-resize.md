# HTML table divider resize

## Reproduction and root cause

Before changing the implementation, the Chromium fixture dispatched a divider
pointerdown followed by displacements of 0.5, 10, 50, and 150 pixels. It failed
with three `ReferenceError: moved is not defined` exceptions. The move callback
in `CreateCanvasItemMoveHandler.mjs` had been separated from
`StartTableDividerResize.mjs`, but still assigned to the latter's local `moved`.
Once displacement exceeded one pixel, the assignment threw before sizing ran.
The finish callback's own `moved` also never changed, preventing its dirty event.

The original implementation already used window-level move/up/cancel listeners;
it did not capture the pointer. The reproduced stall was an exception, not lost
capture, a DOM replacement, or a mutation-observer refresh. The original origin
was stable, but it used the divider edge rather than the actual pointerdown
coordinate, introducing a hit-zone offset. Internal boundaries also redistributed
a fixed total between adjacent tracks, capping expansion when the neighboring
track hit a hardcoded minimum. Column initialization forced fixed table layout;
cellIndex-based addressing did not account for merged cells. Row sizing could
be redistributed by the browser's table height constraints.

## Implementation

- `CreateCanvasItemMoveHandler.mjs`: calculate total pointer displacement through
  explicit owner state; remove the out-of-scope assignment and adjacent-track cap.
- `StartTableDividerResize.mjs`: one existing editor transaction per gesture,
  pointer-ID filtering, capture on the stable editor root with window listeners,
  stable active cursor, and cleanup/cancel on Escape, pointercancel, capture loss,
  blur, and teardown. A click alone does not rewrite sizing. No input/history
  publication or active DOM rebuilding occurs during previews.
- `TableResizeGeometry.mjs` (new): snapshot existing track/cell dimensions before
  resizing, resolve a logical grid including colspan/rowspan (and rowspan=0),
  retain the existing table-layout mode and box sizing, and change the selected
  track plus total table size. Spanning cells receive the selected track's delta.
  Other tracks retain their starting dimensions. Existing col definitions also
  participate. A synchronous layout probe obtains the content-constrained minimum;
  explicit pixel CSS minima are respected, including cell min-height that browser
  table layout otherwise ignores. No arbitrary maximum or global CSS constraint
  removal is used.
- `MeasureTableRowHeight.mjs`: logical merged-cell hit indices and fractional
  computed layout dimensions for client-to-layout conversion. Integer offset
  dimensions caused accumulated drift during long drags at device scale 2.

Authored changes use ordinary inline dimensions and the existing transaction,
serialization, and save infrastructure. Cancellation restores the pre-drag source.
Existing unrelated SVG working-tree changes were not edited.

## Validation

Run `python3 scripts/test-html-table-resize-browser.py` (requires local Chromium
and permission to listen on loopback). The new files are this runner,
`html-table-resize-browser.mjs` and `html-table-resize-native.mjs` in `scripts/`.
The fixture mounts the real HTML editor; the native runner uses Chromium's input
protocol, with a device scale factor of 2. All cases pass:

- Continued small moves followed by 700-pixel expansion on both axes; reversal,
  return to origin, rapid/slow moves and movement beyond original bounds.
- 50%, 100%, and 175% geometric zoom; trusted mouse capture/movement/release on
  both axes at each zoom level.
- Empty, wrapping-text, and image cells; shrinking to content/padding minima,
  continued motion past the minimum, recovery, and adjacent-track isolation.
- Explicit CSS minimum widths/heights, auto/fixed table layout, separate borders,
  table borders, existing colgroups, both sides of column dividers, colspan and
  rowspan; contents and merged attributes remain intact.
- No table-node replacement during previews; one history entry per drag; exact
  authored-source restoration by undo, redo, and cancellation.
- Escape and pointercancel followed by another successful drag; click-only no-op.
- Save payload equals final serialized dimensions; disposing/reopening the editor
  and loading that payload preserves source. The save endpoint is intercepted by
  the test, so this verifies editor persistence rather than server disk I/O.

Also passed:

- `python3 scripts/test-svg-layers-browser.py --html-source`: existing HTML source
  preservation, active save, selection, transactions, and retained-editor checks.
- `node --test ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.test.mjs`: both test files pass.
- `git diff --check`.
