# Editor-owned HTML history: large-document performance

Status: the saved matched matrix is complete and validated (48 fixtures per version, 576 replay pairs). Supplemental real-index, structural Paint, and final regression validation are recorded below.

## Scope and reproducibility

This investigation continues the chronological DOM journal described in [the implementation report](html-owned-history-implementation.md). It does not introduce Properties controls or change history limits. Existing source-preservation, conflict, ownership, and native-history containment behavior remains required.

The benchmark uses the installed Electron/Chromium, native Electron input, a local HTTP server, and generated Notebook responses. It does not save into a user's Notebook. Run the following sequentially on the same otherwise idle machine:

```sh
NV_HTML_PERF_BASELINE=1 NV_HTML_PERF_LABEL=before env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-foundation.electron.cjs --performance
NV_HTML_PERF_LABEL=after env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-foundation.electron.cjs --performance
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-history-index-performance.cjs
python3 scripts/summarize-html-history-performance.py
```

`html-history-performance-baseline.cjs` reconstructs the previous restoration, Layers, and attention paths while retaining the same instrumentation. This is a comparison against the already-owned journal, not against the obsolete mixed Chromium/snapshot timeline. The current working tree contains earlier foundation work; the comparison does not treat every uncommitted change as this optimization.

## 1. Benchmark matrix

Four word counts × two markup types × six configurations = 48 cases per version. Each case gets a fresh renderer document to prevent browser-native history from previous fixtures affecting subsequent cases. Each runs 40 native character insertions, typing Undo/Redo, four Backspaces and deletion Undo/Redo, three Deletes, caret movement followed by typing, explicit run flush, 300-word HTML paste and Undo/Redo, existing color Properties edit and Undo/Redo, paragraph insertion and Undo/Redo, and a 12×8 table transaction and Undo/Redo.

The matrix sends Electron `char` events for insertion, with 30 ms pacing; Backspace/Delete/navigation use keyDown/keyUp. Separate renderer traces and real-index measurements send complete keyDown/char/keyUp sequences, including the keyup attention path. Do not equate these workloads. Replay measurements call the owned journal directly; keyboard/menu routing correctness is tested separately. Matrix replay timings are single samples for each fixture/operation, not stable per-operation p95 estimates. Repeated index replays supplement them.

## 2. Clean and fragmented documents

| Words | Clean nodes / elements | Fragmented nodes / elements |
| ---: | ---: | ---: |
| 1,000 | 199 / 100 | 2,399 / 850 |
| 10,000 | 1,999 / 1,000 | 23,999 / 8,500 |
| 20,000 | 3,999 / 2,000 | 47,999 / 17,000 |
| 40,000 | 7,999 / 4,000 | 95,999 / 34,000 |

Counts exclude the editable root. Each semantic section contains a twenty-word paragraph. Fragmentation alternates strong, colored span, emphasis, and plain text, with word separators preserved. This models ordinary accumulated inline formatting, without deeply nested empty wrappers. Exact word counts are verified in the fixture output. These synthetic fixtures are reproducible examples, not a corpus of real user documents, and do not represent image-heavy or deeply nested documents.

## 3. Workspace configurations

The lightweight runner mounts real editor, FileView, Layers, and Properties modules. Configurations are editor; editor + FileView; editor + Layers; editor + Properties; editor + Layers + FileView (`heavy`); and two retained editors. Its toolbar implementation is a counted stub. Retained editors exercise ownership and cleanup; the long session alternates their visibility and active context.

The index runner boots real `index.html`, the application server, toolbar, and attention subscribers in isolated temporary account/storage directories. It then mounts the same fixture modules in the workspace. It measures 20,000-word clean/fragmented editor/heavy configurations. This validates actual application subscribers, but is not a recreation of every persisted user layout or the production tab-switch UI.

## 4. Native typing

