<!-- Nodevision/docs/graph-directory-scope-investigation.md -->
<!-- This report documents the directory aggregation investigation, reproducible abstraction blockers, measured planning and visibility experiments, and the smallest refactoring seams required before exposing structural semantic scope. -->

# Graph directory scope: refactor before exposing aggregation

Decision: **do not wire the existing abstraction filter or edge rebuild directly into semantic zoom.** Real-browser probes reproduce selection divergence, selected-edge replacement, parent detachment, mandatory layout scheduling, and lost directory-to-directory relationships. The working [Structure/Annotations prototype](graph-semantic-zoom-prototype.md) remains unchanged. This fulfills the investigation's permitted blocker/refactoring outcome, not a claim that Files/Directories is implemented.

The experiment adds only test scripts, an investigation mode to the existing browser runner, and this report. No application module, capability registration, toolbar, source-save path or saved-layout schema changed in this task. The test-only projection planner is not an alternative Graph Manager implementation.

## Existing architecture and demonstrated blockers

Most of the relevant behavior resides in [GraphManagerCore.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerCore.mjs).

| Owner / function | Current meaning | Consequence for semantic scope |
| --- | --- | --- |
| `renderGraphData`, `toggleCompoundDirectory` | Directory nodes use notebook-relative IDs/fullPath and parent IDs; `Root` has empty fullPath. Expansion fetches and adds contents; collapse **removes descendants**. Whether descendants exist identifies expansion. | Loaded graph membership and expansion are intertwined. Hiding descendants does not make a directory “collapsed” to existing resolvers; removing them loses selection and positions. |
| `directoryScopeVisibleNodeIds` | Filters loaded directories by path depth, **and includes files in those directories**. | Level 0/1 is a depth filter, not Directories/Files. Directory scope cannot simply reuse that integer. |
| `fileScopeVisibleNodeIds` | Builds adjacency from discovered source links and does a bounded link-distance walk, then matches loaded file/external nodes. | This is a neighborhood filter, independent of directory representation and annotation detail. |
| `setScopedGraphDisplay`, `detachScopedNodesFromHiddenParents`, `restoreGraphAbstractionParents` | Hides/shows nodes, moves visible children of hidden parents to the runtime root, remembers/restores parent IDs. | Applying it changes hierarchy. Temporary parent bookkeeping is module-local, not a projection model. |
| `applyGraphAbstractionFilter` | Restores parents; calculates visible IDs; changes display/parents; unselects nodes and selects root; rebuilds edges; refreshes TD layer; calls `queueRelayout`. | `fit: false` prevents requested fitting, **not layout scheduling or root selection**. This is not a view-only scope command. |
| `setGraphAbstractionRootFromSelection` | Loads directory levels or scans the selected file, applies filter and calls `cy.center(root)`. | The public action may fetch/discover/persist graph-cache records and recenters. Reusing it would violate semantic command expectations. |
| `clearGraphAbstractionFilter` | Restores parents, shows elements, rebuilds edges and optionally schedules layout. | `relayout: false` does not prevent edge replacement or restore prior selection. |
| `getVisibleNodeId` | Searches exact visible node and then path ancestors, checking ancestor visibility. | Useful starting logic, but it depends on live Cy display state and has no special fallback to `Root` for a top-level file. An immutable directory index needs explicit root handling. |
| `resolveVisibleTargetNode` | Refuses expanded directories as target endpoints; prefers a visible descendant. | After hiding files while retaining their compound parents, a visible directory can resolve as a source but **not as a target**. Cross-directory relationships disappear. |
| `rebuildVisibleEdges` | Scans discovered/broken-link maps; groups by visible source/target; clears endpoint editing; removes all ordinary rendered edges and placeholder nodes; recreates them. | Projection computation and destructive rendered-element replacement are combined. Native edge selection and element identity disappear on every rebuild. |
| `queueRelayout`, `runRelayout` | Debounces layout; runs fcose/cose; may fit; initially may randomize. | A false fit flag is not a no-layout option. The semantic path must bypass scheduling entirely. |
| `refreshGraphView` | Clears abstraction/filter state and maps; removes ordinary elements; reloads files/links and queues layout. | Aggregation caches need graph generation/revision boundaries. Current refresh has no separate “refresh projection while retaining scope” contract. |

