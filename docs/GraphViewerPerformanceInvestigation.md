# Graph Viewer performance investigation

## 1. Executive Summary

Investigation baseline: commit `7c853018522e8dc59653a71289c9910d2a502a1a`, 2026-10-28. This change adds development benchmark scripts and this report, not production optimizations.

**Scope matters:** the workspace calls `GraphManager` “Graph View” (`panels/panelTabMetadata.mjs`). This is the interactive notebook graph investigated here. The `.graphml` route in `PanelInstances/ModuleMap.csv` uses `ViewGraph.mjs`, which delegates to `ViewText.mjs`; it does not parse GraphML into Cytoscape. Legacy `SwitchToGraphView.js`, `Graph.js`, and `GraphManagement/Graph.js` are separate implementations and were not substituted for the current panel. There is no measured “open GraphML into an interactive graph” operation in this implementation.

The measurements below exercise real browser execution of the current Graph Manager and bundled Cytoscape/fCoSE, with synthetic notebook responses. They distinguish camera rendering, synchronous layout, full edge reconstruction, selection propagation, and lifecycle behavior. Full application toolbar and editor-selection work is explicitly outside the isolated timing totals.

At 5,000 nodes, selection takes about **750 ms**, unchanged edge reconstruction **2.6–3.0 seconds**, and hover hit testing **101 ms/call**. Large compound-directory opening is much worse: **250 seconds** in the production-load fixture. Camera movement does not rerun graph layout or rebuild toolbars in the measurements; rendering and hit testing are independent sources of lag. The panel destroy hook leaves a working renderer/observer behind, and a second graph panel mounts into the first panel’s container. These results support incremental fixes to ownership, selection, edge reconciliation, layout and rendering—not a rewrite.

## 2. Architecture

Paths below are relative to `ApplicationSystem/public/` unless otherwise stated.

| User action | Execution path and integration |
|---|---|
| Open graph view | `panels/panelTabs.mjs` mounts `PanelInstances/InfoPanels/GraphManager.mjs::setupPanel`; creates surface, `#cy`, link/MQTT inspectors; dynamically imports `GraphManagerCore.mjs::initGraphView`. Registers focus/click toolbar handlers. |
| Load/construct notebook graph | `initGraphView` loads edge styles, installs semantic/geometric zoom and resource/external-file drag adapters, subscribes MQTT/TD layers, loads external nodes, fetches directory entries through `FileManagerAPI.mjs`. `renderGraphData` loads directory appearances, hydrates persisted target/source edge buckets, creates compound directory/file nodes in a batch, scans supported text files for links, fetches HTML previews, rebuilds visible edges. This is a filesystem/link graph, not a standalone graph document parser. |
| First render/layout | Cytoscape starts with `preset`; `queueRelayout` coalesces reasons for 60 ms. `runRelayout` resizes, stops an active layout, constructs fCoSE, runs synchronously with animation disabled; first layout uses default/random placement, subsequent layouts use proof quality with 1,600 iterations and label dimensions. `layoutstop` may fit again. Renderer canvases draw on browser frames. |
| Pan | Native Cytoscape mouse/touch camera changes. No application graph reconstruction is required. Renderer redraw/hit testing is distinct from graph layout. |
| Zoom | Ordinary wheel uses Cytoscape. Shared modified gestures route through `panels/panelZoomPan.mjs`, `panelZoomCapabilities.mjs`, `GraphGeometricZoom.mjs`. Camera zoom changes do not need fCoSE. `GraphSemanticZoom.mjs` changes edge annotation opacity/classes in a batch, preserving label metrics and geometry; it is a separate operation from geometric zoom. |
| Select node | Core `tap node` → `selectSingleGraphNodeFile` → `publishGraphSelectedFileEntries` (global state, toolbar request, `nodevision-file-selection-set-changed`) → `applyGraphSelectedFileEntries` (visits all nodes) → `requestNodevisionFileSelection` (editor switch guard and other application consumers). Ctrl/Meta selection takes the toggle path. Panel DOM focus/click independently calls `updateToolbarState`. |
| Select edge/background | Edge tap clears selected-link classes across edges, creates shared selected-link record and inspector HTML. `LinkRecords.mjs` publishes `nodevision-graph-link-selected`; `FileViewParts/ShowGraphLinkInFileView.mjs` can replace the FileView with source/destination previews. Background clears node/link state. These are intentional cross-panel integrations, whose downstream browser/network cost is not included in the stubbed fixture. |
| Hover/drag | Cytoscape canvas hit testing owns ordinary hover. No general Core hover handler rebuilds the toolbar. Resource drag is installed separately. Ctrl-drag and link retargeting scan candidate nodes and bounding boxes; directory drag schedules collision resolution on rAF. Those specialized drag algorithms are not equivalent to blank-space panning. |
| Data change | Explicit refresh resets scope/link caches, removes non-live elements, reloads directories, rebuilds and queues layout. Directory expansion scans links and queues layout. `rebuildVisibleEdges` removes all non-MQTT/TD edges and placeholders, then recreates the projected set. A direct label data change can redraw without either operation. MQTT snapshot rendering reconciles live elements but calls `queueRelayout` on each render. |
| Resize | Core observes container, surface and panel content. Callback → `scheduleGraphViewportResize` (one rAF) → `applyGraphViewportSize` (CSS assignments and `cy.resize`) → optional `cy.fit`. Shared bounds/zoom events use the same scheduler. Reads of dimensions and writes to sizing are potential browser-layout costs, not fCoSE runs. |
| Switch/restore/close | `panelTabs.mjs` retains mounted content, sets hidden and display state, calls optional lifecycle hooks. Graph Manager returns only `destroy`, no deactivate/activate hooks. That destroy removes focus/click listeners and semantic zoom; it does not destroy the renderer, disconnect its ResizeObserver, stop queued graph layout, or unsubscribe the live layers. New initialization clears some previous singleton subscriptions, not all previous instances. |

