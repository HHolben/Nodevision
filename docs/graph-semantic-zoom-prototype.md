<!-- Nodevision/docs/graph-semantic-zoom-prototype.md -->
<!-- This report records the implementation, ownership decisions, verification results, and measured limitations of Graph Manager's first semantic zoom capability. -->

# Graph Manager Structure / Annotations prototype

Implemented against the current working tree using [the architecture study](panel-zoom-architecture.md). No fisheye, directory aggregation, alternate graph model, or saved-layout schema was added.

## Behavior

Use the existing View zoom controls: choose **Semantic**, then **Structure** or **Annotations**. Ctrl/Command wheel and plus/minus operate the selected mode. Decreasing detail selects Structure; increasing detail selects Annotations; zero or **Reset mode** returns to Annotations. Repeating a level or stepping past either boundary is a claimed no-op. Small semantic wheel deltas accumulate before stepping. Explicit mode choice takes precedence over legacy Alt/Shift mappings.

Structure suppresses ordinary edge annotation paint through a scoped `text-opacity: 0` stylesheet rule. Node labels, node types, edges, and topology remain. Cytoscape-selected edges, Graph Manager's `.nv-selected-link` edges, and `.nv-broken-link-edge` warning edges retain their current annotation styling. The link inspector remains available. There are no separate annotation objects or replacement selections.

Annotations removes the helper's presentation class. It does not assign a hard-coded opacity, rewrite `edgeLabel`, or rebuild the graph. Original/custom color, width, line style, selected/warning styles, and label data survive. Opacity changes preserve label metrics; changing label text or hiding entire elements would not provide that guarantee.

Geometric zoom stays independent. The adapter delegates the shared geometric controls to the existing panel viewport implementation, preserving its current generic scaling behavior. Ordinary Cytoscape wheel camera navigation remains available. This deliberately does not migrate Graph Manager to a new native camera adapter or remove its existing two-scale limitation.

## Implementation and lifecycle

| Module | Change |
| --- | --- |
| `ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/GraphSemanticZoom.mjs` | Small per-view adapter; owned presentation rule; batched collection updates; selected/warning exceptions; refreshed-edge handling; cleanup; existing geometric delegation. |
| `ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerCore.mjs` | Installs adapter after Cytoscape construction, releases prior adapter on graph replacement, excludes semantic notifications from viewport resizing. Six added lines. |
| `ApplicationSystem/public/PanelInstances/InfoPanels/GraphManager.mjs` | Returns a normal lifecycle destroy hook that releases the adapter and panel focus listeners. |
| `ApplicationSystem/public/panels/panelZoomCapabilities.mjs` | Per-registration input mode, optional level/action metadata, hidden/disconnected dispatch rejection, and visible descendant discovery. Explicitly unsupported actions return false. |
| `ApplicationSystem/public/panels/panelZoomPan.mjs` | Uses the owner's selected mode; accumulates semantic wheel steps; leaves fallback decisions solely to the registry; rejects hidden wheel targets. |
| `ApplicationSystem/public/ToolbarJSONfiles/panelZoomModesWidget.mjs` | Uses shared mode state and named levels; adds mode reset; reflects authoritative adapter state. |
| `GraphSemanticZoom.test.mjs`, `panelZoomCapabilities.test.mjs` | Focused capability and real bundled-Cytoscape engine regressions. |
| `scripts/graph-semantic-zoom-browser.mjs`, `scripts/graph-semantic-production.mjs` | Rendered graph, shared input, real production mount/refresh, side-effect, and performance checks. |
| `scripts/test-graph-semantic-zoom-browser.py`, `scripts/run-browser-regression.mjs` | Synthetic HTTP fixture and real-clock Chromium debugging-pipe runner; no external automation dependency. |

The registered host is the actual Cytoscape container inside the active Graph Manager tab. The shared registry discovers it from the panel owner; its mode and level belong to that registration. Hidden retained tabs reject commands but retain state for reactivation. Graph replacement unregisters the old adapter and starts at geometric input / Annotations detail. Panel destruction and Cytoscape destruction both release the adapter; cleanup is idempotent and restores only its owned presentation rule/classes. No adapter-owned animation frame or delayed render survives disposal.

