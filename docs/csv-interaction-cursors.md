# CSV interaction cursors

`CSVRangeInteraction.mjs` owns the existing pointer gesture (`drag`) and contenteditable cell (`editing`). `CSVeditor.mjs` owns anchor/active coordinates and derives the rectangular range. A move uses a preview until pointer-up, then records one history operation. ModuleMap already identifies `CSVCursorProvider.mjs`; the contextual cursor registry resolves toolbar tools, while the new live cursor controller reads the existing gesture state directly.

`CSVInteractionCursor.mjs` is the single owner of the effective CSS cursor. The CSV provider supplies its vocabulary and deterministic precedence: active move, active range selection, actual text editing, movable hover, ordinary cell, then default. The move predicate is shared with pointer-down, so the cursor does not advertise an unavailable operation.

| Interaction | Cursor |
| --- | --- |
| Ordinary selectable cell, including a selected single-cell center | `cell` |
| Active selection or range extension | `crosshair` |
| Selected multi-cell range, or a selected single cell within 6 pixels of its edge | `grab` |
| Pointer-down beginning a move through its completion/cancellation | `grabbing` |
| Contenteditable cell entered through double-click, F2, or typing | `text` |
| Outside the grid with no gesture | `default` |

The existing click contract remains unchanged: a single click selects; clicking a movable selection without moving collapses it to that cell; editing requires double-click, F2, or typing. Shift forces selection extension rather than moving. The CSV grid has no row/column resize handles. Existing workspace resize handles keep their own cursors, and no synthetic resize state is added.

Every rendered or virtual cell can be a destination. The original move operation clamps negative offsets and retains its last valid destination when the pointer leaves the grid. Releasing outside therefore still accepts that destination. `not-allowed` would be misleading here and is deliberately absent.

The wrapper owns its idle cursor through one custom property. During a gesture, a temporary document rule keeps the operation cursor visible outside the original cell or under pointer capture. Pointer-up, pointercancel, lost capture, Escape, window blur, document hiding, panel/tab deactivation, and editor disposal release that rule. Cell descendants inherit the same cursor instead of competing with per-cell handlers.

The controller caches the hovered cell rectangle only when the single-cell edge rule needs it. Scroll, resize, and rerender invalidate geometry; selection changes refresh cursor state explicitly. Stable hover causes no new layout reads, grid scans, toolbar updates, or style writes. Gesture pointer movement uses the existing hit test and constant-size selection preview; it adds no grid-wide lookup or per-cell listeners.

Validation uses `python3 scripts/test-csv-browser.py`, extending the existing CSV harness rather than creating a second runner. It covers editing, selection, moving, all cursor transitions, outside release, child elements, cancellation, resize-handle isolation, and teardown. On a 36,000-cell grid, 200 selection previews and 200 move previews produce zero grid scans, table rebuilds, toolbar/attention publications, or document/history mutations until commit. A further 200 stable hover events produce zero layout reads or cursor style writes. The harness dispatches DOM pointer events; it does not claim native OS pointer-capture certification or a hardware timing benchmark.
