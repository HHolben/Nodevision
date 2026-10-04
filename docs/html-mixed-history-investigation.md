# HTML mixed-history investigation

Follow-up: [editor-owned history implementation and acceptance results](html-owned-history-implementation.md). The report below preserves the pre-journal investigation and its original evidence.

Investigated 2026-09-29–30 against the current working tree, Electron 42.2.0 / Chromium 148.0.7778.97. **No safe small bridge was established. The Properties undo safeguard must remain, and normal mixed undo is not ready for broader Properties controls.** This task takes the explicitly permitted preparatory path. The chronological-undo exit criterion is not met.

Implemented: an editor-owned, observational transaction/composition boundary and a guard rejecting transaction-backed graphical changes while composition is active. Added native Electron experiments, exact state/event traces, source-preservation assertions, a long-typing memory probe and focused tests. No Properties fields or universal undo framework were added.

## Exact failure and its causes

[Final native experiments](html-history-experiments.json) contain the complete HTML, selected element, native caret, retained selection bookmark, dirty flag, document revision, programmatic stack sizes and CSS source state after each step. Event traces include trusted/cancelable flags, input types, target ranges, composition, selection changes, transaction phases and DOM mutation counts. The earlier [baseline capture](html-history-baseline.json) precedes the new transaction boundary; its bare-host cases shared the workspace document. Final bare-host cases each use a fresh iframe document to eliminate leftover workspace history.

### A: typing → inline Properties → typing

Starting at `<p id="text" class="card">x</p>`, type `A`, apply inline red through Properties, return the caret to the end and type `B`. The following is the **controlled diagnostic with the Properties fence explicitly removed by the harness**. Application behavior retains the fence.

| Step | Text | Inline red | Retained caret offset | Programmatic undo/redo entries | Revision |
| --- | --- | --- | ---: | --- | ---: |
| Type A | xA | no | 2 | 0 / 0 | 9 |
| Apply Properties | xA | yes | 2 | 1 / 0 | 10 |
| Type B | xAB | yes | 3 | 1 / 0 | 11 |
| Properties Undo | xAB | yes | 3 | 1 / 0 | 11 |
| Keyboard Undo 1 | xA | yes | 2 | 1 / 0 | 13 |
| Keyboard Undo 2 | x | yes | 1 | 1 / 0 | 15 |
| Keyboard Undo 3 | xA | no | 2 | 0 / 1 | 17 |
| Keyboard Redo 1 | x | yes | 1 | 1 / 0 | 20 |
| Keyboard Redo 2–3 | x | yes | 1 | 1 / 0 | 21 |

Properties Undo correctly refuses the revision changed by B. The unsafe legacy sequence undoes A before color, then resurrects A from a snapshot, and never recovers B. Expected text for the three undos was `xA`, `xA`, `x`, with color removed on the second step. The dirty flag stays true through the sequence; current dirty tracking is not a saved-revision equality calculation.

This is not a native browser snapshot restoring the entire old page. Nodevision's `runUndoCommandWithProgrammaticFallback` first executes native undo and compares body HTML. If the body did not change, it falls back to `WysiwygProgrammaticHistory.undo()`, which assigns an old `innerHTML`. The two stacks reconcile only if serialized strings happen to match. Neither match nor “native command changed nothing” identifies the next chronological operation. Snapshot replacement also discards node identities referenced by native commands. Native input does not invalidate the snapshot redo branch; the separate diagnostic that restores a snapshot, types C, then replays the snapshot redo discards that new branch.

Native history steps also produce a trusted `input` followed by Nodevision's synthetic dirty `input` on the fallback route. That accounts for some two-increment revisions in the table; a revision is an invalidation counter, not a native undo-group identifier.

### B–E and isolation

| Case | Observed result |
| --- | --- |
| B: native A, transaction inserts `[insert]`, native B | Undos yield `xA[insert]`, `x[insert]`, `xA`; redo cannot reconstruct the intended sequence. The insertion bypasses native history and snapshot restoration reintroduces earlier text. |
| C: basic class mutation and style mutation | Direct DOM attributes bypass native history. A new class survives native typing undo until the later snapshot fallback. Revision-checked Properties Undo refuses after later native text; unguarded snapshot replay does not. |
| D: external stylesheet Properties | HTML stack remains empty and HTML revision does not change for the CSS commit. CSS Undo/Redo restores CSS while leaving typed HTML intact. Its revision guard rejects A's saved operation after B commits to the same shared buffer. |
| E: toolbar focus, Properties focus, caret movement, A → B → A | Bookmarks and context references stay distinct, but browser history itself is not editor-owned. The trace includes toolbar undo in A and menu operations after switching. Changing focus cannot partition the native stack. |
| Fresh document, two bare contenteditable hosts | Type A in host 1, B in host 2, focus host 1, invoke Electron menu Undo: host 1 remains `xA`, host 2 changes `yB` → `y`. The native caret moves into host 2. This reproduces the ownership issue without Nodevision. |