The raw reports include per-input first/second rAF latency, journal beforeinput/input/capture/coalescing samples, all registered input-listener durations, long tasks, retained entry counts, post-GC heap, and CDP renderer counters. Forty character insertions must coalesce into one entry. Backspace, Delete, paste, caret movement, and explicit boundaries are separately labeled. CDP composition sends Japanese preedit updates and commits them; it tests browser composition boundaries, not a physical OS IME.

## 5. Replay by operation type

The six replay shapes are coalesced text, deletion, paste, inline style, paragraph insertion, and table insertion. The journal performs constant-time last-entry lookup. Its measured replay includes pending-mutation validation and typing flush; DOM patch application, restoration subscribers, caret restoration, input notification, and notification listeners are separately measured. Journal lookup is not timed as a standalone sub-microsecond phase.

Text/attribute patches retain old/new values and node identities. Structural patches retain inserted/removed nodes and their sibling anchor. Replay does not serialize, parse, replace the editable root, or search for target nodes. Structural work grows with the affected subtree, and patch byte accounting visits that subtree. The affected text-node length still matters for coalescing/accounting; the fixtures do not test a single enormous unbroken text node.

## 6. Handler, layout, and paint interpretation

Two rAF callbacks are presentation proxies, not proof that two frames reached a display. The selected 20,000-word traces additionally record actual Chromium `Paint`, `Layout`, and `UpdateLayoutTree` events. First/second Paint values mean the next two renderer paint events after beforeinput; they can belong to the same rendering cycle or different frame surfaces. They are not compositor presentation timestamps. Paint CPU duration, rAF delay, renderer task duration, and synchronous replay duration are distinct metrics.

Matrix CDP CPU totals cover the operation plus a fixed 560 ms settling period. Some large preview refreshes spill beyond that window, so these totals are observation-window costs, not complete per-operation preview latency. The index runner waits for the preview text to match the editor before taking the final sample. Nested JS phase durations overlap and must not be added together as if exclusive. The renderer runs under Xvfb with hardware acceleration disabled; results support relative comparisons, not a display-device latency promise. A bare contenteditable trace supplies a browser control with the same source, but CSS/layout and native editing behavior can differ from the managed editor.

## 7. Layers contribution

Previously every selected-element refresh recollected eligible elements across the entire root, including when membership had not changed. Plain text changes do not alter layer membership; most attributes affect labels or visibility only. A small `HtmlLayerInvalidation` helper now caches membership per attached host. Element insertion/removal, id changes, and layer-ignore changes invalidate membership; ordinary attributes refresh rows using the cache. The MutationObserver remains the source of invalidation, so this does not couple Layers to a particular history implementation or miss non-history mutations.

Existing virtualization is retained. Visible rows can still rebuild on selection/attribute changes and read computed styles. Structural changes still require full recollection. A synchronous selection notification can precede MutationObserver invalidation; the scheduled observer refresh supplies the updated membership afterward. This is not an incremental tree-index implementation.

## 8. FileView contribution

The existing live provider debounces authored revision publications by 80 ms; FileView has its own refresh coalescing. Previously restoration called `markHtmlEditorDirty`, emitting input, and the journal emitted input again. Replay now emits its single normal input after restoration. The ordinary input path marks the editor dirty and publishes the transaction revision.

The benchmark counts revisions, LiveFileContent events, provider serialization, and mounted iframe identities. Multiple attribute mutation batches on an iframe do not mean multiple reloads. The optimized matrix checks one revision, at most one publication, at most one new iframe, and preserved editor focus per replay. Full source serialization and iframe construction remain necessary costs in the current preview architecture; the preview is not deliberately made stale.

## 9. Toolbar and attention

The old restoration reset image, image-text, audio, circuit, and table context for every text edit. `HtmlHistoryRestore` skips this global reset for identity-preserving ordinary text/style/plain-structure patches. Media/widget-sensitive replay and replay while an owned media tool selection is active retain conservative presentation restoration. The new attention module compares semantic selection context before publication; repeated keyups in the same context do not republish it. Input after replay reports the restored native caret, and inactive editors cannot publish over the active editor.