[GetVisibleNodeID.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/GetVisibleNodeID.mjs), [LinkRecords.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs), and [SaveFoundEdge.mjs](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/SaveFoundEdge.mjs) provide additional evidence. Link discovery calls the edge-cache persistence path (`/api/graph/save-edges`); this is distinct from authoring HTML links but is still a write a view-only command must not initiate.

### Reproduced counterexample

Synthetic loaded graph: `Root → P0 → {D0,D1}`, two files in each directory, with inter-directory file links. Probes execute the actual private functions through test-only exports appended in memory by the fixture server; their bodies are not replaced. Queued layouts are explicitly cancelled immediately after probing to isolate the other effects and protect the timing experiment.

1. Select `P0/D0/f0.txt` and a real Cy edge. Save Notebook selection and camera state.
2. Apply directory filter `P0`, depth 1, **fit false**.
3. Cy selection becomes `P0`; Notebook selection remains the file. `selectedPathForGraphRootAction()` now returns `P0`, proving competing selection authorities disagree. The selected rendered edge is removed.
4. Instrumentation observes one abstraction call, one visible-edge rebuild, and one layout scheduling call. Cancelling that timer in the test does not make the production operation layout-free.
5. Clear with `relayout: false`: file selection is not restored.
6. Apply file/link-distance scope 0: its selected file loses its runtime parent. Clearing restores the parent identity.
7. Independently hide files while retaining compounds. The source maps to `P0/D0`; the target resolver returns null for a file under `P0/D1`. Calling the real rebuild removes the inter-directory edges instead of projecting them.

These are concrete reasons to extract seams before a production aggregation control. They are not speculative cleanup requests. Adding a `preserveSelection` flag alone would not address target resolution, edge identity, refresh, and proxy editing.

## Proposed smallest structural transition

Use **Files ↔ Directories**, bounded to **currently loaded contents and existing scope**. Do not claim a whole-Notebook summary when descendants have never been loaded. An unloaded directory remains the same existing directory node and is labeled as not fully loaded when counts would otherwise be misleading. Scope switching must not fetch it.

- **Files:** show the currently loaded eligible file nodes and existing directory hierarchy; preserve existing filters and explicit expansion state.
- **Directories:** each eligible loaded file maps to its nearest existing directory ancestor. Retain directories and external/broken-link diagnostic entities as appropriate; root files map explicitly to `Root`. Do not flatten nested directories or create synthetic persistent groups.
- Existing directory/link-distance filters define *which* entities are eligible. Structural scope defines *how those eligible entities are represented*. Neither overwrites the other.
- Annotation detail stays independently `structure | annotations`, using the existing helper.

Proposed adapter state retains backward compatibility:

```js
{ level: 'annotations', scope: 'files' }
```

Here `level` remains the existing detail field; it is not an integer combining scope, directory depth, link distance and annotation density. A future explicit scope command can use `executePanelZoom(owner, 'semantic', { action: 'set', scope: 'directories' })`. The owner would reject simultaneous conflicting detail/scope updates. This payload is a proposal, not an installed handler.

### Capability/UI decision

Prefer **a separate named scope control using the same semantic handler** (Option B's UI with Option A's small structured state). Keep existing Ctrl semantic gestures controlling Structure/Annotations for compatibility. Add an explicit, labeled **Graph scope: Files / Directories** control only when the projection is safe. It calls the same registry and shares the same owner; no routing redesign is required.

Option C would make the already working gesture silently change meaning. A universal 0–5 ladder would lose independent combinations. A “semantic axis” selector is unnecessary for two explicit choices. Scope reset/reveal should explicitly name scope; existing Reset mode keeps resetting annotation detail. If user research later favors scope-wheel navigation, make that a visible input-axis preference rather than an implicit modifier.