Production Graph Manager remains singleton-oriented. Two fixture registrations prove routing isolation, not arbitrary production multi-instance Graph Managers.

## Event ownership decision

The interrupted command had not moved the listener or cleaned the runner. Inspection confirmed Cytoscape had already installed capture listeners on its container; a later listener on that same container could not prevent inactive native camera handling.

The guard now lives on the enclosing `[data-graph-manager-surface]` (the direct enclosing host in minimal fixtures). It checks `event.composedPath()` contains this graph's container. That ancestor runs before Cytoscape's container listeners. It reserves only Ctrl/Meta wheel events for the shared window router; it does not dispatch zoom itself and does not block ordinary Cytoscape wheel navigation. Inspector siblings are outside the guarded event path.

An eligible active owner is dispatched once by the existing window router. The enclosing guard stops refused/inactive modified input from subsequently reaching Cytoscape. Hidden hosts are also rejected by the registry, including direct programmatic dispatch. Unsupported semantic actions do not reach generic CSS scaling, the camera, or an ancestor. The registry remains the single capability and fallback authority.

## Verification results

The browser fixture uses the same bundled Cytoscape renderer as the application. Its production section imports the real GraphManager and GraphManagerCore, with only toolbar/selection-opening integration stubs and synthetic transport responses. The test server inserts counters into the existing core functions without replacing their bodies; startup proves those counters execute before the transition measurement resets them.

Verified:

- Both named levels, authoritative mode selector, keyboard/wheel stepping and reset.
- Boundary commands claimed once; repeated same-level requests make no graph style/class change.
- Ordinary labels suppressed; node labels retained; selected/native link-selected/broken-edge annotations retained.
- Custom line color, width, dash style and selection/warning styles preserved; custom annotation opacity restored on Annotations/cleanup.
- Real node and edge selection unchanged across 100 transitions, in both engine and production/browser checks.
- Node positions, parent relationships, element data/counts, native camera zoom/pan unchanged; rendered fixture also checks edge endpoints/control points and node bounds.
- **Zero** transition-triggered Nodevision layout scheduling/execution, abstraction filtering, visible-edge rebuilding, and fit calls in the production fixture.
- **Zero** new fetches/save requests and **zero** dirty-state/Notebook-selection changes during production transitions; all transport is synthetic. No link-record rewriting or source data mutation occurs.
- Existing refresh path ingests synthetic persisted links and rebuilds an ordinary edge while Structure is active; the edge is suppressed, then restored by Annotations. That explicit refresh may perform its normal layout/network work; switching levels does not invoke refresh.
- Active A dispatches once, inactive B receives none; swapping active ownership reverses this. Hidden retained hosts reject dispatch and work after reactivation; removed adapters receive no semantic commands.
- Repeated install/replacement/disposal, five additional mount/destroy cycles, scoped rule cleanup, and graph-destroy unregistration.

Cytoscape still performs internal style invalidation and rendering. Those costs are not Nodevision graph layout or edge rebuilding.

## Performance

Machine: Intel Core i3-1315U; Chromium 148.0.7778.178, Linux, headless software rendering (`--disable-gpu`), device scale factor 2. Twenty alternating transitions per fixture; 650 × 400 CSS-pixel graph viewport; fixed positions; one edge per node for sparse fixtures and approximately four per node for denser fixtures. No toolbar is mounted during the larger benchmarks, separating adapter/render cost from toolbar synchronization.

The first runner used Chromium virtual time and produced misleading zero-duration samples. Those numbers were discarded. The debugging-pipe runner uses real browser clocks. Synchronous command time includes the helper and registry; style time instruments Cytoscape `endBatch`; the visual column measures through two animation frames, a paint-opportunity latency rather than a pixel-compositor timestamp. Allocations were not reliably measured.