A separate HTML toolbar publisher also compares image, image-text, audio, and circuit selection patches against current state before invoking the rebuilding toolbar API. This removes unchanged keyup patches without changing that shared API. The matrix counts attention commits and toolbar calls; the index run additionally observes real toolbar child-list rebuild batches. Semantic caret changes still publish. A unit regression checks a restored table-cell context, repeated-keyup suppression, and inactive-editor isolation.

## 10. Caret/bookmark cost

Bookmarks use child-index paths and offsets, not serialized HTML or permanent references to detached targets. Path capture walks ancestors and preceding siblings; a revision-keyed WeakMap avoids recomputing paths when topology is unchanged. Structural capture/replay invalidates the cache. Resolution walks each saved path and does not traverse all document text. Wide sibling lists remain a potential capture cost. Native `focus` and range installation, plus selection subscribers, can force layout and dominate the measured `restoreCaret` phase even when path lookup is cheap. No fragile new bookmark representation was introduced.

## 11. History memory

Limits remain 100 entries and an estimated 8 MiB. The estimate counts text/attribute values and retained structural subtrees, not Chromium object headers, selection internals, iframe heaps, or all browser-native history. It is not an 8 MiB process-RSS guarantee. The report records cumulative retained bytes after each operation, allowing entry-shape costs to be compared.

The long session checks both limits, then inserts/removes large detached fragments until the byte limit forces eviction. A WeakRef verifies that the last removed fragment is retained while history owns it and collectible after clearing history. Post-GC CDP heap and DOM counters accompany the result. Collection of one representative node is evidence against that retention path, not proof of absence of every possible leak.

An initial diagnostic run was excluded from the matched comparison: the listener-counting harness kept callback keys even after removal, retaining disposed editor closures. The counter now deletes empty registrations. Fresh renderer documents also prevent cumulative native-browser history from contaminating fixture-to-fixture memory measurements. Initial multi-million-node totals must not be attributed to the owned journal.

## 12. Long session

The 120-cycle session uses two retained 20,000-word fragmented editors, Layers, FileView, typing, deletion, Properties color changes, paragraph insertion, Undo/Redo, and periodic activation switches. The first and last five cycles are fully sampled; counters and post-GC heap are compared before/after. A cycle's wall time includes deliberate input pacing and settling and is not pure CPU latency. Provider, global listener, observer, and timer counts are checked after disposal; browser native undo may retain nodes until navigation even when the owned journal clears them.

## 13. Changes made

- Local presentation-restoration classification avoids full-root scans/tool resets for plain text, style, and plain structural replay.
- The journal is the single replay-input publisher, removing duplicate revision notification.
- Layers caches membership independently of history while retaining observer invalidation and virtualization.
- Equivalent HTML selection toolbar patches no longer trigger rebuilds.
- Attention reporting moved out of the large implementation module and suppresses equivalent semantic publications.
- Opt-in, per-editor phase instrumentation is disabled by default; broad browser probes exist only in benchmark scripts.

The new native modules have standard headers and fewer than 200 code lines. Optimization logic was not added to the large `HTMLeditorImpl.mjs`; its changes wire helpers and remove the duplicated work. Media/widget restoration remains conservative.

## 14. Before/after results

The [complete matched table](html-history-performance-matrix.md), [all 576 replay pairs](html-history-performance-matrix.csv), and [phase summary](html-history-performance-summary.json) are generated from the original before/after JSON. All 48 fixture keys and operation labels match. The completed output already contained the 40k cases and optimized long session; these were reused rather than rerun.

Verified examples with Layers, in milliseconds:

| Fixture | Typing Undo before → after | Color Undo before → after |
| --- | ---: | ---: |
| 1k clean | 21.6 → 2.5 | 17.8 → 0.8 |
| 20k clean | 22.2 → 2.6 | 19.6 → 0.8 |
| 20k fragmented | 100.1 → 3.8 | 99.0 → 1.2 |
| 40k clean | 35.5 → 3.8 | 31.4 → 1.0 |
| 40k fragmented | 171.1 → 4.4 | 160.4 → 1.1 |

The 20k fragmented typing Undo comprises 0.6 ms patch replay and 2.3 ms caret restoration. Across all six 40k configurations, typing Undo is 3.1–5.3 ms clean and 4.0–5.2 ms fragmented; color Undo is 0.6–1.3 ms. The 40k journal input p95 is 0.2–0.4 ms. These are instrumented fixture measurements, not real-index results.

All **576** optimized replay samples satisfy one revision, at most one live publication and mounted iframe within their observation window, preserved focus, and zero Layers recollections for text/color replay. This supersedes the earlier partial count of 252. The fixed-window preview counts are not proof of complete preview settling; see the separate real-index results.

The optimized 120-cycle session grows post-GC JS heap from 7,715,488 to 8,336,960 bytes: **621,472 bytes (0.62 MB / 0.59 MiB)**. Browser event listeners remain 174, measured global listeners 31, and observing MutationObservers 10. DOM nodes rise by 480 as authored paragraphs accumulate. The journal reaches exactly 100 entries. Large fragments leave four entries at 8,001,280 estimated bytes, below 8,388,608. The representative removed node is alive while retained and collectible after clear. Disposal leaves zero providers, observing MutationObservers, pending timeouts, and active intervals. Ten harness/global listeners remain; do not call that zero global listeners. Early/late five-cycle mean wall times are 940.4/953.0 ms, including pacing and settling.

Selected 20k fragmented traces report optimized typing Undo at 4.453 ms editor-only and 4.009 ms heavy, with next Paint events at 7.283/6.831 ms. These Paint events are renderer work, not proof of display presentation.

## 15. Regression results

Final working-tree validation: **18 Node test files passed**, using `node --experimental-loader ./scripts/html-test-loader.mjs --test` for the HTML component tests, CSS source index, desktop history routing, attention, Layers, GraphicalEditor live mutations and FileView suites. Foundation/source-preservation, Properties/CSS/shared-source conflict, and owned-history Electron suites all passed. The foundation imports the preservation/resource and transaction audits; owned-history includes native composition, native command containment, structural replay, media-selection cleanup, ownership and disposal. [Commands/files and captured output](html-history-final-regressions.json) preserve the results.

The media guard has both a unit regression (`HtmlHistoryRestore.test.mjs`) and a browser regression in `html-journal-experiment.cjs`: plain replay while an owned image context is selected clears that media context, while another editor's selection does not trigger restoration. Attention tests verify repeated-keyup suppression and restored table-cell context. Resource audits verify image source Undo/Redo and portable source preservation. Browser tests emitted expected stale-provider refusal/security diagnostics; suite exit codes were zero.

## 16. Remaining bottlenecks and expansion decision