The registry already transports structured commands and owner-returned state. It appears sufficient, but **a second production semantic dimension has not been implemented or validated**. The existing generic toolbar level metadata describes one axis; use the Graph Manager toolbar/context system for the bounded scope control before inventing a multi-axis metadata framework.

## Canonical selection and visible representation

Graph Manager already supports multiple selected file entries: `selectedFiles`, `selectedFilePaths`, `selectedFilesOwner`, Ctrl/Meta toggling and additive Cytoscape selection. There is no need to build another selection store.

Extract a read-only canonical selection snapshot from the existing selection authority. Build a separate map:

```text
canonical file ID → visible directory ID
visible directory ID → selected descendant IDs/count
canonical link-record identity → projected relationship ID
```

Highlight projected selection using a dedicated presentation class/count, **not `directory.select()`**. Keep hidden canonical files selected in Cy where feasible, and keep authoritative selected paths unchanged. Returning to Files removes projection styling and reveals the original selected files; it does not publish a new selection event. If both a directory and its descendants are explicitly selected, indicate these states separately and avoid double counting.

An explicit click on directory D is a normal selection action and may invoke the existing directory selection rules. The probe confirms `selectSingleGraphNodeFile(D)` selects D intentionally. Merely switching scope must never call that function. The test-only identity planner demonstrates two selected descendants mapping to one directory without mutating source records or selected IDs; it does not install accessible highlights or a UI.

Edge identity must use canonical link occurrences, not a rendered edge ID. Current rendered IDs are derived from represented endpoints and grouping, while record IDs include source offsets/index/target hashes and may change after edits. Key identity within a source revision and reuse the existing record reconciliation on edits; do not assume those IDs survive every source change. The link inspector already carries occurrences, but the renderer and editing tools also retain rendered edge IDs.

**Reveal selection** should switch structural scope to Files and expose the selected loaded entity without navigation, centering or file opening. The current `revealPathInGraphManager` cannot be called unchanged: it opens/expands directories, selects/publishes and centers the node, and can request file opening. If the entity is not loaded, offer a separate explicit load/reveal action with those consequences; a no-fetch scope command cannot promise to reveal unloaded content.

## Geometry and camera policy

Prefer retaining existing compound nodes, loaded children and their current positions. Visibility-based inspection in the bundled renderer is promising: the small probe preserved compound positions and restored them exactly without changing camera state. The larger fixture does expose a transient compound-center shift (measured below), despite exact restoration after returning to Files. Raw hide/show therefore does not yet satisfy exact geometry preservation; a compound-bounds seam is an additional acceptance gate.

This experiment **does not** prove a compact directory graph or preserve new projected edge curves: it hides files without installing the needed projected edges. Existing compounds may retain large expanded bounds. That is acceptable for a first coarse view if explicitly described; shrinking compounds or using centroids would be a second geometry feature.

Do not detach parents, remove/re-add canonical file nodes, call layout, `fit`, or `center` on scope transitions. Snapshot and compare child positions, compound centers/bounds, viewport dimensions, camera pan/zoom and current annotation detail. Existing layout has runtime positions and temporary drag snapshots; the inspected paths have no separate persistent semantic-position cache. Collapsing removes children and expanding reloads/re-lays out, so it cannot promise restoration of their original positions.

If future aggregation requires fixed compound envelopes, first prove a renderer-owned bounds policy that preserves centers without modifying canonical parent relationships. No hidden camera compensation. Record unavoidable displacement and reject a scope implementation that cannot keep the same visual location.

## Edge projection and interaction boundary

Extract the existing grouping logic into a pure planner before installing any projected edges. Inputs: immutable loaded hierarchy, eligible canonical source/link records, broken records and scope. Output: representative mapping and ephemeral relationship descriptors.