Core stores `cy`, root, caches, layout timers, and layers at module scope, and exposes `window.cy`, `window.refreshGraphManager`, and an action handler globally. `setupPanel` uses duplicate fixed IDs and Core resolves them with `document.getElementById`, not from its supplied panel root. These ownership decisions are relevant to concurrent/retained tabs, not simply an algorithmic performance issue.

Existing bounded work: directory node insertion and edge rebuild use batches; layout requests have a 60 ms debounce; viewport sizing has a rAF guard; edge bucket hydration is targeted and cached; link scans/existence checks have render-local caches; clipboard and directory-appearance global listeners have singleton guards. None of these should be discarded in an optimization.

## 3. Benchmark Results

### Reproduce

```sh
python3 scripts/test-graph-viewer-performance.py /tmp/graph-viewer-performance.txt
python3 scripts/summarize-graph-viewer-performance.py /tmp/graph-viewer-performance.txt docs/benchmarks/graph-viewer-baseline.json
```

Requires existing Node, Python 3, and `chromium`. No packages are installed. The Python server binds only loopback, serves repository modules, substitutes synthetic API responses, and instruments Core in memory. It uses the existing `scripts/run-browser-regression.mjs` CDP runner with real clocks. No production file, format, persistence path, or notebook content is changed. The server exits after the browser. Run without concurrent benchmarks; allow up to 15 minutes for the largest cases.

Environment: Chromium 148.0.7778.178, Linux x86-64, Intel i3-1315U environment reporting eight CPUs, headless, GPU disabled, device scale factor 2. This is a software-rendered baseline, not a hardware-accelerated desktop FPS guarantee.

Fixtures: deterministic grid positions, labeled file nodes, directed ring links plus second-neighbor links; exactly 10/10, 100/200, 1,000/2,000, 5,000/10,000 nodes/edges. Two sequential sweeps exercise the full matrix. Production-open checks additionally include a compound Root node and real directory/edge hydration logic with immediate synthetic responses. fCoSE first-placement randomness remains enabled as in production, so topology is deterministic but final placement/timing is not bitwise deterministic.

### Metric definitions and limits

- `handler`: synchronous operation duration (including local microtask completion). `paintOpportunity`: operation through two rAF callbacks, a browser presentation opportunity, **not confirmed screen presentation or physical input latency**.
- `frame`: observed rAF callback intervals during that operation, including expensive main-thread stalls. The first interval starts at measurement entry, so it can be partial; longest frame and p95 must be interpreted with sample count. An operation with one sample has no robust operation percentile. Idle's handler intentionally includes a one-second wait, not one second of CPU.
- `events`: Cytoscape render/layout/camera/selection/data/position/style/add/remove/input events; these count notifications, not every internal listener invocation. `domMutations` counts MutationObserver records, not canvas draw calls or graphical updates. Add/remove/style/position events separately describe graphical work.
- Function timings are inclusive and may nest; do not add them as exclusive CPU totals. Direct probe calls are timed by the operation timer even where the exported reference bypasses a Core wrapper.
- Core wrappers, event counters, MutationObserver, `performance.mark/measure`, long-task observer and rAF sampling exist only in this harness. A disabled-recording pan control retains wrapper/timer/event observer overhead; it is not a fully uninstrumented control. A separate renderer probe bypasses its renderer wrappers in its control.
- Heap values are Chromium `performance.memory` observations without forced GC and may be quantized. They cannot establish retained-byte growth or a leak rate. We test live renderer/observer behavior directly instead. CPU utilization, GPU duration, precise style/layout/paint breakdown, physical input latency, full global callback count, and post-GC retained-object counts are unavailable in this run.
- Primary camera/selection inputs use Cytoscape APIs/emitted taps. Separate hover/drag/wheel checks dispatch synthetic DOM mouse/wheel events through the actual canvas handlers; these are real browser computations but not trusted OS/CDP input. The renderer probe uses preset grid geometry to isolate hit-testing/render cost from fCoSE.
- Toolbar and editor-switch exports are counted stubs. No claim about actual toolbar rebuild duration, full editor/FileView fan-out, a live MQTT feed, minimized OS windows, or mixed SVG/HTML workspace end-to-end latency follows from these numbers. Hidden means CSS `display:none` plus `hidden`, matching retained-tab visibility, not merely a covered window.

### Opening and parsing

Production opening includes one compound Root node, immediate synthetic transport, and layout completion plus two paint opportunities. Each row is one observation. Initialization state is retained across production mounts, as it is in the application; these are reopening tests, not separate cold processes.

| Files / edges | Setup return ms | Through layout/paint opportunity ms | Requests | Render events after setup |
|---|---:|---:|---:|---:|
| 10 / 10 | 49.3 | 104.5 | 7 | 2 |
| 100 / 200 | 192.5 | 675.5 | 7 | 3 |
| 1000 / 2000 | 1871.5 | 15039.7 | 7 | 3 |
| 5000 / 10000 | 9437.2 | 250450.8 | 7 | 3 |

