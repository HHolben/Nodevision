# Graph Viewer performance: Phase 1

Phase 1 gives each Graph Manager panel its own renderer, state, subscriptions, and lifecycle. Selection traversal, edge reconstruction, hit testing, and fCoSE algorithms remain unchanged. The original investigation and baseline are preserved in [GraphViewerPerformanceInvestigation.md](GraphViewerPerformanceInvestigation.md) and [graph-viewer-baseline.json](benchmarks/graph-viewer-baseline.json).

## Original problems

`GraphManagerCore.mjs` kept the renderer, caches, layout state, timers, and panel elements at module scope. `GraphManager.mjs` mounted fixed IDs, and initialization found those elements globally. A second panel could reuse the first container and destroy its renderer. Closing a panel disposed semantic zoom and focus handlers but left Cytoscape, its observers, and other bindings alive. The original browser probe observed rendering after disposal. Async loads could finish after their panel closed, and late tab mounts could reactivate a removed tab.

## Instance architecture and ownership

[GraphManagerCore.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerCore.mjs) exports `createGraphManagerInstance({root, container, linkInspector, mqttInspector})`. Its closure owns the existing graph implementation without rewriting its algorithms. [GraphManager.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManager.mjs) passes scoped DOM references, registers the lifecycle before awaiting initialization, and exposes the resulting instance through the panel lifecycle. Panel-local IDs are replaced by data attributes; CSS also retains legacy selectors for other consumers.

| Resource | Owner and lifetime |
|---|---|
| Cytoscape, root, container, inspectors | One factory instance, released on destruction |
| Link maps, preview cache, edge hydration, scope projection | One instance; cleared on destruction |
| Layout initialization, pending reasons, layout object, timeout, resize/collision frames | One instance; suspended on deactivation, cancelled on destruction |
| ResizeObserver, sizing events, appearance and keyboard listeners | One instance; explicit disconnect/removal |
| Local graph selection, inspector, camera | Retained by each graph across tab switches |
| Semantic/geometric zoom | Existing panel zoom-capability infrastructure and renderer adapter |
| MQTT/TD layer adapters | One adapter binding per graph; subscriptions removed on destruction |
| Requests, command queue, dialog focus timer | Instance lifetime signal and guarded continuations |
| Notebook persistence, file selection, appearance cache, MQTT model transport | Intentionally application-wide; closing a graph does not disconnect the shared transport or cancel another graph's work |

The registry in [GraphManagerInstances.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/GraphManagerInstances.mjs) stores instance identities and routes compatibility calls. It does not own graph data or rendering state. IDs are stable for an instance's lifetime.

## Shared command routing

`activeGraphManager()` resolves the visible, non-deactivated graph inside `window.activeCell`. `window.cy` and existing graph command globals use that owner. Activating A targets A; activating B targets B. An editor or other panel has no implicit graph-command target. Closing B unregisters it; A remains usable when its cell/tab is active. The legacy `window.cy` setter remains available for standalone legacy graph implementations when no managed graphs exist.

Two integrations require explicit semantics:

- `window.refreshGraphManager` is a document-wide invalidation. It refreshes the active graph and marks the others dirty for their next activation. It does not rebuild a hidden graph immediately.
- FileView and search can intentionally reveal a path in a navigator while another panel has focus. They pass an explicit instance ID selected from the last visible graph navigator, or the sole eligible visible graph. Ordinary graph commands have no such fallback.

Shared layer controls unbind their previous owner before binding the next. Clipboard handlers, toolbar publication, and navigation-state setters are gated by active ownership. Global file selection remains intentional. Graph link selections include their originating instance ID, while inspector contents and local presentation remain per graph.

## Activation, hiding, and destruction

`activate()` resumes live-layer reconciliation, checks viewport dimensions without fitting the camera, applies deferred appearance changes, and refreshes only if invalidated. Unchanged tab restoration does not rebuild topology or request a new layout. `deactivate()` preserves the renderer and camera, cancels scheduled visible work, removes resource drag bindings, closes owned dialogs, and holds a Cytoscape batch. MQTT snapshots and TD updates are deferred while hidden and reconciled on restoration.

`destroy()` is idempotent. It marks the owner disposed, aborts reads, cancels timers/frames/layouts, disconnects the resize observer, removes document/window handlers and sizing events, cleans live layers and drag/drop adapters, destroys Cytoscape, disposes zoom, clears caches and element references, and unregisters the instance.

An important teardown detail is releasing the held Cytoscape batch **before** `cy.destroy()`. Cytoscape batches the destroy notification too: destroying while still batched can report `destroyed() === true` while retaining renderer DOM observers. The browser regression checks observer counts when closing an inactive tab, not just the destroyed flag. Semantic zoom also avoids restyling a renderer during its destroy notification.

[panelTabs.mjs](../ApplicationSystem/public/panels/panelTabs.mjs) now discards and disposes late mount results if the tab has already closed, and deactivates late results if another tab was selected. This reuses the existing content lifecycle rather than introducing a separate tab lifecycle.

## Async safety