1. **Journal typing latency:** not a significant contributor in this matrix; input p95 remains approximately 0.2–0.4 ms at 40k.
2. **Ordinary replay:** caret/range restoration, native layout and notification overhead dominate the sub-millisecond DOM patches.
3. **Structural replay:** deferred Layers membership collection dominates with fragmented documents; browser layout and caret restoration also grow.
4. **Layers amplification:** ordinary text/color no longer recollects membership. At 40k fragmented, typing Undo is 4.3 ms editor-only versus 4.4 ms with Layers. A fixed table Undo adds 43.4 ms of deferred collection; clean 40k adds 6.1 ms. Single-sample differences should not be treated as precise overhead estimates.
5. **FileView:** synchronous patch replay stays small; debounced publication, whole-source serialization, iframe creation and rendering determine deferred completion. Fixed-window renderer totals cannot be attributed completely to one operation. Separate completion measurements below resolve that ambiguity without suppressing preview updates.
6. **Toolbar/attention:** equivalent selection patches are suppressed. Semantic context changes still publish; actual-index counts below supplement the stubbed matrix.
7. **40k caret:** significant relative to the journal itself: Layers typing Undo spends 2.7 of 4.4 ms restoring caret, while table Redo spends 6.3 of 6.9 ms there. It is not the dominant deferred structural cost.
8. **Scaling:** patches scale with the affected content; full Layers recollection scales with total eligible membership and fragmentation. Similar paragraph/table recollection times at each document size implicate whole-root traversal rather than inserted subtree size. Full-source serialization and native layout also scale with document size.
9. **Memory:** bounded journal retention and stable lifecycle counts are supported by the 120-cycle run, eviction checks and representative WeakRef release. This is not a process-RSS bound or proof against every leak.
10. **Tier 1 decision:** the journal foundation supports proceeding with box-model/basic-layout work, provided new gestures remain grouped transactions and preserve the existing invariants. This is not a claim that all 40k interactions fit a frame: structural Layers refresh and live preview remain known latency risks. Do not expand controls in this task.

A branch index is not a safe small change: membership ordering, selection, visibility and observer-driven edits require a coherent incremental design. Keep required structural recollection and schedule targeted branch invalidation as the next Layers optimization. Transaction begin/commit still reads authored source for no-op detection; FileView still serializes and rebuilds its preview. Neither cost belongs to local journal DOM replay.


## 17. Real index-page completion and FileView accounting

[Raw real-index output](html-history-performance-index.json) uses the real application server, login, toolbar and attention subscribers. The runner mounts generated 20k documents in a representative side-by-side editor/FileView arrangement with Layers below. It does **not** reproduce a user's persisted panel layout; this is a real-index integration measurement, not a user-workspace reproduction. The synthetic matrix uses a stub toolbar and is kept separate.

Each typing sample sends 26 complete keyDown/char/keyUp sequences. Three typing Undo/Redo pairs and one Properties color Undo/Redo pair are sampled per fixture. Completion polls the preview paragraph's text **and inline color**, preventing color-only replay from incorrectly appearing settled. Poll resolution is 25 ms, with renderer/IPC scheduling overhead; an additional 700 ms quiescence period precedes the next operation. `previewWaitMs` starts after synchronous replay and excludes that extra quiescence. It verifies rendered iframe DOM content, not physical display scanout.

| Optimized 20k fixture | Typing replay range ms | Color replay range ms | Preview wait after replay ms | Serialization ms per refresh |
| --- | ---: | ---: | ---: | ---: |
| clean / editor | 2.5–5.7 | 1.0–1.8 | no preview | 0 |
| clean / heavy | 2.2–2.8 | 1.5–1.8 | 680.0–744.0 | 12.4–34.4 |
| fragmented / editor | 2.3–3.4 | 1.0–1.4 | no preview | 0 |
| fragmented / heavy | 2.1–4.0 | 1.5–1.8 | 729.0–834.0 | 55.8–83.2 |

Every optimized replay records exactly one revision and one LiveFileContent publication. Heavy fixtures mount exactly one iframe per replay; editor-only fixtures mount none. All preserve editor focus. Large preview completion takes approximately 0.68–0.83 seconds after synchronous replay, well beyond the matrix's 560 ms window. Accordingly, the old matrix's serialization/renderer totals remain explicitly **windowed observations**; they are not charged as complete costs to a specific replay. The index samples wait for the intended update before resetting counters. No preview suppression was added.

The actual toolbar changes the performance picture substantially: baseline typing replay is approximately 300–579 ms with the real app subscribers, versus 2.1–5.7 ms optimized. Baseline color replay is approximately 296–395 ms versus 1.0–1.8 ms optimized. These values must not replace the harness baseline numbers.