At 5,000 files, the browser recorded a **230,069 ms long task** during the production-opening interval; total opening was **250,450.8 ms**. The full run recorded 608 long tasks. Transport is mocked, so this is not disk/network wait. The original large-case record does not provide an exclusive layout-vs-render breakdown of that task; the follow-up isolation below times Core layout directly at smaller scales.

### Follow-up: production layout isolation

Run `python3 scripts/test-graph-viewer-performance.py /tmp/graph-viewer-open.txt --open-only` for a short independent process measuring wrapper durations on actual compound-directory opening. Raw results: [`benchmarks/graph-viewer-open-isolation.json`](benchmarks/graph-viewer-open-isolation.json).

| Files | Setup ms | Total to layout/paint opportunity ms | `runRelayout` ms / calls | `rebuildVisibleEdges` ms / calls | Layout queue requests |
|---|---:|---:|---:|---:|---:|
| 10 | 236.4 | 441.9 | 58.3 / 1 | 90.1 / 1 | 9 |
| 100 | 278.4 | 861.5 | 220.6 / 1 | 128.2 / 1 | 7 |
| 1000 | 1885.4 | 14885.9 | 11009.0 / 1 | 800.0 / 1 | 7 |

At 1,000 files, **11,009 ms** is inside the synchronous production `runRelayout` call, versus **800 ms** rebuilding edges and **14,885.9 ms** total. Seven queue requests coalesce into **one** layout, so duplicate queue calls are not seven layout runs. The compound opening repeats the original 15.04-second observation closely. This confirms layout as the principal CPU bottleneck for this opening workload at 1,000 files. The 5,000-file 230-second long task remains a strong layout hypothesis without an exclusive same-size function trace; do not label its full duration as a measured fCoSE-only time.

### Complete operation matrix (first sweep)

The separate parse row measures JSON parsing of the synthetic fixture, not GraphML or server-side parsing. Construction adds file nodes and rebuilds their persisted-link projection using production code/style. Main matrix geometry is flat, whereas production-open uses a compound directory; these workloads must not be conflated. Renders include work that can settle from the prior operation.

