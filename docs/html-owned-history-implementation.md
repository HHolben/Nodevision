# Editor-owned HTML history

Implemented and verified on 2026-09-30, Electron 42.2.0 / Chromium 148.0.7778.97. This follows [the mixed-history investigation](html-mixed-history-investigation.md), whose original evidence remains unchanged. The Properties controls remain color and margin-left.

## Architecture and deviations from the proposal

The proposed owner was each mounted HTML context: browser editing continues, but a local reversible DOM journal owns chronological Undo/Redo. `beforeinput` establishes intent and the before-selection; `input` finishes mutation capture. Transactions join that timeline, selection/focus/command/input-type/composition boundaries split runs, new authored edits invalidate redo, and bookmarks restore the caret. CSS remains a separate, revision-checked shared source history. Chromium's stack is bypassed rather than treated as a second source of chronological truth.

The implementation follows that design, with these repository-driven adaptations:

- `HtmlDomHistory.mjs` replaces the HTML instance of the snapshot fallback. The existing snapshot module remains for model-backed consumers such as CSS. No application-wide history framework or shared HTML stack was introduced.
- `HtmlHistoryPatches.mjs` captures text before/after values, attribute before/after values, and child-list patches with retained nodes and parent/next-sibling anchors. Replay keeps node identity, validates preimages, and rolls back already-applied patches if a later validation fails.
- Resource changes retain the associated private provenance identity as replay metadata. Excluding every private attribute broke the existing portable-resource undo fixture; retaining paired identities fixes that failure without emitting them into saved source. Presentation-only substitutions, selection classes and chrome are filtered using provenance.
- `HtmlHistoryRouting.mjs` owns event and scripted command routing. Its document registry contains editor/dispatcher references, not a shared history timeline.
- `ElectronHtmlHistory.mjs` dispatches `webContents.undo/redo` to the renderer before native fallback. This is necessary because native Redo emits no `beforeinput` when Chromium has no redo entry, even if the journal does. Renderer routing failure does not permit native fallback.
- Existing caret bookmarks now cache paths and invalidate that cache on structural mutations/replay. Initial measurements exposed expensive sibling-array creation on every bookmark; this optimization removed that cost.

`HTMLeditorImpl.mjs` only selects the journal, connects lifecycle/activation, and uses it at the existing command boundary. History implementation remains in focused modules. New ApplicationSystem modules are below 200 nonblank/noncomment lines.

## Native capture, transactions, and grouping

Native input reads no whole-body HTML, clones no document, and performs no full-document scan. Mutation records are consumed at input boundaries. Repeated changes to one text node retain its first and last values, not every intermediate string. Structural inputs retain the affected nodes. Unclassified authored mutations outside native input/transactions invalidate replay instead of attaching themselves to a previous operation.

Contiguous `insertText`, backward-delete and forward-delete runs coalesce separately. Caret movement, changed selection, pointer selection, focus loss, editor activation, edit-type changes, paste/cut, explicit commands, graphical transactions, history operations and composition boundaries end a run. There is no arbitrary idle timeout. Selection changes caused by the input itself do not split the run; composition draft selection changes do not split a composition.

Transactions preserve begin/preview/nesting/commit/cancel, revision checks, failed nested rollback, and authored no-op suppression. Preview mutations compact while a transaction is open. A committed transaction produces one entry; twenty preview moves cancel without an entry. No-op and cancelled transactions preserve redo. Existing synchronous record-after-mutation bridges consume pending localized records; delayed/unclassified edits cannot safely use an old HTML string to overwrite current state.

The transaction contract still compares authored source once at begin/commit for no-op detection. Those temporary command-level reads are not retained history snapshots and never occur per native character. No full-document recovery checkpoint was added.

Browser editing commands through `document.execCommand` are bracketed when they target a participating HTML editor; formatting commands therefore enter the journal even when Chromium does not emit `beforeinput`. Input fields and other editor modes retain their own command behavior.

## Undo/Redo and Chromium containment

Supported routes are root-capture Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y, existing HTML toolbar/tools APIs, inline Properties Undo/Redo, scripted `document.execCommand('undo'/'redo')`, desktop `webContents.undo/redo`, and cancellable native `historyUndo/historyRedo` intents. Each dispatches one journal operation. Inline Properties history controls use chronological HTML history; external CSS controls retain source-specific history.

Chromium's internal stack is **not erased**. Cancellable native history intents are cancelled. A native history `input` that bypasses `beforeinput` has its actual DOM mutations reversed synchronously before journal replay. Direct Electron tests exercise the original native methods and `Document.prototype.execCommand.call(...)`, not just synthetic event cancellation.