For 26 typed characters, baseline toolbar mutation batches are 53 editor-only / 55 heavy; optimized batches are 2 / 4. Attention commits fall from 26 to 1. Optimized editor-only replay causes zero toolbar rebuild batches. **Heavy replay still causes two toolbar mutation batches during deferred preview completion.** Thus the broad claim “no toolbar rebuilds per replay” is not supported with FileView visible. These are observed rebuild batches, not duplicate history revisions or duplicate iframe mounts. FileView's update path still publishes toolbar state; eliminating all preview-associated toolbar churn remains follow-up work. It no longer dominates synchronous journal replay.

The first runner attempt completed baseline fixtures but failed opening the optimized window because closing the last window initiated Electron shutdown. The runner now keeps the app alive between phases; the complete rerun passed. Chromium required execution outside the filesystem/network sandbox to start; no Notebook files were saved.


## 18. Supplemental structural breakdown

[Raw supplemental trace data](html-history-performance-structural.json) adds opt-in virtual row-render timing and Chromium Paint events to the existing methodology. These are new supplemental samples, not replacements for matched before/after values. Each fixed paragraph or 12×8-table edit gets Undo/Redo at every size and markup type, with Layers visible and no FileView: 32 samples. All timing columns are milliseconds. Rows include visibility/computed-style work; notification includes nested transaction callbacks. Do not add overlapping columns.