| Nodes / edges | Operation | Handler mean / max ms | Frame mean / p95 / max ms | Paint opportunity mean ms | Renders | Toolbar |
|---|---|---:|---:|---:|---:|---:|
| 10 / 10 | parse | 0.17 / 0.20 | 16.05 / 16.70 / 16.70 | 32.40 | 1 | 0 |
| 10 / 10 | construct | 25.70 / 25.70 | 40.30 / 66.70 / 66.70 | 86.70 | 1 | 0 |
| 10 / 10 | initial-layout | 39.30 / 39.30 | 21.50 / 26.30 / 26.30 | 59.00 | 1 | 0 |
| 10 / 10 | pan | 0.15 / 0.30 | 15.97 / 16.70 / 16.80 | 32.07 | 13 | 0 |
| 10 / 10 | zoom | 0.23 / 1.00 | 16.56 / 16.70 / 16.80 | 33.23 | 12 | 0 |
| 10 / 10 | select-node | 3.62 / 8.60 | 16.58 / 16.80 / 16.80 | 33.28 | 12 | 12 |
| 10 / 10 | hover | 0.68 / 2.90 | 16.64 / 16.70 / 16.80 | 33.30 | 0 | 0 |
| 10 / 10 | modify-label | 0.19 / 0.70 | 16.56 / 16.70 / 16.80 | 33.19 | 12 | 0 |
| 10 / 10 | rebuild-edges | 6.60 / 7.70 | 16.43 / 16.70 / 16.70 | 33.37 | 3 | 0 |
| 10 / 10 | proof-layout | 9.60 / 9.60 | 15.60 / 16.50 / 16.50 | 33.20 | 1 | 0 |
| 10 / 10 | resize | 0.10 / 0.20 | 16.57 / 16.80 / 16.80 | 33.66 | 13 | 0 |
| 10 / 10 | tab-hide-restore | 0.16 / 0.30 | 16.37 / 16.70 / 16.70 | 33.33 | 12 | 0 |
| 10 / 10 | idle | 1000.50 / 1000.50 | 16.54 / 16.80 / 16.80 | 1026.80 | 1 | 0 |
| 10 / 10 | hidden-update | 0.50 / 0.50 | 15.60 / 16.70 / 16.70 | 31.80 | 2 | 0 |
| 10 / 10 | hidden-idle | 1000.30 / 1000.30 | 16.64 / 16.70 / 16.80 | 1032.50 | 1 | 0 |
| 10 / 10 | pan-instrumentation-disabled | 0.12 / 0.30 | 16.60 / 16.70 / 16.80 | 33.26 | 13 | 0 |
| 10 / 10 | after-destroy-resize | 0.20 / 0.20 | 11.85 / 16.70 / 16.70 | 32.90 | 2 | 0 |
| 100 / 200 | parse | 0.70 / 0.90 | 13.98 / 16.80 / 16.80 | 28.27 | 0 | 0 |
| 100 / 200 | construct | 183.70 / 183.70 | 132.45 / 181.50 / 181.50 | 284.50 | 1 | 0 |
| 100 / 200 | initial-layout | 99.40 / 99.40 | 73.30 / 96.50 / 96.50 | 162.90 | 1 | 0 |
| 100 / 200 | pan | 0.07 / 0.10 | 15.97 / 16.70 / 16.80 | 32.03 | 13 | 0 |
| 100 / 200 | zoom | 0.09 / 0.20 | 16.58 / 16.70 / 16.70 | 33.23 | 12 | 0 |
| 100 / 200 | select-node | 18.26 / 24.60 | 18.00 / 33.40 / 33.50 | 36.43 | 12 | 12 |
| 100 / 200 | hover | 2.59 / 6.10 | 16.61 / 16.80 / 16.80 | 33.24 | 0 | 0 |
| 100 / 200 | modify-label | 0.16 / 0.40 | 16.58 / 16.70 / 16.70 | 33.41 | 12 | 0 |
| 100 / 200 | rebuild-edges | 83.07 / 98.50 | 71.60 / 100.00 / 100.00 | 151.17 | 3 | 0 |
| 100 / 200 | proof-layout | 27.80 / 27.80 | 29.35 / 33.30 / 33.30 | 73.20 | 1 | 0 |
| 100 / 200 | resize | 0.13 / 0.50 | 20.21 / 33.40 / 66.60 | 41.02 | 13 | 0 |
| 100 / 200 | tab-hide-restore | 0.11 / 0.20 | 16.35 / 16.70 / 16.80 | 33.36 | 12 | 0 |
| 100 / 200 | idle | 1000.30 / 1000.30 | 16.53 / 16.70 / 16.80 | 1025.20 | 1 | 0 |
| 100 / 200 | hidden-update | 0.20 / 0.20 | 16.05 / 16.70 / 16.70 | 38.60 | 2 | 0 |
| 100 / 200 | hidden-idle | 1000.20 / 1000.20 | 16.55 / 16.70 / 16.80 | 1027.10 | 1 | 0 |
| 100 / 200 | pan-instrumentation-disabled | 0.06 / 0.10 | 16.60 / 16.80 / 16.80 | 33.27 | 13 | 0 |
| 100 / 200 | after-destroy-resize | 0.20 / 0.20 | 43.20 / 83.30 / 83.30 | 108.00 | 2 | 0 |
| 1000 / 2000 | parse | 4.33 / 4.70 | 14.58 / 16.70 / 16.70 | 29.57 | 0 | 0 |
| 1000 / 2000 | construct | 1136.40 / 1136.40 | 798.90 / 1131.10 / 1131.10 | 1653.00 | 1 | 0 |
| 1000 / 2000 | initial-layout | 777.20 / 777.20 | 647.00 / 777.30 / 777.30 | 1299.20 | 1 | 0 |
| 1000 / 2000 | pan | 0.04 / 0.10 | 46.98 / 166.60 / 200.00 | 94.06 | 15 | 0 |
| 1000 / 2000 | zoom | 0.11 / 0.20 | 16.59 / 16.70 / 16.70 | 33.24 | 12 | 0 |
| 1000 / 2000 | select-node | 115.96 / 152.90 | 99.23 / 133.40 / 149.90 | 198.70 | 12 | 12 |
| 1000 / 2000 | hover | 14.07 / 26.50 | 16.91 / 16.80 / 33.40 | 33.85 | 0 | 0 |
| 1000 / 2000 | modify-label | 0.59 / 1.40 | 43.66 / 83.30 / 83.40 | 88.57 | 12 | 0 |
| 1000 / 2000 | rebuild-edges | 527.30 / 641.80 | 541.78 / 683.30 / 683.30 | 1098.03 | 3 | 0 |
| 1000 / 2000 | proof-layout | 456.10 / 456.10 | 311.35 / 456.10 / 456.10 | 679.40 | 1 | 0 |
| 1000 / 2000 | resize | 0.09 / 0.30 | 57.33 / 149.90 / 150.00 | 115.27 | 15 | 0 |
| 1000 / 2000 | tab-hide-restore | 0.13 / 0.20 | 16.35 / 16.70 / 16.80 | 33.35 | 12 | 0 |
| 1000 / 2000 | idle | 1000.30 / 1000.30 | 16.53 / 16.70 / 16.80 | 1025.50 | 1 | 0 |
| 1000 / 2000 | hidden-update | 1.30 / 1.30 | 74.30 / 133.30 / 133.30 | 171.30 | 2 | 0 |
| 1000 / 2000 | hidden-idle | 1000.40 / 1000.40 | 16.30 / 16.80 / 16.80 | 1028.10 | 0 | 0 |
| 1000 / 2000 | pan-instrumentation-disabled | 0.07 / 0.20 | 47.83 / 133.30 / 149.90 | 95.74 | 16 | 0 |
| 1000 / 2000 | after-destroy-resize | 0.20 / 0.20 | 279.45 / 566.70 / 566.70 | 751.60 | 2 | 0 |
| 5000 / 10000 | parse | 13.23 / 14.70 | 13.85 / 16.70 / 16.70 | 28.23 | 0 | 0 |
| 5000 / 10000 | construct | 5482.10 / 5482.10 | 3756.85 / 5497.20 / 5497.20 | 7815.40 | 1 | 0 |
| 5000 / 10000 | initial-layout | 2504.00 / 2504.00 | 2431.80 / 2497.10 / 2497.10 | 4876.40 | 1 | 0 |
| 5000 / 10000 | pan | 0.06 / 0.20 | 202.22 / 550.00 / 866.70 | 404.51 | 14 | 0 |
| 5000 / 10000 | zoom | 0.09 / 0.20 | 16.60 / 16.70 / 16.70 | 33.25 | 12 | 0 |
| 5000 / 10000 | select-node | 750.26 / 1039.80 | 545.74 / 914.90 / 1050.00 | 1092.13 | 12 | 12 |
| 5000 / 10000 | hover | 72.90 / 189.00 | 46.02 / 116.70 / 199.90 | 92.05 | 0 | 0 |
| 5000 / 10000 | modify-label | 2.68 / 4.70 | 156.17 / 333.30 / 349.90 | 312.89 | 12 | 0 |
| 5000 / 10000 | rebuild-edges | 2980.03 / 3659.70 | 2870.90 / 3933.20 / 3933.20 | 5832.47 | 3 | 0 |
| 5000 / 10000 | proof-layout | 1265.10 / 1265.10 | 1288.60 / 1316.70 / 1316.70 | 2896.80 | 1 | 0 |
| 5000 / 10000 | resize | 0.08 / 0.10 | 251.24 / 700.00 / 750.00 | 503.17 | 14 | 0 |
| 5000 / 10000 | tab-hide-restore | 0.12 / 0.20 | 19.76 / 33.40 / 33.50 | 41.23 | 12 | 0 |
| 5000 / 10000 | idle | 1000.30 / 1000.30 | 16.60 / 16.70 / 16.80 | 1030.20 | 1 | 0 |
| 5000 / 10000 | hidden-update | 4.10 / 4.10 | 257.40 / 499.90 / 499.90 | 570.90 | 2 | 0 |
| 5000 / 10000 | hidden-idle | 1000.50 / 1000.50 | 16.29 / 16.70 / 16.80 | 1027.60 | 0 | 0 |
| 5000 / 10000 | pan-instrumentation-disabled | 0.08 / 0.20 | 281.86 / 566.70 / 683.30 | 563.78 | 17 | 0 |
| 5000 / 10000 | after-destroy-resize | 0.20 / 0.20 | 1587.10 / 3183.20 / 3183.20 | 3959.30 | 2 | 0 |