The active Properties fence preserves `xAB` through repeated keyboard Undo/Redo and the tested Electron menu Undo. An arbitrary direct `document.execCommand('undo')` bypasses its `beforeinput` protection in this build. Existing Nodevision toolbar/fallback calls check the flag first; external code must not bypass that owned route. The safeguard is containment of supported entry points, not an interception of every possible JavaScript mutation API.

## Actual native boundaries and alternatives tested

Experiments use Electron `sendInputEvent`, `webContents.undo/redo/paste` and Chromium composition commands, not synthetic `dispatchEvent` as a replacement for native typing. Those APIs are documented by [Electron](https://www.electronjs.org/docs/latest/api/web-contents/) and the [Chrome DevTools protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/).

| Approach | Experiment and result | Decision |
| --- | --- | --- |
| A. Join native history with browser editing commands | `insertHTML` and `foreColor` gave chronological A → command → B undo/redo in fresh documents. However, inserted `<span class="inserted">` became plain text, and color generated `<font color="#ff0000">` around text rather than modifying the chosen element's inline declaration. | Not an adapter for arbitrary authored attributes/classes/styles, source-preserving insertion or reversible previews. No native-command workaround shipped. |
| B. Intercept native history intents | Canceling `beforeinput` prevented the tested native menu undo. Nodevision's keyboard fallback calls `execCommand`, whose undo produced `input` without the corresponding cancellable `beforeinput` in these sequences. | A future owned dispatcher needs keyboard, toolbar and menu boundaries together. Interception alone supplies neither reversible edits nor ownership. |
| C. Observe native changes into a Nodevision timeline | A diagnostic MutationObserver retained the first text value per changed text node and the current final value. A 1,000-character run touched one text node; compact storage was 1,002 code units, versus 500,500 cumulative old-value code units if every record were retained. | Promising foundation. This collector is a measurement prototype, **not a replay engine**: it does not yet reverse child-list topology, authored/runtime attribute distinctions, hydration, selections or unsupported input types. |
| D. Native/programmatic operation ledger | In a fresh document, type A, change `p.style.color` directly, type B without refocusing. One native Undo removes **both A and B** while keeping red. Reversing red in place does not restore a separate native A step. Typing C invalidates native redo. | Reject a ledger that assumes native runs correspond to Nodevision boundaries. Native group splitting/identification and per-host stack routing are not established. |
| E. Source/model-owned editor | Inspected the source projection/provenance and current snapshot restore path against the failures above. A full HTML source AST would also need a native-input projection and selection bridge. | A full contenteditable replacement is not justified. A document-owned reversible DOM journal is a smaller next experiment; it still requires a real history implementation, not another fallback condition. |

Reassigning identical `innerHTML` was tested separately. It left native history enabled but commands referring to the prior text node no longer undid that text; it also displaced the caret before subsequent typing. It is not a safe history reset or grouping operation. Similarly, selection/focus changes sometimes separated typing in the workspace, but bare uninterrupted typing crossed an unrecorded style change. There is no proven one-to-one operation boundary to put in a native ledger.

The editing working group's [`execCommand` draft](https://w3c.github.io/editing/docs/execCommand/) explicitly remains incomplete and is not expected to advance. Successful simple command experiments therefore do not establish stability or suitability for a general source-preserving transaction adapter. [Input Events Level 2](https://www.w3.org/TR/input-events-2/) defines the intended input/composition interfaces; actual traces remain authoritative for this Electron build. In particular, the tested menu history event exposed a caret target range despite the draft's empty-history-range description, while scripted undo did not offer the same cancellable boundary.

## Shipped preparatory change

[HtmlTransactionBoundary.mjs](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlTransactionBoundary.mjs) is owned by each `createHtmlEditorTransactions` instance. Consumers can use `transactions.subscribeBoundary(listener)` and read `transactions.composing`. It reports beforeinput/input metadata, composition start/end, transaction begin/preview/commit/cancel, legacy record, reset and disposal. It stores no text, DOM snapshots, operation ledger or event history. Subscriptions are observational, cannot veto commands through the event object, and are removed on disposal.

`begin`, `preview` and `commit` reject while composition is active. This prevents a transaction-backed graphical action from capturing or committing half-composed native text. Existing nested transactions, preview grouping, rollback, no-op suppression, revision invalidation and CSS model adapters remain intact. The snapshot history gains `inspect()` for counts and retained string code units, used only when requested by diagnostics. No HTMLeditorImpl growth was needed in this task.

The boundary does **not** synthesize native groups, record native history, intercept undo, clear redo or merge the CSS and HTML stacks. Its purpose is to provide explicit, tested command boundaries for the next owned-history implementation instead of inferring operations from dirty events. Direct legacy mutations that happen before `transactions.record()` still need migration. A preview that is already open when native composition begins is not solved by this new begin/commit guard; cancellation and noncancelable composition input require their own coordination experiment.

## Composition, selection and source checks

The Chromium composition experiment sends `に`, replaces it with `日本`, then commits `日本`. Composition updates are trusted, noncancelable `insertCompositionText` inputs. Attempting a graphical style transaction after the first draft now fails **without altering the draft**; composition continues and native undo removes the committed composition as one tested unit. The trace also records Backspace and native paste and their subsequent undos. CDP tests the browser composition pipeline, not an OS input method's candidate window or every language's IME behavior.

Both native caret paths and editor-owned bookmarks are recorded independently, so an inactive editor is not assigned the active browser selection. Snapshot restore follows the existing bookmark paths rather than retaining disconnected selection nodes, but a valid caret on the wrong historical text does not make history correct. Native cross-host undo can still move the browser selection to another host. The existing Properties suite covers its own immediate Undo/Redo, owner changes, Layers selection integration and stale-operation refusal; it does not certify chronological Layers/history replay after arbitrary structure changes.

Every recorded workspace state is checked for retained `html lang`, authored body class, external script `src`/`defer` and absence of private origin/chrome markers in saved source. Existing foundation and Properties suites are rerun separately for the larger source/provenance fixture matrix. No Notebook content or production disk save route is used by the experiments.

## External CSS model

The bounded behavior remains explicit: HTML native history belongs to the HTML editing path; **Properties Undo/Redo for a stylesheet belongs to that shared CSS buffer**. Typing in HTML does not invalidate a CSS operation. Another CSS commit does, and dirty CodeEditor/live-buffer conflicts still refuse replay/save. Keyboard undo in the HTML surface does not undo a stylesheet edit merely because it happened between two typing runs. This is source-specific history, not a claimed cross-file chronological timeline. Do not relax source revision checks to make it appear unified.

## Concrete follow-up architecture

Implement an **HTML-context-owned reversible DOM journal**, keeping native input/rendering while taking ownership of Undo/Redo. It should replace the native-first/snapshot fallback for participating documents only after these gates pass:

1. **Native capture and ownership:** bracket mutation collection with beforeinput/input and the new transaction boundary. Keep per-editor journals and flush only the pending run when selection, focus/owner, edit type or programmatic command changes. During composition, collect draft mutations but commit one operation only after composition finishes. Unclassified mutations must invalidate replay or be explicitly adapted, never silently enter an unrelated operation.
2. **Reversible patches:** store first/last text values per node; retained nodes plus parent/sibling anchors for insertion/removal; authored attribute before/after values through provenance-aware operations. Preserve live node identities during replay. Use a bounded affected-subtree fallback only for demonstrated complex inputs; do not substitute whole-body snapshots into a still-browser-owned timeline.
3. **Authored/presentation classification:** explicitly exclude editor chrome, resolved URLs, selection classes and hydration mutations using existing provenance. Quiesce replay observers without suppressing unrelated authored input. Prove script inertness, resource restoration and save fidelity after undo/redo. This is the main missing work in the compact text-only collector.
4. **One HTML command dispatcher:** route keyboard, Properties/toolbar commands and cancellable native menu intents to the owning journal. Prove direct programmatic editing commands and redo branching. A new committed authored edit clears redo; previews and cancel do not. A failed preimage/revision check refuses replay without replacing later text.
5. **Selection and bounds:** attach before/after resilient bookmarks and selected-element identity to each operation, validate all anchors before replay, and bound both entry count and retained bytes/nodes. Release removed-node references when history is trimmed or a document closes.
6. **Cross-file decision:** initially retain explicit source-specific CSS history. A later HTML-to-CSS operation reference may enter the timeline only with both source identity/revision validation and an agreed shared-buffer policy when another page edits the sheet. It must never replay an unvalidated CSS snapshot.

First implementation gate: native text/delete/paste plus one inline declaration and one insertion, tested with A → style → B undo/redo, redo branching, composition, two retained editors and source fixtures. Second gate: subtree edits, multi-node selection, transaction-backed resize previews and cancellation. Only then consider replacing the current protection and extending Properties. No full HTML AST editor or application-wide universal undo service is required by the present evidence.

## Reproduction and checks

```sh
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron \
  --no-sandbox scripts/html-foundation.electron.cjs --history
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron \
  --no-sandbox scripts/html-foundation.electron.cjs --properties
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron \
  --no-sandbox scripts/html-foundation.electron.cjs
```

The history experiment's PASS means its safety assertions and evidence collection passed; it explicitly records `chronologicalInlineUndo: false`. It is not a passing implementation of unified undo. Eight focused Node test files pass, including eight transaction subtests covering composition exclusion, native-input observation without snapshot reads, disposal, nested rollback, bookmarks, no-op and twenty-preview cancellation. The new boundary module and touched transaction/history modules meet the fewer-than-200 nonblank/noncomment-line limit. Unrelated dirty files remain intact.

## Performance evidence and limits

Same local Linux/Xvfb setup, 1200×950 window, acceleration disabled. Both retained HTML editors are mounted; the large case has 2,000 paragraphs with three inline fragments each per editor. Every timed typing sample sends 104 native characters at 30 ms intervals. The baseline is the working foundation/Properties implementation before this task's boundary module; after is the completed preparatory change, **not a new undo engine**. “Trace on” additionally enables the bounded event/mutation collector. Both modes retain the existing harness input-to-rAF measurement.

| Document | Extra trace | Before: p50 / p95 / max second-rAF ms | After: p50 / p95 / max second-rAF ms | After: commit / Undo / Redo round-trip ms |
| --- | --- | --- | --- | --- |
| Small | off | 23.45 / 34.40 / 35.30 | 24.55 / 33.30 / 34.10 | 2 / 7 / 5 |
| Small | on | 24.30 / 34.50 / 35.60 | 24.10 / 33.40 / 34.60 | 3 / 6 / 4 |
| 2,000 fragmented paragraphs | off | 25.25 / 47.50 / 91.00 | 24.60 / 42.00 / 89.80 | 38 / 33 / 41 |
| 2,000 fragmented paragraphs | on | 26.35 / 71.00 / 204.70 | 24.70 / 54.90 / 99.60 | 29 / 36 / 49 |

These are single-run, noisy measurements, not statistically controlled speedup claims. Commit/Undo/Redo include the Electron executeJavaScript round trip and measure the current unsafe legacy algorithm; they do not establish the latency of a proposed journal. The trace-off typing measurements show no obvious latency regression from the preparatory boundary, but stronger budgets require repeated runs. Diagnostics raise the large-document tail and should remain opt-in. The real HTML editor, tabs, Layers and FileView run; production toolbar/layout plumbing is partly stubbed. No full-workspace performance claim is made.

A separate 1,000-character run at 4 ms intervals measured JS heap growth of **613,196 bytes** and embedder heap growth of **1,435,136 bytes**, with explicit garbage collection before and after. This includes browser undo, editor/harness state and input-to-paint samples, not just proposed history storage. The text collector retained one node and 1,002 code units; retaining every old text value would have accumulated 500,500 code units. Nodevision's programmatic snapshot stack remained empty throughout native typing. Long-run native-browser history memory is not controlled by the existing 25-entry programmatic limit.

The production boundary adds no mutation observer, serialization, full DOM traversal, toolbar/Layers update or per-key snapshot. Tests make the snapshot getter throw during observed native input and confirm that the boundary never reads it. The diagnostic collector and full-state serialization after named experiment steps live only in the harness. Structural journal memory, replay latency, listener/observer cleanup under extended editing, and real OS IME performance remain follow-up acceptance tests.