| Words | Markup | Edit / replay | Sync | DOM patch | Caret | Notify / transaction | Layers collect | Rows | Visibility / computed style | Paint CPU / first Paint |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1000 | clean | insertion undo | 4.4 | 0.7 | 2.0 | 0.6 / 0.1 | 0.2 | 0.0 | 0.6 / 0.1 | 3.5 / 15.2 |
| 1000 | clean | insertion redo | 1.9 | 0.2 | 1.1 | 0.3 / 0.1 | 0.4 | 0.0 | 0.7 / 0.0 | 2.6 / 13.5 |
| 1000 | clean | structure undo | 1.5 | 0.3 | 0.6 | 0.4 / 0.0 | 0.3 | 0.0 | 1.2 / 0.3 | 3.7 / 21.7 |
| 1000 | clean | structure redo | 5.7 | 0.2 | 4.7 | 0.6 / 0.1 | 0.6 | 0.0 | 0.2 / 0.0 | 5.1 / 21.0 |
| 1000 | fragmented | insertion undo | 2.8 | 0.3 | 1.5 | 0.8 / 0.0 | 2.0 | 0.0 | 0.6 / 0.1 | 4.9 / 22.4 |
| 1000 | fragmented | insertion redo | 1.6 | 0.1 | 0.9 | 0.5 / 0.0 | 3.3 | 0.0 | 1.2 / 0.1 | 3.3 / 23.0 |
| 1000 | fragmented | structure undo | 2.4 | 0.6 | 1.3 | 0.4 / 0.0 | 4.4 | 0.0 | 0.8 / 0.0 | 8.1 / 30.1 |
| 1000 | fragmented | structure redo | 3.7 | 0.2 | 3.0 | 0.4 / 0.0 | 3.5 | 0.0 | 0.7 / 0.2 | 5.6 / 23.2 |
| 10000 | clean | insertion undo | 1.8 | 0.2 | 1.1 | 0.4 / 0.0 | 1.8 | 3.4 | 0.3 / 0.0 | 1.6 / 13.6 |
| 10000 | clean | insertion redo | 1.8 | 0.0 | 1.2 | 0.3 / 0.0 | 3.5 | 3.3 | 0.6 / 0.1 | 1.7 / 17.4 |
| 10000 | clean | structure undo | 1.9 | 0.5 | 1.0 | 0.2 / 0.0 | 2.0 | 3.5 | 0.1 / 0.0 | 2.2 / 14.1 |
| 10000 | clean | structure redo | 4.8 | 0.1 | 3.9 | 0.5 / 0.1 | 1.7 | 2.2 | 0.2 / 0.1 | 3.0 / 16.0 |
| 10000 | fragmented | insertion undo | 2.9 | 0.3 | 2.1 | 0.4 / 0.0 | 14.5 | 10.0 | 0.5 / 0.0 | 3.4 / 39.7 |
| 10000 | fragmented | insertion redo | 2.2 | 0.1 | 1.6 | 0.5 / 0.0 | 14.1 | 9.5 | 0.2 / 0.0 | 1.9 / 33.5 |
| 10000 | fragmented | structure undo | 3.0 | 0.7 | 1.7 | 0.4 / 0.0 | 13.9 | 12.3 | 0.3 / 0.0 | 3.1 / 36.6 |
| 10000 | fragmented | structure redo | 4.4 | 0.2 | 3.6 | 0.4 / 0.1 | 13.3 | 5.9 | 0.5 / 0.0 | 2.7 / 31.9 |
| 20000 | clean | insertion undo | 2.8 | 0.1 | 2.1 | 0.4 / 0.0 | 3.5 | 3.7 | 0.1 / 0.0 | 2.8 / 21.9 |
| 20000 | clean | insertion redo | 2.1 | 0.1 | 1.6 | 0.3 / 0.0 | 2.8 | 3.6 | 0.1 / 0.0 | 3.3 / 21.7 |
| 20000 | clean | structure undo | 3.4 | 0.5 | 2.2 | 0.6 / 0.0 | 5.3 | 4.2 | 0.3 / 0.1 | 3.4 / 26.8 |
| 20000 | clean | structure redo | 3.8 | 0.1 | 3.2 | 0.3 / 0.0 | 3.6 | 3.0 | 0.2 / 0.2 | 3.2 / 20.6 |
| 20000 | fragmented | insertion undo | 2.3 | 0.3 | 1.7 | 0.3 / 0.0 | 28.3 | 18.2 | 0.8 / 0.0 | 2.3 / 58.1 |
| 20000 | fragmented | insertion redo | 2.1 | 0.1 | 1.6 | 0.3 / 0.0 | 26.3 | 19.7 | 0.5 / 0.0 | 2.1 / 59.0 |
| 20000 | fragmented | structure undo | 2.8 | 0.5 | 1.8 | 0.3 / 0.0 | 26.6 | 19.7 | 0.1 / 0.1 | 2.9 / 58.2 |
| 20000 | fragmented | structure redo | 3.1 | 0.1 | 2.6 | 0.2 / 0.0 | 24.0 | 15.1 | 0.4 / 0.1 | 3.4 / 54.4 |
| 40000 | clean | insertion undo | 3.9 | 0.1 | 3.2 | 0.3 / 0.0 | 7.0 | 5.6 | 0.1 / 0.0 | 3.6 / 33.1 |
| 40000 | clean | insertion redo | 3.2 | 0.0 | 2.4 | 0.6 / 0.1 | 6.1 | 5.0 | 0.5 / 0.1 | 3.0 / 31.4 |
| 40000 | clean | structure undo | 3.2 | 0.2 | 2.7 | 0.2 / 0.0 | 6.1 | 4.8 | 0.2 / 0.0 | 3.6 / 31.0 |
| 40000 | clean | structure redo | 5.1 | 0.1 | 4.5 | 0.3 / 0.0 | 6.5 | 10.1 | 0.9 / 0.1 | 3.9 / 41.9 |
| 40000 | fragmented | insertion undo | 4.8 | 0.2 | 4.0 | 0.4 / 0.1 | 58.3 | 39.1 | 0.6 / 0.0 | 3.2 / 121.0 |
| 40000 | fragmented | insertion redo | 5.1 | 0.2 | 4.6 | 0.3 / 0.0 | 53.6 | 41.4 | 0.6 / 0.1 | 3.6 / 123.1 |
| 40000 | fragmented | structure undo | 4.5 | 0.8 | 3.2 | 0.3 / 0.1 | 48.8 | 33.5 | 0.4 / 0.0 | 2.8 / 103.8 |
| 40000 | fragmented | structure redo | 6.6 | 0.1 | 6.0 | 0.3 / 0.1 | 50.2 | 19.2 | 0.4 / 0.0 | 3.1 / 92.1 |