### Repeat check

| Nodes | Select mean ms: sweep 1 / 2 | Rebuild mean ms: 1 / 2 | Pan frame mean ms: 1 / 2 | Initial layout ms: 1 / 2 |
|---|---:|---:|---:|---:|
| 10 | 3.62 / 2.96 | 6.60 / 4.37 | 15.97 / 16.58 | 39.30 / 9.90 |
| 100 | 18.26 / 15.41 | 83.07 / 73.37 | 15.97 / 16.37 | 99.40 / 66.00 |
| 1000 | 115.96 / 139.51 | 527.30 / 531.03 | 46.98 / 45.89 | 777.20 / 733.50 |
| 5000 | 750.26 / 752.08 | 2980.03 / 2603.70 | 202.22 / 218.95 | 2504.00 / 2541.30 |

Large-graph trends reproduce across both sweeps. Small cases show JIT/warm-cache differences; construction at 10 nodes changes from 25.7 to 10.8 ms, so single-run sub-millisecond distinctions are not meaningful.

### Renderer and hover isolation

60 synthetic mousemove inputs are paced by rAF, so a slow graph stretches the intended approximately one-second burst. Of those 60 events, 55 invoke `findNearestElements` in this trajectory. The complete burst has zero graph render events and zero toolbar requests.

| Nodes | Hit tests | Hit-test mean / max ms | Total hit-test ms | Burst elapsed ms | Frame mean / p95 ms | Approx. observed callback Hz |
|---|---:|---:|---:|---:|---:|---:|
| 10 | 55 | 0.38 / 1.00 | 21.0 | 1030.7 | 16.62 / 17.00 | 60.2 |
| 100 | 55 | 3.03 / 5.00 | 166.9 | 1026.9 | 16.55 / 17.10 | 60.4 |
| 1000 | 55 | 19.22 / 44.00 | 1057.0 | 1273.0 | 20.66 / 27.30 | 48.4 |
| 5000 | 55 | 101.38 / 139.80 | 5575.9 | 5727.9 | 94.91 / 123.60 | 10.5 |

At 5,000 nodes, hit testing consumes 5,575.9 ms of a 5,727.9 ms burst: **97.3%**. This is CPU work with no repaint or toolbar request, independently identifying a hover bottleneck. Disabling renderer probe recording gives a 5,816.0 ms burst and 96.38 ms mean frame, versus 5,727.9 ms and 94.91 ms with recording: instrumentation does not explain the observed order-of-magnitude slowdown, though this sequential control cannot precisely quantify its overhead.

60 real canvas-handler synthetic wheel events produce 60 render events. At 5,000 nodes `renderer.render` averages **47.16 ms**, maximum **451.90 ms**, cumulative **2,829.8 ms**; callback intervals average 68.33 ms with p95 398.10 ms. By contrast, the main API-zoom sequence benefits from a different camera/cache history and averages a 16.60 ms frame. Zoom performance is state-dependent; neither number alone represents all wheel gestures.

**Invalid/limited controls:** the `renderer-drag-pan` synthetic sequence produced no renders or renderer callbacks; it did not successfully exercise a drag and is not accepted as a native-pan measurement. Main API pan measurements remain valid. The labels-hidden pan experiment lacks an otherwise identical labels-visible API-pan control in the same preset fixture, so it cannot establish a causal label-removal speedup and is not used to recommend hiding labels. Trusted-input and paired rendering controls remain follow-up work.

### Events, hidden state, cleanup and multiple panels