| Case | Proposed representation |
| --- | --- |
| A → B in different directories | Directory A → Directory B, keeping all contributing canonical record identities. |
| Several links between the same represented endpoints | One directed relationship with occurrence count and inspectable member records. Do not confuse occurrence count with distinct file-pair count. |
| Links internal to one directory | Internal-link count in the directory inspector; no invented self-loop by default. |
| Broken link | Preserve source record and unresolved target identity. Existing diagnostic placeholders can be reused only through a read-only projected representation with canonical member references. Keep warning detail visible in Structure. |
| External node | Preserve its real external identity; do not infer a directory by splitting its URL/ID. |
| Selected canonical link | Highlight its projected relationship and keep its selected occurrence; returning to Files restores that occurrence, not “first record in group.” |

Projected edges are disposable view artifacts, never inputs to discovery or `saveFoundEdge`. Use deterministic collision-safe keys over represented endpoints and direction, separate from canonical record identities. Exclude them from ordinary source-edit, deletion, endpoint dragging, persistence, and graph discovery paths. An ambiguous summary allows inspection and reveal; it does not retarget/delete all contributors or silently pick the first contributor.

This requires a real interaction boundary. Current edge tap/Shift-tap, `enableLinkEndpointEdit`, and `retargetGraphLinkData` assume source-backed edge data. `firstEditableTargetRecord` can choose the first record from a group. Existing aggregate edges therefore are not automatically safe new semantic proxies. Reuse their occurrence inspector logic, but require an explicit occurrence selection before editing and initially keep scope proxies read-only.

## Annotation interoperability

The existing GraphSemanticZoom adapter can continue applying annotation rules to installed view edges; do not copy its logic into a scope implementation. Mark projected selected/warning relationships through the existing presentation conventions (or a small documented mapping). Keep projected counts available in the inspector even if Structure hides ordinary edge text.

The investigation verifies the annotation state remains independent while experimental file visibility alternates through all four combinations. That is only a compatibility probe: since production aggregation is blocked, **Directories + Structure/Annotations is not yet a shipped scope representation**.

## Lifecycle, refresh and cache design

The current representation depends on lazily loaded nodes and global discovered-link maps. Extract a read-only graph snapshot and generation/revision signal before caching projections. Do not retain mutable Cy elements across replacements.

Cache plain representative IDs and relationship member IDs by `{generation, hierarchyRevision, linkRevision, eligibleFilterRevision, scope}`. Selection counts can have a separate selection revision; annotation changes do not invalidate structural grouping. Index parent/ancestor resolution and source-to-target records once per revision. Reuse unchanged plans; diff changed projected edges instead of removing all edges every switch.

| Event | Required future handling |
| --- | --- |
| Mount | Files default; annotation default unchanged; create one generation; no loading solely for scope. |
| Scope switch | Reuse cached plan; update presentation/ephemeral relationships; no layout or canonical-selection writes. |
| File/directory add, remove or move | Invalidate affected hierarchy/relationship entries; resolve deleted selection through normal content-change rules. Do not restore a deleted entity from cache. |
| Explicit graph refresh | Rebuild source snapshot, then regenerate current scope against the new revision; existing refresh may retain its normal explicit layout behavior. Projection itself adds no extra layout/fetch. |
| Retained tab inactive | Keep plain state, suspend visual work, leave routing unchanged. Reactivation applies only the latest generation. |
| Graph replacement | Invalidate all old IDs/caches; cancel pending work; validate/reset scope. |
| Destroy | Release observers/listeners/ephemeral elements and maps; no delayed old-generation work. |

The planning unit test reconstructs after removal and proves the old plain plan stays unchanged. It is not a production invalidation implementation. Browser measurements report representative-map plus relationship-map entry counts (excluding member-ID arrays and count maps, not a byte estimate) and explicitly release the one local cache; this does not prove heap garbage collection or long-session leak freedom.

## Accessibility

A directory representative needs an accessible name, loaded represented-file count and selected-descendant count, for example “docs, 50 loaded files, 3 selected descendants.” An unloaded count must not imply total contents. Keep one accessible directory row/inspector entry rather than exposing both a summary and invisible duplicate detail. Canonical selected file names and link occurrences remain reachable through an inspector and keyboard Reveal selection.