| Nodes | Edges | Command p50 / p95 ms | Batch style p50 / p95 ms | Through paint opportunity p50 / p95 ms |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 999 | 2.2 / 5.9 | 0.8 / 3.5 | 35.8 / 51.1 |
| 1,000 | 3,999 | 10.0 / 14.3 | 3.5 / 7.1 | 119.7 / 145.5 |
| 10,000 | 9,999 | 21.4 / 72.6 | 8.6 / 11.5 | 223.4 / 278.7 |
| 10,000 | 39,999 | 87.9 / 107.6 | 34.0 / 42.5 | 915.5 / 1,022.1 |

Every benchmark records zero layout events, selection changes, and graph-data/add/remove events during switching. Measurements vary with machine load and are not universal guarantees.

The initial implementation updated individual edges in JavaScript and incurred repeated class/style handling. Batched [Cytoscape collection operations](https://js.cytoscape.org/#collection/style) reduced that cost. There is one installed scoped style rule, no whole stylesheet replacement per transition, and no edge-data rebuild. Selection/new-edge updates remain targeted. Cytoscape still visits affected edges and rerenders text, so work scales with edge count. A function selector was examined but the bundled engine serializes it as `"undefined"`, making safe public-API stylesheet cleanup unreliable; the scoped class rule avoids that problem.

**The approximately 100 ms end-to-end p95 target is not met for dense/large software-rendered fixtures.** Synchronous dispatch is much smaller than total paint-opportunity latency; rendering dominates the remaining cost. This prototype provides explicit discrete levels, not automatic camera thresholds or continuous effects. Further renderer optimization requires separate evidence and is not disguised by changing graph geometry, hiding edges, or reducing the benchmark size.

## Tests run and limits

Passing:

- `node --test` for GraphSemanticZoom, panelZoomCapabilities, savedLayoutModel, EdgeBucketHydrationPlan, LinkRecords.fallbacks, LinkRecords.metaworldResources and panelContentLifecycle: seven test files.
- `panelTabsLifecycle.test.mjs` with the existing browser-root import loader and an inert MutationObserver preload for its fake DOM. Without those environment accommodations it fails before exercising tabs; the unmodified fixture does not provide MutationObserver.
- `python3 scripts/test-workspace-improvements-browser.py`: existing image/zoom ownership/FileManager/neutral-layout/structural restore checks.
- `python3 scripts/test-graph-semantic-zoom-browser.py`: real Cytoscape, production integration/refresh, routing, invariants and real-clock benchmarks.
- Module syntax checks and `git diff --check`.

One unrelated existing failure remains: `LinkRecords.imageText.test.mjs` leaves `Media/Initial.png` in an HTML style attribute after reference replacement. Its implementation/test and relevant parser dependencies were not changed by this work.

No saved-layout persistence was added: defaults/reset are Annotations, and no selection IDs, file references, directory scopes, or camera centers are persisted. No full Electron/native desktop or assistive-technology certification was performed. Existing singleton Graph Manager globals and geometric CSS/native-camera coexistence remain. Direct Cytoscape per-element style bypasses retain their normal precedence over stylesheet rules; this prototype owns a stylesheet rule, not arbitrary third-party bypasses or replacement stylesheets.

## Explicit answers

- **Does Structure/Annotations alter only presentation?** Yes: an owned text-opacity rule and transient classes; no authored data edits.
- **Do topology, positions, camera and canonical selection remain identical?** Yes in the rendered, production and 100-transition checks. Explicit independent graph refresh/content operations can still change the graph normally.
- **Are transitions free of layout, abstraction filtering, edge rebuilding, Notebook writes and new fetches?** Yes, verified by production counters, source snapshots and transport instrumentation.
- **Does semantic routing invoke exactly one intended owner?** Yes for the tested active/inactive/swapped/hidden/removed owners, plus actual production registration.
- **Can unsupported semantic actions fall through into geometric zoom?** No; refusal remains false and accepted boundary steps remain claimed.
- **Is the existing registry sufficient?** Yes for this prototype, with small optional action/level metadata and per-registration mode state. No parallel zoom manager was needed.