- Every 12-tap sequence produces 12 selects, 11 unselects, 23 style notifications, 12 renders, 12 toolbar requests and 12 editor-switch requests. At 5,000 nodes, `applyGraphSelectedFileEntries` itself averages **747.14 ms**, maximum **1,036.90 ms**, versus 750.26 ms for the whole tap. Only changed selection notifications fire, but visiting and attempting unselect on every unchanged node still costs time.
- Three unchanged 10,000-edge rebuilds produce **30,000 removes, 30,000 adds, 75,000 style events and three renders**, with no panel DOM mutation records. This is graphical-object reconstruction, not DOM reconstruction or simply paint.
- Pan, API zoom and hover record **zero toolbar calls and zero layout events** in the matrix. Node selection requests toolbar work once per emitted graph tap; a real DOM click/focus can additionally invoke panel focus handling. Its combined full-workspace cost is not measured here.
- Idle windows have zero or one render event (settling), with no repeated graph layout or toolbar calls. No persistent idle-render storm is observed. The sampling rAF itself runs during idle; that is instrumentation activity, not evidence of application CPU consumption.
- A hidden label update records one data/style change, two renders, one viewport resize application and 16 DOM mutation records; the 5,000-node paint-opportunity proxy is **570.9 ms**. The following hidden idle window has zero renders at 1,000/5,000 nodes. Hidden work is triggered by updates/visibility changes, not a demonstrated continuous loop.
- All eight destroy checks leave `cy.destroyed() === false` and the resize observer property present. Resizing afterward triggers one scheduled/applied viewport resize, one pan, one zoom and two renders. The 5,000-node post-destroy window lasts **3,959.3 ms** including pending semantic cleanup/style work and repaint; it is not an exclusive resize cost. This proves the observer/renderer still act after the lifecycle hook.
- In the two-panel check, instances differ but the first is destroyed when Cytoscape is initialized again on the **first panel’s same container**. The second instance does **not** own the second panel’s host. Thus this implementation does not support two independent graph panels reliably; do not interpret the test as measuring two functioning viewer costs.

Raw operation/function/event/DOM/heap/long-task data for both sweeps and probes: [`benchmarks/graph-viewer-baseline.json`](benchmarks/graph-viewer-baseline.json). No post-GC heap or long-session leak-rate claim is made.


## 4. Bottleneck Ranking

Rank by workflow rather than adding overlapping timing totals:

| Priority / affected workflow | Responsible source and function | Measured evidence | Frequency, necessity, scaling and causality |
|---|---|---|---|
| 1 — opening large compound directories | `GraphManagerCore.mjs::renderGraphData`, `queueRelayout`, `runRelayout`; bundled fCoSE | 1,000-file production opening 15.04 s; 5,000-file opening 250.45 s, including a 230.07 s main-thread long task | On open/refresh/expansion/live-layer layout requests. Layout is needed for topology changes, but quality/scheduling and compound geometry make this workload vastly more costly than the flat fixture. Main-thread layout confirmed at 1,000 files: 11.009 s inside one `runRelayout`. Large-case exclusive attribution requires more tracing. |
| 2 — node selection | `GraphManagerCore.mjs::applyGraphSelectedFileEntries` | Mean 2.42 / 17.37 / 114.77 / 747.14 ms at 10 / 100 / 1,000 / 5,000 nodes; worst 1,036.9 ms | Once per emitted node tap; full-node traversal repeats despite only two state transitions. Independent of toolbar/editor work, which is stubbed. Synchronous and graph-size dependent. |
| 3 — data refresh/rebuild | `GraphManagerCore.mjs::rebuildVisibleEdges` | 5,000/10,000: unchanged rebuild 2,980.03 ms mean, 3,659.7 ms max; second sweep 2,603.70 ms mean | Three controlled rebuilds recreate 30,000 edges. Executes on refresh/link discovery/scope paths, not pan. Projection needed, unchanged replacement redundant. Synchronous CPU and subsequent render-cache cost. |
| 4 — hover | bundled `vendor/cytoscape/cytoscape.min.js::findNearestElements` | 5,000 nodes: 101.38 ms mean, 139.8 ms max; 97.3% of hover burst in hit tests | 55 calls / 60 dispatched events; no graph renders or toolbar updates. Independent hit-testing bottleneck scaling with graph size. Cannot be cured solely by suppressing toolbar updates. |
| 5 — camera and redraw | Cytoscape renderer `render`, `drawCachedElements`; Core viewport sizing/fit | 5,000-node API-pan mean frame 202.22 / 218.95 ms across sweeps; wheel render 47.16 ms mean, 451.90 ms max | Camera commands themselves under 0.1 ms mean; cost appears in subsequent main-thread drawing. No graph layout/reconstruction on these inputs. Cache, geometry and gesture history affect cost. |
| Correctness prerequisite — retained/closed/multiple panels | `GraphManager.mjs::setupPanel/destroy`, Core singleton `cy`, fixed IDs, ResizeObserver and live layers | Eight incomplete destroys; post-destroy resize still renders; second mount binds first host | Cannot assign a steady-state percentage. Independent lifecycle/ownership defect, with measured wasted work after destroy and potential session amplification. Fix before reliable multi-viewer performance tuning. |

Toolbar/focus rebuilding, delayed link scans and MQTT-triggered layout are plausible additional costs, not numerically ranked causes in the isolated run. There is no measured pointermove → toolbar-rebuild loop.


## 5. Root-Cause Analysis

### Redundant work and causality