The application currently removes its native application menu (`Menu.setApplicationMenu(null)`). Future native menu integrations must call the owned desktop dispatcher; a bare native role can emit no Redo event when Chromium's redo stack is empty. Raw native Redo may therefore do nothing, but the tested stale branch cannot overwrite the new branch. Arbitrary JavaScript DOM mutation is not an undo API and is not sandboxed by this mechanism. Chromium upgrades require rerunning the native bypass tests.

The post-Properties pause is now bypassed for owned journals only, after the chronological gates passed in Electron. The legacy fence remains available for nonparticipating history implementations. An open Properties preview still blocks ordinary input until settled; composition start cancels an open graphical preview before accepting the draft.

## Acceptance results

[Dedicated Electron results](html-journal-results.json) contain 49 assertions, state/selection/source records, storage estimates and performance samples. These include:

| Scenario | Result |
| --- | --- |
| Native AB → Undo → Redo | `xAB` → `x` → `xAB` |
| A → inline Properties red → C | Undo yields `xA` red, `xA` unstyled, `x`; Redo reconstructs all three in order |
| Undo C/B, type D, Redo | `xAD` remains; abandoned style/text branch does not return |
| Native-only branch after caret navigation | Redo does not resurrect the abandoned text |
| Two retained editors, keyboard/menu Undo | Only the intended editor changes |
| Close A, Undo in B, original native Undo | B owns its history; closed A's retained DOM is unchanged |
| Direct/scripted/native prototype command paths | Chronological replay or safe no-op; stale branch does not replace newer text |
| Insert/remove and table structure | Node-preserving undo/redo passes |
| Backspace run, native paste and cut | Chronological replay passes |
| Multi-node deletion, native bold command | Structure and selected text restore |
| No-op, cancelled preview, twenty preview moves | No spurious committed operation; redo survives cancellation/no-op |
| Unclassified authored mutation | Existing history becomes unavailable; later content is preserved |
| Entry/byte eviction | Remaining undo/redo order is correct; an oversized entry is evicted |

Caret offsets are asserted for typing, deletion, paste, Properties and composition undo/redo. Native cut and multi-node deletion assert restoration of the selected text, not just body text. Insert/table replay and the foundation transaction suite cover structural bookmarks and ownership. History entries contain paths and offsets rather than stale DOM Ranges.

Composition uses Chromium CDP `imeSetComposition`/`insertText`: the Japanese draft is replaced and committed as one operation; transaction-backed style changes during composition are refused. A preview open before composition is cancelled, the composition continues, and one Undo restores the pre-composition text. These tests exercise the browser composition pipeline, not an OS candidate window or all IMEs.

## External CSS

CSS deliberately remains outside HTML keyboard chronology. A stylesheet change belongs to its shared buffer, identified by source path/revision; Properties source Undo/Redo checks that identity and refuses stale or conflicting replay. HTML typing does not make a valid CSS operation stale.

The extended Properties Electron suite verifies two pages sharing a sheet: preview affects both, Undo restores the exact CSS source once (one revision increment), both computed previews return to purple, and Redo updates both. A dirty retained CodeEditor refuses Undo without overwriting source. A later commit from the other page makes the older operation stale. Existing exact declaration patch, dirty state, source save, disk conflict and live provider tests also pass. No unvalidated CSS snapshot is inserted into an HTML timeline.

## Capacity and performance

Each journal limits committed history plus the pending typing run to **100 operations and approximately 8 MiB**. The estimate includes UTF-16 strings, patch overhead, and retained structural nodes/attributes. Eviction removes oldest complete operations. An individual operation exceeding the byte budget becomes an undo barrier rather than exceeding the limit. Disposal releases the observer, routing registration, listeners, bookmarks and retained operation references.

Measured storage explains these limits: 1,000 native characters retain 2,132 estimated bytes; a 120,000-character paste plus the preceding run retains 246,264 bytes; 150 graphical style edits retain only 100 entries/20,198 bytes; adding a 3,000-cell table retains 100 entries/629,918 bytes. Thus the count limit bounds small operations and the byte limit catches large fragments/tables. Separate low-capacity tests force both kinds of eviction and replay the retained entries.

These are approximate journal-storage bounds, not a bound on the browser's internal undo stack, total DOM, provenance store, or JS heap. Forced-GC heap measurements include the live editor, browser and harness. They are noisy and are not attributed wholly to the journal.

