# CSV range editing

The CSV/TSV Module Map entries still load `CSVeditor.mjs`. Its local helpers are implementation modules, so they do not need separate file-family registrations.

Reconnaissance of the September 25 CSV/table changes found:

- `CSVGridModel.mjs` preserves ragged arrays. A field exists only when its index is inside its row. The renderer adds virtual cells beyond the declared dimensions; selecting these cells must not call materialization helpers.
- The previous CSV editor reused HTML table selection arrays and classes. Dragging could scan the whole table through hit testing and range helpers. It had TSV copy but no block paste, cut, or move.
- The shared `tableTools.mjs` already routes row/column operations and arrow navigation through `__nvActiveGridTableContext`. That adapter remains the bridge for CSV commands.
- `NodevisionSelection.mjs` owns canonical notebook/file references, not grid coordinates. CSV range state belongs to the editor instance, exposed through the existing grid context. It does not replace the selected file or add a singleton.
- `EditorAttentionState.mjs` provides the existing attention store. CSV publishes range context after activation or completed gestures, with deduplication, never during pointer movement.
- Programmatic history was DOM-based and CSV had no model-aware batch history. The existing `createWysiwygProgrammaticHistory` now accepts optional snapshot readers/writers; its default HTML behavior is unchanged. CSV snapshots include rows, anchor, and active coordinates, with the same bounded history stack.

## Interaction

Click selects a cell. Drag from an unselected cell or the center of a single selected cell to select a rectangle. Shift-click and Shift-arrow extend from the anchor. Drag inside a multi-cell selection to move it; a single cell can be moved from its six-pixel edge. A green dashed overlay previews the destination. Escape, pointer cancellation, and loss of window focus cancel a move.

Double-click or F2 edits a cell. Typing replaces a selected cell. While editing, native text selection and clipboard operations remain available. Outside text editing, native copy/cut/paste events handle Ctrl/Cmd shortcuts as rectangular TSV operations. Enter, Tab, and arrows retain grid navigation; horizontal arrows within text remain caret navigation until reaching the cell edge. Toolbar focus preserves the range; row/column commands collapse it to the resulting active cell.

The selection is an anchor and active coordinate pair with derived rectangular bounds. Two overlays provide selection and destination feedback using direct row/cell lookup and a constant number of geometry reads. Pointer previews neither build cell collections nor mutate rows. Rendering the table occurs on committed model operations and navigation beyond rendered space, not on pointer movement. This is not a virtualized renderer; very large initial loads and completed edits still render the full grid.

## Data and history

Copy uses TSV quoting for embedded tabs, quotes, and line breaks. Paste begins at the active cell. Explicit empty clipboard fields, including trailing tabs, remain declared; ragged clipboard rows are padded into a rectangle. A final line terminator does not add a phantom row. A final blank CSV record requires an extra terminator when saving, ensuring it survives reload.

Cut clears only declared fields. Move captures the source before clearing it, then writes once, so overlap is safe. Declared empty source fields remain declared at the destination. Virtual source fields clear existing destination fields but do not materialize new ones. Intermediate fields/rows are created only to reach declared destination fields.

Cut, paste, move, row/column commands, and typing use the existing dirty/save infrastructure and shared history helper. Each batch is a single undo entry; Ctrl/Cmd+Z, Ctrl+Y, and Ctrl/Cmd+Shift+Z restore the model and selection. Saving serializes model rows, never overlays or virtual cells.

## Verification

Run:

```sh
node ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridModel.test.mjs
node ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVRangeModel.test.mjs
python3 scripts/test-csv-browser.py
```

The browser runner requires Chromium on PATH, or an executable path as its first argument. It uses the real CSV modules, attention store, and table-command adapter with a minimal toolbar host. Its 36,000-cell structural benchmark performs 200 selection previews and 200 move previews, asserting zero table scans, rebuilds, toolbar/attention publications, or history writes during movement and one commit on drop. Geometry reads are bounded per event. Structural assertions avoid machine-speed-dependent timing thresholds. The suite also covers clipboard, all selection directions, editing, virtual cells, overlap, cancellation, save output, history, and row/column commands.