`applyGraphSelectedFileEntries` calls select/unselect on every node even when only two nodes need a state transition. The benchmark emits the production node tap and records this function independently, while toolbar and editor-switch work is suppressed. This isolates local selection work from application synchronization. It does not assign the suppressed cost a value of zero in production.

`rebuildVisibleEdges` reconstructs the entire projected edge set even when called repeatedly without any link change. Add/remove counts distinguish that work from a repaint. Link records, labels and visibility projection are necessary; wholesale recreation is not inherently required. The benchmark's repeated unchanged rebuild is a controlled worst case for redundant work, not evidence that every pointer move invokes it.

`runRelayout` is synchronous and uses substantially different initial and subsequent options. The benchmark resets first-layout state for each fixture, records both initial and proof runs, and measures camera operations separately. An expensive layout is not evidence of a layout-on-pan bug. On actual slow storage, sequential link scans and preview reads can outlast the 60 ms debounce, permitting an early node layout and a later edge layout; this is a code-supported hypothesis requiring delayed/real-file transport measurements.

Resize and tab restoration can trigger fitting and repaint without graph layout. Repeated hidden/visible cycles exercise observer callbacks and sizing churn. Any “tab switch” duration here excludes tab-strip DOM rebuilding, workspace context publication, and activation of other editors.

### Cleanup and ownership

The benchmark invokes the returned production destroy hook **before** checking whether the renderer is destroyed and before resizing the former panel. Only after recording this evidence does test teardown explicitly disconnect the observer and destroy Cytoscape to avoid contaminating later cases. Retained active objects and callbacks establish incomplete cleanup; they do not quantify a long-session retained heap slope.

A separate two-panel test calls the real setup twice and checks actual container identity. This addresses the fixed-ID/module-singleton issue rather than assuming two independent graphs from their visible panels. Global singleton listeners do not automatically multiply once per viewer; some are guarded/replaced. Old renderer/observer ownership and live-layer cleanup are the more specific risks.

### Hypotheses and exclusions

No conclusion of an infinite Graph Manager selection feedback loop is supported by this isolated fixture. Full workspace subscribers need a follow-up capture. Likewise, no application-level duplicate animation loop or perpetual idle graph rendering should be inferred from the existence of Cytoscape's internal frame scheduler. Render-event counts and long tasks are more relevant than simply counting scheduled rAFs.

The fixture does not measure directory collision resolution, large broken-link sets, HTML image-heavy graphs, external links, deep compound nesting, storage/network latency, TD parsing, live MQTT changes, or drag-to-move persistence. These can change rankings. No user notebook was used as a benchmark corpus.

### Comparison with other editors

- `SVGeditorComponents/SvgSelectionRefreshSplit.test.mjs` documents separate geometry-only vs selection-state refreshes; `InstallSvgSelectionPublishing.mjs` coalesces selection notifications with rAF and requests `rebuildDropdowns:false`. This is a useful precedent for graph selection publication and stable geometry; it is not evidence that graph camera motion currently runs full toolbar refreshes.
- `panels/createToolbar.mjs::updateToolbarState` still clears/rebuilds the main toolbar when its cache exists, and defaults to rebuilding dropdowns. Its global pointermove listener only records coordinates. The graph's selection/focus paths use the default update, unlike SVG's explicit dropdown suppression. Measure a fully mounted toolbar before attributing a numeric share of lag to it.
- `PanelInstances/Common/Layers/HtmlLayerInvalidation.mjs` caches membership and invalidates on structural change; `docs/html-history-performance-investigation.md` distinguishes data mutation, serialization and preview fan-out. These support incremental graph topology/style invalidation and representative full-workspace validation.
- `GraphSemanticZoom.mjs` already batches presentation changes and keeps geometry stable. Existing panel lifecycle/zoom capability infrastructure should be reused. Canvas rendering is already delegated to Cytoscape; do not introduce a second renderer, custom dirty-region engine, or arbitrary viewport deletion before measuring its existing culling/cache behavior.

## 6. Recommended Optimizations

Recommendations are proposals only; none are implemented here.

| Order | Proposed change | Expected benefit | Complexity / regression risk | Architectural fit |
|---|---|---|---|---|
| 1 | Make graph state instance-owned; pass actual container/inspector elements; return comprehensive destroy and deactivate/activate hooks | Correct multiple tabs and stop closed-instance work; prerequisite for trustworthy long-session profiling | Medium-high / medium-high: global actions and existing integrations need explicit active owner | Existing panel lifecycle and capability registry |
| 2 | Reconcile selection by changed IDs; publish only changed selection; coalesce toolbar/context work | Removes graph-size-dependent local selection work and duplicate publication | Low-medium / medium: Ctrl/Meta, background, cross-panel selection and link context must remain correct | Follow SVG selection-state/geometry split; retain editor switch guard |
| 3 | Reconcile projected edges by stable identity and changed data; skip unchanged rebuilds | Avoids full edge removal/addition, style recalculation and cache invalidation | Medium / medium-high: aggregated occurrences, broken placeholders, scope and live layers | Preserve current projection, bucket and record infrastructure |
| 4 | Classify graph topology vs label/style vs camera changes; coalesce startup/update layout only when geometry needs it; evaluate bounded incremental layout | Reduces synchronous stalls and repeated layout on slow loads/live feeds | Medium-high / high: compound packing and mental-map stability | Keep fCoSE initially; use existing queue and layout lifecycle |
| 5 | Resize only on meaningful dimensions, preserve camera across ordinary restore, defer expensive hidden work | Reduces redundant resize/fit/redraw and camera jumps | Low-medium / medium: fit semantics and shared zoom layer | Extend existing rAF sizing guard and lifecycle visibility |
| 6 | Profile real toolbar/FileView/editor subscribers and selectively suppress redundant rebuilds | Potential additional selection/focus savings, currently unquantified | Medium / medium: stale toolbar availability is unacceptable | Reuse toolbar options and attention/context publication mechanisms |
| 7 | If renderer remains dominant after earlier changes, benchmark annotation controls and Cytoscape rendering options | Potential large-graph frame improvement; fixture-specific | Medium / medium-high: fidelity and hit-testing must be preserved | Existing semantic mode is an opt-in presentation feature, not permission to hide functionality by default |