Core reads use an instance AbortController where the API supports it. `alive()` checks disposal after awaited work even when transport ignores cancellation. Initialization, refresh, and directory/scope navigation are serialized per instance so older loads cannot overwrite newer navigation. Graph event callbacks reject work on inactive/disposed owners and handle asynchronous failures. TD has its own lifetime guard and abort signal. Broken-link retargeting checks ownership after reads and saves, and uses the owner's selection publisher.

Generic file callbacks deliberately run outside the graph load queue: they may await `window.refreshGraphManager`, so holding that queue would deadlock the callback against its own refresh. A browser regression exercises this case.

Persistence already submitted to the application may finish after a panel closes; destruction does not roll back notebook edits. Shared cache loads may also complete. Their graph-facing continuations cannot recreate a closed renderer or publish its obsolete selection. No cancellation signal is shared between panel instances.

## Regression coverage

[scripts/graph-viewer-phase1-browser.mjs](../scripts/graph-viewer-phase1-browser.mjs) runs bundled Cytoscape/fCoSE in real Chromium with deterministic notebook and MQTT transport fixtures. It exercises:

- Separate renderers/containers, active command routing, editor context rejection, and surviving-panel routing after close.
- Independent camera, selection, inspector, topology, semantic zoom, and geometric zoom, with intentional shared file selection.
- Unchanged hide/restore without topology reconstruction or relayout; hidden MQTT updates deferred until restoration.
- Actual renderer destruction, disconnected observers, removed subscriptions/listeners, cancelled scheduled work, cleared owner references, and no post-close renders.
- 100 direct mount/close cycles, plus 10 real tab cycles and real tab switch/restore/close of an inactive graph.
- Abort-ignoring delayed style/directory/TD responses, close during tab mount, delayed retarget reads, and a generic file callback awaiting graph refresh.

The test records live ResizeObservers, MutationObservers, window/document listeners, MQTT subscriptions, and owned resource state. Counts must return to their warmed baseline after every cycle. Heap size alone is not used as evidence of leak elimination. Transport, toolbar rendering, and the editor switch guard are fixture substitutes; the real graph adapters, tab lifecycle, context routing, and zoom implementations run.

Node regression checks cover semantic zoom, scope projection, and panel lifecycle, including a delayed mount closed before completion. Production source contains no new benchmark probes: the test HTTP server injects instrumentation in memory.

The final lifecycle run passed all nine check groups with no unhandled rejections. After every one of the 100 cycles, live resource counts returned to the warmed baseline: 0 ResizeObservers, 0 MutationObservers, 2 shared window/document listeners, and 0 MQTT graph subscriptions. The additional real-tab cycles also returned to this baseline. Explicit cross-panel navigation, shared layer-control ownership, and hidden document invalidation passed alongside the checks listed above. All three Node test files passed, as did JavaScript syntax, Python parsing, and `git diff --check`.

The existing semantic-zoom Chromium suite also passed production mounting, geometry/camera/selection invariants, toolbar/gesture behavior, isolation, and cleanup. Its 1,000- and 10,000-node fixtures at both edge densities reported zero layout, selection, or data changes during semantic transitions.

## Performance comparison

The original fixture sizes and operations are preserved. Before/after runs use the same Chromium runner and scripts, sequentially. `--source-revision` serves tracked application source from commit `7c853018522e8dc59653a71289c9910d2a502a1a` without changing the checkout. The original baseline is retained separately. Measurements are local headless-browser samples, not production latency guarantees; paint-opportunity timing is not GPU completion timing.

Raw results: [before](benchmarks/graph-viewer-phase1-before.json), [after](benchmarks/graph-viewer-phase1-after.json), [seeded before](benchmarks/graph-viewer-phase1-layout-before.json), [seeded after](benchmarks/graph-viewer-phase1-layout-after.json), and [lifecycle](benchmarks/graph-viewer-phase1-lifecycle.json). Chromium 148, device pixel ratio 2. The following handler values average the two benchmark repetitions; they exclude the subsequent paint opportunity.

| Nodes | Operation | Before (ms) | After (ms) |
|---:|---|---:|---:|
| 1,000 | pan | 0.05 | 0.05 |
| 1,000 | zoom | 0.08 | 0.07 |
| 1,000 | select-node | 155.57 | 73.24 |
| 1,000 | rebuild-edges | 568.38 | 342.12 |
| 1,000 | initial-layout | 731.30 | 362.75 |
| 1,000 | proof-layout | 555.30 | 236.10 |
| 5,000 | pan | 0.06 | 0.05 |
| 5,000 | zoom | 0.08 | 0.05 |
| 5,000 | select-node | 693.46 | 329.35 |
| 5,000 | rebuild-edges | 2,622.53 | 1,899.90 |
| 5,000 | initial-layout | 2,340.35 | 1,363.70 |
| 5,000 | proof-layout | 1,387.40 | 667.85 |

Production opening below includes loading the compound fixture, layout, and the next paint opportunity. Each size is one sample, with identical node/edge counts between revisions.

