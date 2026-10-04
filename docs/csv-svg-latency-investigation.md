# CSV and SVG latency investigation

Investigated against `729280e` on 2026-09-28. Changes target CSV first, then SVG. The measurements below are isolated Node benchmarks, **not browser input-to-paint measurements**. Raw results, including all repetitions and maxima, are in [csv-svg-latency-measurements.json](csv-svg-latency-measurements.json).

## CSV findings and changes

The active CSV input handler previously serialized the entire grid before each input and again when recording history. Updating one cell cloned all rows and values. Every input also called `updateToolbarState`, even after the file was already dirty. Selection could paint twice; operations that rendered and then published could paint three times. Dimension calculation copied cell values twice just to discover row lengths.

The editor now retains immutable model states in `CSVHistory.mjs`, keeping the existing 25-entry undo limit. A cell edit copies the outer row array and the changed row, sharing unchanged rows with history. It does not stringify the document. Public imports still copy caller-owned data. No-op input is ignored, but an explicitly entered empty value in a virtual cell still materializes that field and remains undoable. Undo and redo retain selection coordinates.

Dirty toolbar updates happen on the transition to dirty, including the first edit after saving. Selection paints once. Cells are marked declared only when first materialized. Overlay geometry reads precede visibility/style writes, and a one-cell selection reuses its single bounds read. Dimension planning reads row lengths without copying cell contents or spreading large row arrays into function arguments.

Three runs per size, 100 measured inputs after 10 warmups, 30 columns, Node v24.19.0 on Linux. Values are the median of the three run p95 values, in milliseconds:

| Rows | Model/history before | Model/history after |
| ---: | ---: | ---: |
| 100 | 0.632 | 0.004 |
| 1,000 | 7.662 | 0.011 |
| 5,000 | 22.899 | 0.036 |

These measurements exclude rendering, toolbar execution, live previews, native input, and layout. The larger after-run maximum was 10.107 ms; small medians do not rule out allocation/GC outliers. Cell editing still copies the outer row array, so it is O(rows + edited-row width), not constant time. Bulk edits still clone/compare the grid and rebuild its table; the table is not virtualized. Those remain follow-up measurement targets.

## SVG findings and changes

The runtime already separates geometry updates during drags from full selection updates. However, `refreshSelectionStateVisuals` still enumerated every selectable element, tested array membership, and called `removeAttribute('data-selected')` on every unrelated object. Selection de-duplication and additive selection also used repeated linear membership checks.

`SvgSelectionMarkers.mjs` now owns marker reconciliation. Initial load and explicit source replacement reconcile imported legacy markers once. Later updates inspect only previous and current selection members, write attributes only when necessary, and retain authored filters. Selection construction uses Sets while retaining order and explicit primary selection. Disposal clears retained markers and prevents further work. The existing geometry calculations and drawing behavior are unchanged.

For 100 successive single-object selection changes in a 5,000-object instrumented fixture, full enumerations dropped from **100 to 0** after initial reconciliation, and attribute-write calls dropped from **500,000 to 200**. These are method-call counts, not measured browser MutationObserver records.

| Objects | Marker reconciliation p95 before | After |
| ---: | ---: | ---: |
| 100 | 0.015 ms | 0.006 ms |
| 1,000 | 0.054 ms | 0.005 ms |
| 5,000 | 0.319 ms | 0.004 ms |

The fixture uses instrumented JavaScript objects. It establishes reduced work, not actual SVG rendering latency. Marquee hit testing still enumerates objects and computes bounds; Layers can still rebuild its rows; attention, toolbar, Properties, and live-preview costs remain separate. Large multi-selection still requires work proportional to the selection size.

## Verification and reproduction

Nine targeted Node test files passed: CSV model, range operations, immutable history, controller work bounds, SVG marker transitions, selection/geometry separation, layer-preservation guards, resize geometry, and scale geometry. The controller test executes the real CSV controller with presentation services stubbed; it verifies typing does not render the grid, toolbar dirty updates are bounded, selection paints once, and undo/save/virtual-field behavior remains correct. It does not substitute for native browser input testing.

One existing CSV source assertion expected a hard-coded outline even though the committed implementation already used a customizable CSS variable. The assertion now checks that variable and its existing default.

```sh
node scripts/csv-latency-benchmark.mjs --baseline=729280e
node scripts/csv-latency-benchmark.mjs
node scripts/svg-selection-latency-benchmark.mjs --baseline
node scripts/svg-selection-latency-benchmark.mjs
node --experimental-loader ./scripts/csv-editor-test-loader.mjs --test \
  ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVEditorLatency.test.mjs
```

The SVG benchmark's baseline reproduces the previous marker loop; it does not run the old complete editor. Both benchmark scripts report individual repetitions instead of hiding variability in one aggregate.

Automatic approval review rejected the preceding local Chromium test-server launch because of an account usage limit. No browser or Electron run was performed for this change, and the rejection was not bypassed. Follow-up validation should run existing CSV range/cursor browser scenarios and the SVG selection geometry Electron benchmark, then measure native input with Layers and neighboring FileView panels present. Compare initial load, typing, range selection, movement, marquee selection, undo, and repeated editor switches.

New and changed small application modules meet the fewer-than-200 code-line rule. The touched pre-existing `SVGeditorRuntime.mjs` remains oversized (6,211 code lines versus 6,229 before); the standards audit reports this inherited violation. The marker logic was extracted into a small module, without attempting a wholesale runtime rewrite.