The matched matrix's table Undo collection grows from 0.3 → 1.8 → 2.9 → 6.1 ms for clean 1k/10k/20k/40k, and 2.3 → 12.9 → 22.3 → 43.4 ms fragmented. The inserted table is the same size throughout. Paragraph insertion has comparable collection cost (46.3 ms at 40k fragmented), despite a much smaller affected subtree. This supports whole-document eligible-node membership and fragmentation as the principal collection drivers. Paint and row rendering are separately observed above; native caret/layout costs also increase. A first Paint can precede deferred collection finishing and is not an all-work-complete timestamp.


The supplemental 40k fragmented traces show why structural work still needs follow-up: paragraph replay spends 53.6–58.3 ms collecting membership and 39.1–41.4 ms rendering visible rows; table replay spends 48.8–50.2 ms collecting and 19.2–33.5 ms rendering rows. Visibility/computed-style calls themselves are only about 0.4–0.6 ms. Row timing includes DOM writes and synchronous layout reads (including viewport range calculation), so it is not a pure JavaScript row-construction cost. First Paint occurs 92–123 ms after replay starts. These instrumented supplemental values differ from the original matrix's 43 ms collection and must remain separately labeled. No structural indexing rewrite was attempted.


## 19. Normal panel-tab workspace check

A separate [normal-panel real-index run](html-history-performance-index-normal.json) uses `openPanelTabInCell` for the real GraphicalEditor host and FileView, and a Layers tab with the real HTML Layers context. It exercises normal tab content/lifecycle in the actual app toolbar layout with Layers and the neighboring FileView visible. Both clean and fragmented 20k fixtures pass typing coalescence, typing Undo/Redo, Properties color Undo/Redo, preview text/color matching, one revision/publication/iframe per replay and editor focus preservation.

Typing replay is 3.0–6.4 ms clean and 3.0–6.1 ms fragmented; color replay is 1.2–1.3 ms clean and 1.4–1.6 ms fragmented. Deferred preview matching takes 641–750 ms clean and 701–836 ms fragmented. Both fixtures record four toolbar batches during 26-character typing and two batches per deferred preview refresh; editor history does not duplicate revisions. This run confirms the residual preview toolbar churn in normal tabs, rather than treating the simplified layout as sufficient evidence.

Reproduce the added checks after the original matrix:

```sh
NV_HTML_PERF_STRUCTURAL=1 NV_HTML_PERF_LABEL=structural env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-foundation.electron.cjs --performance
NV_HTML_INDEX_NORMAL=1 env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-history-index-performance.cjs
python3 scripts/export-html-history-performance.py
```

The complete matrix and final regression results support the conditional Tier 1 readiness decision above. Known remaining work is explicit: structural Layers collection/row layout, full preview serialization and iframe latency, and preview-associated toolbar churn. There are no new Properties controls in this change.


Selective-restoration coverage includes native text, inline style, portable image source Undo/Redo, table insertion and resize cancellation, selected-media cleanup, and layout-canvas insertion/width Undo/Redo with focus preserved. The final widget supplement also checks equation/circuit nodes select the conservative restoration path. Full MathJax equation rendering and an external circuit resource were not exercised: the local MathJax bundle is absent and this fixture has no external circuit model. Those renderer-specific cases are not claimed as validated. Plain structural membership and attention/table context are covered by their browser/unit checks; no broad claim of exhaustive widget/UI coverage is made.