| Files | Before (ms) | After (ms) |
|---:|---:|---:|
| 10 | 101.3 | 101.5 |
| 100 | 629.4 | 312.6 |
| 1,000 | 16,143.8 | 3,349.0 |
| 5,000 | 192,592.8 | 11,526.8 |

The large opening improvement includes correcting leaked layout-initialization state: the old singleton carried `layoutHasInitialized` into subsequent panels, causing their first layouts to use proof quality. Each new instance now starts with its own initial layout state. No fCoSE options or algorithm were tuned. Per-instance external-node loading adds one fixture request (8 versus 7); this restores independent state rather than sharing a previous panel’s loaded flag.

The broad timing improvements are observations, not evidence that selection or edge algorithms became faster. Runtime, accumulated renderer work, and unseeded layout geometry affect these samples. An earlier exploratory after-run had slower proof-layout results, so a separate paired control runs identical topology/styles with three fixed seeds per size. All twelve position checksums match exactly and all layout quality/randomization options match.

| Nodes | Seeded layout | Before mean (ms) | After mean (ms) | Change |
|---:|---|---:|---:|---:|
| 1,000 | initial | 363.00 | 384.07 | +5.8% |
| 1,000 | proof | 188.30 | 186.17 | -1.1% |
| 5,000 | initial | 1,257.00 | 1,243.23 | -1.1% |
| 5,000 | proof | 558.77 | 600.63 | +7.5% |

The controlled differences range from −1.1% to +7.5%, without changed geometry or options; these limited samples do not establish a systematic layout regression. Layout remains expensive.

Renderer wheel-input frame means (60 synthetic inputs) remain useful context beyond the very small API handler timings:

| Nodes | Before mean frame (ms) | After mean frame (ms) |
|---:|---:|---:|
| 1,000 | 27.52 | 21.11 |
| 5,000 | 96.67 | 46.38 |

Lifecycle results are less sensitive to machine timing:

| Check | Before | After |
|---|---|---|
| Opening B destroys A | Yes | No |
| B owns B’s container | No | Yes |
| Renders after destroy + resize | 2 per fixture/repetition | 0 at every size/repetition |
| Direct CSS-hidden data mutation | 2 renders | 1 render |
| Lifecycle-hidden MQTT snapshot | Not covered by original harness | 0 renders while hidden; reconciled on restore |

The legacy hidden-update benchmark directly hides DOM and mutates Cytoscape without deactivation. Its remaining one render is not the supported tab-suspension path. The lifecycle suite invokes real hooks and separately verifies deferred MQTT and document invalidation. The direct hidden-update handler at 5,000 nodes rose from 3.95 to 4.65 ms in these samples; this sub-millisecond difference accompanies fewer renders and does not demonstrate increased hidden lifecycle work.

## Remaining costs and risks

Selection still visits graph elements and synchronizes presentation globally within that graph. Edge refresh still reconstructs visible edges. fCoSE still executes synchronously, and large compound graphs can block the main thread. Pointer hit testing and renderer styling/labels remain unchanged. Independent panels also intentionally keep independent graph caches, so opening a second panel may repeat reads that the old singleton accidentally shared.

A hidden graph retains its data, renderer, and required shared-model subscription. It is not a zero-memory cache. Lifecycle deactivation is the supported suspension boundary; hiding a DOM element without invoking panel lifecycle is not equivalent. Live broker/network reconnection and full application toolbar rendering still warrant an end-to-end smoke test against a running backend. The bounded resource tests establish cleanup of the measured owners, not a universal heap-retention proof.

Phase 2 should address measured selection and edge-reconstruction costs, then layout scheduling/quality tradeoffs and hit testing as proposed in the investigation. Those optimizations are deliberately outside this change.

## Reproduction

Run from the repository root with Node, Python, and the browser runner's Chromium installation available:

```sh
python3 scripts/test-graph-viewer-performance.py docs/benchmarks/graph-viewer-phase1-lifecycle.json --lifecycle
python3 scripts/test-graph-viewer-performance.py docs/benchmarks/graph-viewer-phase1-before.json --source-revision=7c853018522e8dc59653a71289c9910d2a502a1a
python3 scripts/test-graph-viewer-performance.py docs/benchmarks/graph-viewer-phase1-after.json
python3 scripts/test-graph-viewer-performance.py docs/benchmarks/graph-viewer-phase1-layout-before.json --layout-control --source-revision=7c853018522e8dc59653a71289c9910d2a502a1a
python3 scripts/test-graph-viewer-performance.py docs/benchmarks/graph-viewer-phase1-layout-after.json --layout-control
node --test ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/GraphSemanticZoom.test.mjs scripts/graph-scope-projection-probe.test.mjs
node --experimental-loader ./ApplicationSystem/public/panels/panelRootImportTestLoader.mjs --test ApplicationSystem/public/panels/panelTabsLifecycle.test.mjs
python3 scripts/test-graph-semantic-zoom-browser.py
```

Run performance suites sequentially to avoid CPU contention. The server binds only to loopback. Output paths ending in `.json` contain raw JSON; older text output and the investigation's summarizer remain supported.