Cytoscape canvas labels alone do not provide that interface. Extract/reuse the existing inspector presentation before enabling the control. Do not add redundant hidden DOM trees or rely on proximity/color to explain projected selection. Keyboard focus may move to a representative control without changing canonical selection. No new accessible scope controls were installed in this investigation.

## Measurements and test interpretation

Run `python3 scripts/test-graph-semantic-zoom-browser.py --scope-investigation`. The existing fixture server appends test-only exports to Core in memory. These call the real filter, parent, selection and rebuild helpers. It uses bundled Cytoscape, real clocks, fixed positions, synthetic link records and no Notebook access. The runner saves the complete result to `/tmp/nodevision-graph-scope-results.txt`. Set `NV_SCOPE_CASE=10000:4` to rerun only the dense 10k fixture; without it all four run. The final dense measurement used this isolated invocation after the previous execution session ended; it uses the same renderer and fixture settings.

The benchmark is intentionally split:

1. **Planning experiment:** pure nearest-loaded-directory mapping and directed relationship grouping on plain records. It recomputes every transition to measure cold work, and separately measures access to a retained plan.
2. **Rendering lower-bound experiment:** 100 file hide/show transitions on the same real Cy graph per size/density, with two animation frames per transition. It does **not** install/remove projected edges. It therefore cannot claim full aggregation command time, projected-edge mutation time or production aggregation latency.

Fixtures contain approximately 1k/10k files in 50-file directories nested under projects; sparse and four-link-per-file distributions include intra- and inter-directory references. Metadata and edges are synthetic. Machine: Intel Core i3-1315U, Linux, Chromium 148, software rendering, DPR 2, 650×400 CSS-pixel viewport. Timing includes real rendering opportunities, not a compositor timestamp. The two-frame sample starts at the Cy mutation and excludes cold planning; planning and mutation percentiles are separate distributions, so their p95 values must not be added as an end-to-end percentile. Heap allocations are not measured. The first run exceeded its 10-minute suite limit during the dense 10k case; the retained measurements below come from the rerun with a 30-minute cap and per-fixture result logging.

Values are p50 / p95 milliseconds. These completed fixture summaries were captured before the execution environment reset; the dense case completed in a separate invocation on the same host.

| Files / total nodes / links | Node planning | Edge planning | Cy hide/show | Through two frames | Max compound displacement | Projected relationships / cache entries |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 / 1,023 / 1,000 | 0.2 / 0.4 | 0.1 / 0.2 | 34.4 / 46.2 | 204.5 / 341.2 | 2.25 | 20 / 1,043 |
| 1,000 / 1,023 / 4,000 | 0.2 / 0.3 | 1.0 / 1.4 | 54.5 / 69.0 | 513.7 / 892.9 | 2.25 | 120 / 1,143 |
| 10,000 / 10,221 / 10,000 | 2.1 / 5.8 | 1.2 / 2.4 | 406.0 / 705.4 | 2,674.8 / 5,241.8 | 6.75 | 200 / 10,421 |
| 10,000 / 10,221 / 40,000 | 2.2 / 3.7 | 10.7 / 18.1 | 578.0 / 868.8 | 4,989.6 / 10,423.7 | 6.75 | 1,200 / 11,421 |

All four rows completed 100 transitions each (400 total). The dense-only browser run ended with PASS; it also reran and reproduced the real abstraction counterexample. The dense rendering p95 exceeded ten seconds on this host, even before adding projected-edge installation. Positions restored exactly at the end; layout calls, selection changes, and data/add/remove events were zero. Camera and source-record snapshots matched. Cached-plan access rounded to 0 ms at this clock resolution; that is not proof of zero cost. Local cache references were released after each fixture. The measured compound displacement is transient, but violates a strict unchanged-position invariant and must be resolved before exposing the scope control.

Cold mapping/grouping is much cheaper than these rendering samples. Cache plain identities by revision, but do not expect caching alone to make large compound visibility transitions responsive. This lower-bound probe already argues against continuous scope stepping.