Final measurements: local Linux/Xvfb, acceleration disabled, 1200×950, 104 native characters at 30 ms intervals per case, two mounted editors, Properties and Layers visible, neighboring FileView. The harness stubs toolbar/layout plumbing. Handler diagnostics are opt-in and retain at most 512 samples per category. Timings below are milliseconds; commit/Undo/Redo are single samples, not percentiles.

| Document | beforeinput p95 | input p95 | Input→second-rAF p50 / p95 / max | Properties commit | Undo / Redo |
| --- | ---: | ---: | --- | ---: | --- |
| Small | 0.2 | 0.3 | 23.5 / 33.1 / 34.0 | 1.7 | 6.6 / 4.4 |
| 20k words, 10k paragraphs | 0.1 | 0.3 | 57.4 / 177.6 / 257.1 | 29.7 | 32.1 / 31.5 |
| 2k fragmented paragraphs | 0.2 | 0.3 | 24.4 / 41.9 / 45.4 | 24.7 | 32.2 / 29.1 |
| 7k fragmented paragraphs, stress | 0.1 | 0.2 | 89.8 / 209.2 / 289.9 | 64.8 | 83.1 / 78.9 |

Typing-run commit was 0–0.1 ms at the available timer precision. JS heap deltas for the four cases were approximately +266 KB, +437 KB, +11 KB and +133 KB. Embedder deltas varied substantially, including negative values from collecting earlier fixtures. The 104-character runs caused **zero Layers mutation batches** and 0–2 total toolbar calls, not per-character rebuilding. FileView refreshed at its existing coarse cadence.

The first implementation measured several milliseconds per input handler because the old bookmark path code copied all siblings. Cached, structurally invalidated paths removed that journal overhead. Full input-to-paint and replay latency remain high on very large/fragmented documents. These single-run results do not certify a full-workspace latency budget or establish a controlled speedup against the previous implementation.

## Verification and remaining limits

- Eleven focused Node test files pass: journal patches, desktop dispatcher, transaction/composition boundaries, source safety, latency classification, CSS indexing, HTML Layers and four FileView suites. The existing FileView iframe harness needed its missing `dispatchEvent` method and imported diagnostic-counter stub; production FileView behavior was not changed for this task.
- Full Electron foundation/source/transaction suite passes; `chronologicalUndoCoherent` is now true. Source shell attributes, inert scripts, portable resources, decoration/provenance collisions, independent serializers, retained ownership, scoped saves and FileView behavior pass. Ten remount cycles finish with zero observed mutation observers and zero live providers.
- Properties Electron suite passes, including shared CSS source replay and conflict checks.
- Dedicated journal Electron suite passes all 49 assertions.
- The original history diagnostic remains available; its assertions now expect owned chronology. Its new report is separate from the preserved unsafe baseline evidence.

Commands:

```sh
node --loader ./scripts/html-test-loader.mjs --test \
  ApplicationSystem/Desktop/ElectronHtmlHistory.test.mjs \
  ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/*.test.mjs \
  ApplicationSystem/public/PanelInstances/Common/HtmlProperties/*.test.mjs \
  ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContext.test.mjs \
  ApplicationSystem/public/PanelInstances/ViewPanels/FileView*.test.mjs

env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-foundation.electron.cjs --journal
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-foundation.electron.cjs --properties
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-foundation.electron.cjs
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-foundation.electron.cjs --history
```

Remaining limits are deliberate CSS source-specific history, safe history invalidation for unclassified/delayed legacy mutations, approximate rather than total-process memory accounting, OS IME coverage, native role availability outside the owned dispatcher, and large-document rendering/replay latency. This implementation does not claim every arbitrary third-party DOM mutation is reversible.

**One authoritative editor-owned chronological HTML history?** Yes, for each participating mounted HTML editor; CSS remains explicitly separate.

**Can stale Chromium snapshots overwrite newer authored content?** Not through the supported routes or the tested native/prototype bypasses on this Electron build. The native stack still exists, so this is a tested containment mechanism rather than a browser-history erasure claim.

**Can the native-undo pause be removed safely?** Yes for the owned-journal path; it is disabled there after the acceptance gates passed. Legacy/nonparticipating paths retain the fence.

**Is Properties now safe to expand beyond prototype scope?** The mixed-history correctness blocker is resolved for the tested operations. This is not blanket expansion approval: retain prototype scope until the documented large-document performance and additional-operation acceptance work is addressed. No controls were added.
