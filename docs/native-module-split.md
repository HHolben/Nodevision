# Native module split follow-up

The 12 oversized files identified in the dirty-tree audit have been split into feature modules. All 196 files in the fixed [scope manifest](native-module-split-files.txt) pass the path-header, second-line description, and fewer-than-200 code-line checks. The largest module contains 173 nonblank, noncomment lines. This result covers the agreed split and its helpers; it does not certify concurrent MetaWorld/GameView changes or the entire repository.

| Original file | Before code lines | Current entry file code lines |
| --- | ---: | ---: |
| `HtmlInlineEquation.mjs` | 336 | 25 |
| `htmlLayersContext.mjs` | 346 | 3 |
| `GraphicalEditor.mjs` | 540 | 15 |
| `HTMLeditorImpl.mjs` | 5365 | 1 |
| `HtmlImageText.mjs` | 213 | 20 |
| `SVGeditorRuntime.mjs` | 6211 | 1 |
| `FileView.mjs` | 2172 | 28 |
| `FileViewIframeActivation.test.mjs` | 288 | 172 |
| `LayoutStyles.css` | 577 | 4 |
| `cartoonTools.mjs` | 478 | 10 |
| `tableTools.mjs` | 707 | 17 |
| `panelFactory.mjs` | 573 | 1 |

## Structure

The existing JavaScript entry paths retain their public exports. Sibling `Parts` directories hold feature implementations with explicit imports. HTML and SVG editor initialization, tool handlers, context publication, and teardown are separated into named modules. Per-editor state stays in per-invocation objects; accessor dependencies preserve later updates captured by event handlers. Module-level shared state remains module-level. The FileView test fixtures are separate from assertions. LayoutStyles uses four ordered CSS imports to preserve cascade order.

The two missing test headers and three incomplete descriptions identified in the original audit were also corrected. Source-based regression tests now inspect the entry module and its extracted implementations through a test-only source reader. Browser regressions import the real module graph.

## Validation

- Standards: `node scripts/check-native-module-standards.mjs --files docs/native-module-split-files.txt --inventory` — 196 pass; maximum 173 code lines. The checker uses parser comment ranges for JavaScript and preserves UTF-16 offsets when excluding comments.
- Syntax: `node --check` passed for all 191 JavaScript files in the manifest. All relative imports resolve, and the ten JavaScript entry modules retain every named public export present in HEAD.
- Node regression sweep: 35 of 38 test files pass. The three failures are `PencilSketchAngleFit.test.mjs`, `PencilSketchTriangleFit.test.mjs`, and `ShapeRecognition.test.mjs`. All eight files in their recursive local import graphs are byte-for-byte identical to HEAD; these failures are outside the module split.
- Electron HTML foundation: passed native input, retained-tab behavior, serialization, and lifecycle checks.
- Electron HTML journal: passed mixed chronological history experiments.
- Electron HTML properties: passed source ownership, preview, undo containment, real panel integration, and provider cleanup.
- Electron SVG smoke: passed load, edit, undo, redo, tool switching, and disposal against the real runtime modules.
- Performance baseline adapter: all five overrides parse after adapting the harness to the extracted feature boundaries. Historical before/after reports are retained.
- Performance smoke: all eight shortened cases completed. The initial 560 ms sampling windows failed one frame-count invariant in the 20,000-word fragmented heavy case: properties redo recorded two preview mounts, while adjacent samples recorded zero. The [raw run](html-history-performance-modular-smoke.json) retains this failure. Repeating that case alone with a 1,500 ms settling interval [passed all 12 replay invariants](html-history-performance-modular-heavy-smoke.json), including single publication, at most one preview mount, Layers collection, and focus. This supports deferred work crossing the original sampling boundaries; it is not a replacement for the historical full performance comparison.
- `git diff --check`: passed.

The focused Electron commands use `env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox` followed by `scripts/html-foundation.electron.cjs` (with no option, `--journal`, or `--properties`) or `scripts/svg-modular.electron.cjs`.

The broad Node command uses `node --experimental-loader ./scripts/html-test-loader.mjs --test` with the HTML and SVG component test files, FileView tests, Layers and HtmlProperties tests, GraphicalEditorLiveMutation, panelTabContextRegression, and ElectronHtmlHistory.

The isolated performance command adds `NV_HTML_PERF_QUICK=1 NV_HTML_PERF_CASE=20000:fragmented:heavy NV_HTML_PERF_SETTLE_MS=1500 NV_HTML_PERF_LABEL=modular-heavy-smoke` to the Electron foundation runner with `--performance`. Case selection and settling overrides are optional; existing defaults remain unchanged.