No transition performed source writes, node/edge add/remove, canonical selection changes, camera changes or layout in the **visibility experiment**. In contrast, the real abstraction probe intentionally reproduces selected-edge removal and one layout scheduling call. Those results must not be conflated. Full production scope refresh/addition/removal/replacement/accessibility tests remain blocked because no scope renderer was installed.

## Minimum extraction order and acceptance gates

1. **Read-only graph snapshot / identity seam.** Extract access to loaded hierarchy, canonical occurrences, eligibility filters and graph revisions. No file loading, link discovery, persistence or live Cy references in the snapshot/planner. Add root, external, broken-target and duplicate-occurrence tests.
2. **Pure visible-relationship planner from `rebuildVisibleEdges`.** Parameterize representative lookup; remove its “expanded targets forbidden” assumption for the proposed scope. Preserve current behavior for existing callers. Keep source mutation/renderer application outside this function. Unit-test multiplicity and selected occurrence mapping.
3. **Selection projection and proxy interaction seam.** Keep existing canonical selection authoritative; return representative/count maps; add read-only inspector/reveal behavior. Guard editing dispatch before any ambiguous proxy can reach retarget/delete/move code.
4. **Incremental renderer seam.** Separate ephemeral relationship updates from ordinary source-backed graph elements. Keep file nodes/parents/positions, and isolate the measured compound-bounds displacement; diff view edges; avoid blanket removal, endpoint-editor resets and layout scheduling. Benchmark explicit transitions and prove bounds/camera invariants with real compounds.
5. **One bounded Files/Directories control.** Extend the existing semantic owner with `scope`, retaining detail and current gestures. Add refresh-generation invalidation, tab/destroy cleanup, all four detail/scope combinations, and keyboard/accessible inspection. Only then run the full end-to-end 100-transition 1k/10k acceptance suite.

These are staged changes, not authorization inferred to refactor the entire Graph Manager in this investigation. Stop before exposing scope until stages 1–4 establish safety. No auto geometric thresholds, arbitrary clustering, saved-layout persistence or other panel-family work is needed.

## Files and validation

Investigation additions: `scripts/graph-scope-core-probe.mjs` exposes real private Core operations only inside the test server; `scripts/graph-scope-projection-probe.mjs` and its test exercise plain identity planning; `scripts/graph-scope-investigation-browser.mjs` reproduces blockers and measures real compounds. The existing `scripts/test-graph-semantic-zoom-browser.py` gains an opt-in investigation suite, and `scripts/run-browser-regression.mjs` accepts a longer timeout and saves results. Application files were not changed by this investigation.

Validation: the projection-planning, GraphSemanticZoom, panelZoomCapabilities and savedLayoutModel Node test files all pass (4/4). JavaScript syntax checks, Python runner parsing and `git diff --check` pass. The browser invocation and results are documented above. Production refresh, retained-tab lifecycle and proxy accessibility for a new scope remain acceptance gates, not completed tests of an unimplemented feature.

## Explicit conclusions

- **Can Graph Manager change structural scope without changing canonical selection?** Not safely through its current abstraction operation: Notebook selection and rendered/action selection diverge. A separate projection is feasible in the identity-planning experiment, but not yet integrated.
- **Can hidden selected entities have visible aggregates without identity replacement?** Yes as a derived mapping/count; the pure probe demonstrates it. The accessible visual indication and interaction gates remain to implement.
- **Can scope change without relayout or camera reset?** Raw file visibility preserves the camera and avoids layout, but transient compound-center displacement was measured. Existing abstraction cannot be used unchanged: it schedules layout; its public entry also centers. Complete projected-edge scope is unproven.
- **Are projected edges entirely ephemeral and source-derived?** That is the required design. The experiment's plain relationship descriptors are derived and never persisted; no new production projected edges were installed. Existing rebuilt edges are derived from records but are intertwined with editing and element replacement.
- **Is the current abstraction implementation a safe basis?** Its path/depth/reference concepts are reusable; its imperative filter/rebuild operation needs the listed seams first.
- **Is the registry sufficient after a second dimension?** Likely sufficient for explicit structured scope commands; no routing changes are indicated. This investigation did not implement a second dimension, so it does not claim empirical production validation.