Hover deserves its own targeted experiment alongside the selection work: inspect the bundled renderer’s candidate search, evaluate geometry-index reuse or safe per-frame hit-test coalescing, and verify that enter/leave, edge labels, overlapping nodes and drag targets remain correct. The 97.3% hover attribution means toolbar or layout changes alone cannot fix this path. A spatial index is a possible follow-up, not a presumed drop-in solution; first determine what the bundled renderer already caches.

Do not replace the renderer or change persisted graph schemas on this evidence. Prefer changes that retain identical graph semantics and visible functionality.

## 7. Proposed Implementation Phases

1. **Ownership/lifecycle correctness:** isolate each panel's instance and subscriptions; test two independent hosts, retained hidden tabs, close/reopen, active action routing, observer disconnection and live-layer unsubscribe. Preserve global compatibility through an active-owner facade if necessary.
2. **Selection:** replace full-node reconciliation with a changed-ID set; make publication idempotent; compare node/edge/background and modifier selection, keyboard/resource actions, toolbar state, editor guard and link preview. Require selection cost to stop growing linearly with unrelated nodes.
3. **Edge update:** introduce incremental edge/placeholder reconciliation using existing link identity, including multiple occurrences, external and broken targets and scope changes. Require unchanged rebuild to produce zero add/remove events.
4. **Layout scheduling:** distinguish geometry-affecting changes; benchmark actual delayed file loading and live feeds; avoid unnecessary layout while retaining correct first paint and final fit. Evaluate incremental layout before considering workers or an alternate algorithm.
5. **Viewport/workspace:** reduce unnecessary fit/resize work and gate hidden work; profile the complete toolbar/FileView/other-editor stack. Verify saved camera and semantic state on tab restoration.
6. **Hit testing and renderer tuning:** profile and reduce repeated full candidate searches without losing hover/drag fidelity; repeat trusted-input traces on representative hardware and real notebooks, then evaluate reversible options with full visual/selection regression coverage.

Each phase should be reviewed and benchmarked independently; stop or revise it if the targeted counter/time does not improve.

## 8. Before-and-After Benchmark Plan

Keep this raw baseline and compare the same Chromium flags, viewport/DPR, topology, labels, edge density, initial/proof layout distinction, warmup, sample counts and machine load. Run at least five independent browser processes for optimization acceptance, alternating baseline/candidate order; the two sweeps here provide an initial repeat check, not a confidence interval. Report median run means and worst-run p95/max, not only the fastest result. Normalize operation counts before comparing elapsed time.

Required gates:

- Camera-only operations must not introduce fCoSE or graph reconstruction. Preserve selected IDs, link records, node positions and camera semantics.
- Unchanged selection must not republish state or rebuild toolbars unnecessarily; a changed selection must still update all intended consumers exactly once.
- Unchanged edge reconciliation should not recreate edges; changed links must preserve occurrence semantics, placeholder retargeting and MQTT/TD exclusions.
- Destroyed instances must report destroyed, unregister capabilities/listeners, disconnect observers and stop callbacks. Repeat 100 open/close cycles and collect CDP heap snapshots after forced GC; distinguish application globals from per-instance retention.
- Hidden tabs must preserve state, refuse inactive gestures and avoid expensive unnecessary redraw/layout. Reopening must show current data and restore camera without cross-tab ownership.
- Add trusted CDP mouse drag/wheel/tap input with tracing (`Layout`, `UpdateLayoutTree`, `Paint`, long tasks), a real toolbar, FileView, Graph Manager next to SVG/HTML editors, and actual panel tab/minimize commands. Measure event-to-next-paint separately from command duration.
- Add deep directories, broken links, image previews, real representative graph directories, throttled file responses and MQTT/TD updates. Record request/scan/parse/construction/layout/paint phases separately.
- Run an entirely uninstrumented browser control plus probes enabled, and use duration differences to bound overhead. Keep low-frequency counters in development only. Avoid virtual-time performance tests.

The work stops at diagnosis and these proposed phases; no optimization is authorized by this report alone.

### Validation performed

The browser matrix completed successfully and produced the checked-in raw baseline. All new JavaScript modules pass `node --check`; Python sources parse successfully. Existing `GraphSemanticZoom.test.mjs` and `graph-scope-projection-probe.test.mjs` passed. The existing mocked `panelTabsLifecycle.test.mjs` could not run in this environment: direct Node execution cannot resolve `/StatusBar.mjs`; with `panelRootImportTestLoader.mjs`, it fails because `MutationObserver` is absent from its mocked environment. No unrelated test harness or production behavior was changed to hide that limitation. The browser lifecycle observations above use the actual Graph Manager setup/destroy hooks, but do not replace full workspace tab regression coverage.
