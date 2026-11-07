<!-- Nodevision/docs/TerrainPhaseA.md -->
<!-- This report documents the terrain representation repair, integration verification, measured performance, and remaining work for future terrain streaming improvements. -->

# Terrain representation repair — Phase A

Phase A repairs the existing terrain controls and runtime lifecycle. Editor controls now follow world loading and terrain selection, report preparation progress, and persist the selected representation. Viewer initialization displays the saved representation. Geometry, source preservation, authored edits, and resource disposal are checked through browser integration tests as well as unit tests. Phase B LOD and predictive streaming are **not implemented**.

## A. Root cause

The old representation widget captured the authoring bridge when mounted. Opening it before a world finished loading left its controls disabled permanently: it neither subscribed to world/selection/history changes nor refreshed the bridge. Reopening the menu appended duplicate widgets inside the dropdown instead of using the existing persistent contextual toolbar. Tests had mounted the widget manually and invoked the representation command directly after loading; they bypassed the failing toolbar lifecycle. They proved the runtime could switch, not that the normal user interaction worked.

The View entry also excluded Virtual World Viewing. The Y properties interface had no representation control and did not report the active runtime mode. Large switches retained the previous meshes until replacement was complete, but provided no chunk progress; this could look like an ineffective toggle for several seconds.

A separate collision defect compounded the inconsistency. Initializing even an empty construction list marked the terrain as construction-edited, bypassing polygonal mesh collision indefinitely. Session voxel edits similarly selected voxel collision/picking despite polygonal rendering. Collision and picking now use the active polygonal surface when available.

The earlier geographic loading defect remains fixed in the shared Editor/Viewer routes. A comment-removal regular expression treated `//` inside valid Base64 as JavaScript comments. The first destructive divergence in this fixture was at script character 148305 (148304 after trimming). Strict JSON is now parsed verbatim; the legacy comment fallback is string-aware. See [the exact loading investigation](WorldLoadingTerrainCache.md).

## B. Changes and state propagation

The existing representation control is shared between View → Terrain Representation and the terrain's Y properties. It follows the selected terrain, refreshes after world/history changes, reports preparation counts and errors, and releases subscriptions when removed. Read-only Viewer controls display the saved mode and explain why editing is disabled. Build mode uses the same authoring permissions and control; imported objects have no generated-terrain representation selector.

The propagation path is:

1. The control captures the active authoring bridge and selected generated-terrain ID.
2. The bridge validates authoring permission and the requested representation.
3. The runtime prepares replacement meshes from the same composed occupancy. Valid resident occupancy is reused; invalidated chunks are regenerated.
4. Before committing, the bridge checks that the terrain and permissions still match and records history.
5. The runtime atomically installs the prepared meshes and disposes obsolete geometries. The bridge updates the existing object's representation fields and signals the existing dirty-document mechanism.
6. The ordinary save route serializes that world definition. Reopening creates the runtime in the stored mode.

The existing nested and top-level representation fields remain synchronized for compatibility; there is no second terrain source, new world registry, or schema migration. Failure during preparation or precommit releases candidates and retains the old terrain. The existing memory budget still applies. Preparation may temporarily hold both representations.

Relevant files:

- `MetaWorld/TerrainRepresentation/Controls.mjs`, `ToolbarJSONfiles/terrainRepresentationWidget.mjs`, and `viewToolbar.json`: shared controls and real toolbar lifecycle.
- `MetaWorld/MetaWorldLayerState.mjs`, `ProceduralVoxelWorld/VoxelWorldProperties.mjs`, and `TerrainSourceSummary.mjs`: selected terrain and Y properties synchronization.
- `TerrainRepresentation/Authoring.mjs`, `ChunkRepresentation.mjs`, and `ProceduralVoxelWorldRuntime.mjs`: authoring, atomic replacement, occupancy reuse, and collision/picking.
- `TerrainRepresentation/SurfaceNets.mjs`: classify halo samples once, skip uniform cells before allocating vertices, and skip empty solid/liquid passes.
- `ProceduralVoxelWorld/VoxelChunkManager.mjs` and `ProgressiveChunks.mjs`: measured generation, installation, cache, queue, and eviction counters; no new scheduler.
- `MetaWorld/TerrainDiagnostics/`, `FpsOverlay.mjs`, `FpsOverlayStatistics.mjs`, and `GameViewDependencies/renderLoop.mjs`: optional sampled diagnostics through the existing FPS display.
- `scripts/terrain-phase-a-*.mjs`, `test-terrain-phase-a.mjs`, representation tests, and existing construction/map browser tests: regression coverage and reproducible benchmarks.

Application paths above are relative to `ApplicationSystem/public/`. New application modules remain below 200 nonblank/noncomment lines and include the required path and purpose comments. Two minimally changed pre-existing modules still exceed that guideline: `MetaWorldLayerState.mjs` and `server/routes/metaWorldAssetRoutes.mjs`. A broad split of those unrelated registries/routes was not included in this repair; this is not a claim that every dirty file now meets the length guideline.

## C. Geometry, sources, and safety

Polygonal mode uses connected surface-net geometry derived from the same three-dimensional composed voxel occupancy as voxel mode. Tests compare actual vertex/index data, fractional vertex positions, geometry identities, and disposal events—not merely the stored mode. Shared boundary positions/normals, cavities, liquids, material groups, and extraction seams have direct coverage.

Polygonal mode does not mean triangle decimation. In the small procedural benchmark both modes contained 70,468 triangles, while their geometry buffers occupied 4.70 MiB for voxels and 1.53 MiB for polygonal surfaces. Shared vertices reduce buffer storage even where triangle counts match. Actual positions differ from cube faces. Repeated switching releases obsolete geometry: the imported-model browser fixture retained nine renderer geometries over its switches; the final supplied-world UI run retained 43 renderer geometries across five alternating switches. That matched resident set had 183,674 terrain triangles in both modes, with 12.26 MiB of voxel geometry buffers versus 4.03 MiB of polygonal buffers.

The geographic source, crop, coordinate mapping, elevation scale, cached samples, and coverage rules remain authoritative. A recognizable synthetic DEM is written to GeoTIFF and passed through the import pipeline for the benchmark; the supplied Pelion HTML is loaded through production routes. Map/hybrid browser tests cover maps, biomes, source composition, edits, serialization, and imported models. Switching does not decode the GeoTIFF again or replace DEM heights with the procedural seed.

Paths, construction subtraction, authored added/removed voxels, and raised/cut terrain continue through the existing composition pipeline. Tests cover hillside path persistence, construction/road cuts, session voxel collision/picking, and switch/save/reopen behavior. GOX, STL, glTF, and GLB geometry identities remain independent of terrain replacement. World object definitions and educational associations survive serialization.

**Limits:** this is surface extraction from quantized occupancy (0.25 m in the supplied world), not direct continuous DEM triangulation. It rounds voxel corners and preserves features at the occupancy resolution; do not expect exact equality between every polygonal surface point and a raw DEM height. Collision uses the displayed polygonal triangles once streamed. Existing analytic ground fallback remains available during streaming, but predictive collision availability and complete body collision ahead of unloaded chunks are not solved here. Polygonal terrain is not a distant-terrain LOD.

All source-world operations use temporary copies. The original `Notebook/test.html` remains unchanged, SHA-256 `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`.

## D. Performance findings

Machine-readable results: [TerrainPhaseABenchmarks.json](TerrainPhaseABenchmarks.json). Measurements were captured on November 3, 2026, in the Linux x86-64 VM with Node 24.21.0 and Chromium 156.0.8078.47 using SwiftShader software rendering. Electron 42.2.0 was also attempted, as described below.

The before comparison loads five original runtime/mesher modules from revision `0b7a0e8e6e08b8ed1e51639b6469e0e3332b2aef` into the same harness. This isolates runtime changes; it is not a successful reproduction of the old toolbar UI. The viewport is 640 × 480, initial chunk radius 1 (8 m). Each observation has 60 stationary frames followed by 60 frames moving +X at 0.25 m/frame, nominally 15 m/s at 60 FPS. A separate probe uses the maximum radius 8 (64 m), moving 0.5 m/frame for 120 frames.

These are single sequential trials with warm module/material/browser caches and order effects. Startup means runtime construction, not application launch or network loading. Polygonal startup uses a fresh runtime after the earlier work. Throughput is completed chunks during the observation interval, not maximum generation capacity. Frame durations include software rendering and browser scheduling. Counters are cumulative at each snapshot. Geometry memory counts typed buffers, not driver allocation; scene draw calls include non-terrain objects. Resident sets may differ after movement, so unequal triangle totals across those rows are not a matched-set simplification ratio. A few outliers can put the mean above the 95th percentile.

### Before/after switching and initial fill

All values below are milliseconds. Each pair is **before → after**. All initial fills completed.

| World | Switch to polygonal | Return to voxel | Initial voxel fill | Fresh polygonal fill |
|---|---:|---:|---:|---:|
| Small procedural | 3238.5 → 1620.9 | 484.1 → 350.7 | 681.9 → 630.7 | 5396.6 → 2633.2 |
| Synthetic GeoTIFF | 1369.7 → 838.7 | 403.8 → 103.1 | 1132.1 → 1053.1 | 2416.8 → 1433.2 |
| Pelion | 6249.8 → 4763.0 | 2045.4 → 1544.6 | 5464.0 → 5452.5 | 15015.0 → 8858.5 |
| 4 km procedural | 4283.3 → 2134.5 | 763.5 → 1147.6 | 597.4 → 575.9 | 6443.1 → 3630.0 |
| Excavation + objects | 5796.6 → 2487.0 | 4462.1 → 2429.7 | 777.7 → 910.0 | 7149.8 → 5146.1 |

Polygonal preparation became faster in all five runs. Returning the 4 km world to voxels became slower in this trial; these data do not justify a universal speedup claim. The mesher avoids repeated classification and empty passes, and valid occupancy is reused for replacement meshes. Neither optimization increases the physical render radius.

### Current runtime startup and frame observations

Startup, first-visible, and frame values are milliseconds. Frame columns are **mean / p95**.

| World | Mode | Startup | First visible | Stationary frames | Moving frames | Chunks/s |
|---|---|---:|---:|---:|---:|---:|
| Small procedural | voxel | 143.8 | 192.8 | 16.7 / 16.8 | 16.9 / 16.8 | 4.5 |
| Small procedural | polygonal | 2.0 | 289.6 | 16.9 / 16.8 | 16.7 / 16.7 | 4.5 |
| Synthetic GeoTIFF | voxel | 5.3 | 176.3 | 16.7 / 16.8 | 16.7 / 16.8 | 1.5 |
| Synthetic GeoTIFF | polygonal | 6.7 | 193.0 | 16.7 / 16.7 | 16.7 / 16.8 | 1.5 |
| Pelion | voxel | 36.4 | 241.2 | 16.9 / 16.8 | 20.8 / 33.4 | 3.9 |
| Pelion | polygonal | 43.8 | 277.2 | 24.7 / 33.4 | 21.1 / 33.4 | 4.7 |
| 4 km procedural | voxel | 0.9 | 24.4 | 16.7 / 16.7 | 17.8 / 33.4 | 6.8 |
| 4 km procedural | polygonal | 1.2 | 152.8 | 18.9 / 33.4 | 18.3 / 33.3 | 6.2 |
| Excavation + objects | voxel | 1.0 | 87.1 | 16.9 / 16.8 | 18.6 / 33.3 | 4.2 |
| Excavation + objects | polygonal | 3.0 | 444.2 | 17.5 / 33.3 | 17.8 / 33.4 | 3.8 |

### Current geometry and rendering observations

| World | Mode | Terrain triangles | Geometry MiB | Scene draw calls |
|---|---|---:|---:|---:|
| Small procedural | voxel | 70,468 | 4.70 | 40 |
| Small procedural | polygonal | 70,468 | 1.53 | 40 |
| Synthetic GeoTIFF | voxel | 46,256 | 3.09 | 24 |
| Synthetic GeoTIFF | polygonal | 46,256 | 1.00 | 24 |
| Pelion | voxel | 97,998 | 6.54 | 43 |
| Pelion | polygonal | 108,238 | 2.38 | 48 |
| 4 km procedural | voxel | 83,386 | 5.57 | 49 |
| 4 km procedural | polygonal | 71,292 | 1.59 | 43 |
| Excavation + objects | voxel | 81,860 | 5.46 | 47 |
| Excavation + objects | polygonal | 81,860 | 1.78 | 47 |

Full before/after frame, geometry, startup, and queue measurements are retained in the JSON rather than selectively discarded.

### Observed bottlenecks and diagnostic interpretation

For current Pelion after the polygonal observation, cumulative CPU work was approximately 622 ms generating occupancy, 1,696 ms meshing, and 40 ms installing meshes. Extraction is the largest measured part of this breakdown. Baseline meshing included installation, while current counters separate it; GPU execution is not included in either figure. Raster import/decode is not repeated on switching.

At maximum distance, the current Pelion probe ended with 74 active chunks, 12 queued chunks, and 168 queued columns, alongside 47 evictions, 10 cancellations, 196 requests, 218 resident hits, and 196 misses. The current 4 km probe still had 159 queued columns and 88 active chunks. These cumulative observations show that increasing the radius does not make detailed terrain available immediately. The existing chunks are only 8 m wide, and the maximum radius is only 64 m, insufficient for mountain silhouettes.

The main-thread progressive loop retains its roughly 4 ms work budget and at most one completed chunk per update. Actual maximum update measurements reached 7.4 ms in the Pelion maximum-distance probe and 9.3 ms in the 4 km probe: an individual work unit can exceed the nominal budget. No terrain worker queue or worker transfer currently exists. Mesh extraction, limited completion throughput, and repeated movement-driven eviction/cancellation are observed; the benefit of a future predictive scheduler or workers remains a hypothesis to benchmark. Software rendering also contributes frame cost, so these numbers cannot establish desktop GPU speedups.

The FPS overlay samples at its existing 250 ms text cadence. Frame diagnostics use a bounded 180-sample buffer, aggregating every 15 samples; disabling diagnostics avoids repeated sample allocation. Snapshots distinguish queued chunks from unexpanded columns, prepared replacement meshes from active meshes, and active/drawable/frustum-visible chunks. The active camera is used for visibility. Installation is CPU scene setup; awaiting-first-render marks meshes not yet submitted by a render callback. It is not proof of GPU completion. GPU upload duration and worker queue latency are explicitly unavailable (`null`). Old baseline counters absent from the implementation are also `null`, not measured zero.

The final additive level-query timing and first-render counters were added after the benchmark module had loaded; they are available in live diagnostics and native integration verification, but are not retroactively supplied as measurements in this benchmark artifact.

## E. Regression verification

Completed checks:

- The combined Node suite passed all **31 test files** covering representation, diagnostics, geographic sources, procedural worlds, paths, constructions, session voxels, maps, and FPS overlay. Representation tests include seams, cavities/liquids, occupancy reuse, mesh collision after empty construction initialization, and resource disposal. Switch-safety tests cover budget/precommit rollback and authored voxel collision/picking.
- `python3 scripts/test-terrain-representation-browser.py` passed, including imported GOX/STL/glTF/GLB identities, repeated switching, history, and resource counts.
- `python3 scripts/test-terrain-maps-browser.py` passed, including authored/hybrid source preservation, materials, biomes, collision, settings, persistence, and associations.
- `python3 scripts/test-constructions-browser.py` passed **54 checks**, including representation changes after construction/road excavation.
- `node scripts/test-terrain-phase-a.mjs Notebook/test.html` passed the real toolbar lifecycle, pre-load menu opening, actual geometry replacement, repeated resource cleanup, hillside path persistence, permissions, undo/redo, and production save/reopen route checks.
- `NV_TERRAIN_NATIVE=1 node scripts/test-terrain-phase-a.mjs Notebook/test.html` passed using production `GameView.setupPanel`, the actual toolbar and Y properties host, active render loop, FPS sampling, Editor switching, production save, and read-only Viewer reopen.
- `NV_TERRAIN_BENCH=1 node scripts/test-terrain-phase-a.mjs Notebook/test.html` completed all **20 before/after scenario/mode rows** and maximum-distance probes.
- Final focused diagnostics/FPS tests, JavaScript syntax checks, and `git diff --check` passed. The source HTML hash matches the original.

Reproduce the combined unit suite with:

```sh
node --loader ./scripts/html-test-loader.mjs --test --test-concurrency=2 \
  ApplicationSystem/public/MetaWorld/TerrainRepresentation/*.test.mjs \
  ApplicationSystem/public/MetaWorld/TerrainDiagnostics/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Geographic/*.test.mjs \
  ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Paths/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Constructions/*.test.mjs \
  ApplicationSystem/public/MetaWorld/SessionVoxels/*.test.mjs \
  ApplicationSystem/public/MetaWorld/TerrainMaps/*.test.mjs \
  ApplicationSystem/public/FpsOverlay.test.mjs
```

The browser runner copies the supplied world into a temporary Notebook, serves production loading/saving routes, traces the actual JSON parser input, and checks that the supplied file is unchanged. It does not replace these routes with a canned world response. Browser results are written under `/tmp/nodevision-terrain-phase-a*`; copy benchmark results before running another variant because they share an output path. The checked-in benchmark artifact is the completed benchmark run, not a later UI run.

**Desktop limitation:** the actual Electron entry point and server started under Xvfb, but GPU command-buffer errors and repeated Chromium shared-memory failures under `/tmp` prevented a reliable interactive desktop run. The automated desktop harness did not complete; there is no claimed Electron screenshot or successful Electron save/reopen verification. The closest verified workflow is the production GameView/toolbar/render loop running in real Chromium. Hardware Electron behavior still needs a smoke test on the user's desktop.

## F. User walkthrough

1. Open a copy of your geographic HTML world in **Virtual World Editing** and let its terrain initialize.
2. Select the generated terrain in the world/layer selection. Open **View → Terrain Representation**; its contextual toolbar contains **Generated terrain** and **Terrain representation** selectors. Choose the intended terrain if the world contains more than one. Alternatively, press **Y** for the selected terrain's properties and use its representation selector.
3. Choose **Polygonal**. During preparation the status reports completed/total chunks. The previous terrain remains visible until replacement is ready. At close range, verify connected surfaces with rounded voxel corners. Y properties report the active representation and the retained geographic source.
4. Choose **Voxel** to restore the block surfaces. Imported models remain in their own native representation.
5. Save with the normal Save action or Ctrl+S. Close and reopen in **Virtual World Viewing**; it displays the saved representation. Its control is read-only. Return to an editable world to change and save the mode again.
6. Enable **View → Show FPS**. Read frame time alongside representation, physical render distance, active/visible/queued chunks, CPU generation/meshing/installation, triangles, draw calls, and estimated geometry memory. A large column queue means distant work has not yet expanded into individual chunks. A low visible count is different from a low resident count.
7. For a machine-readable capture in developer tools, evaluate `window.NodevisionFpsOverlay.terrainSnapshot()`. Compare equivalent camera paths and settled resident sets; do not interpret geometry-buffer bytes as total GPU memory or CPU installation as GPU upload time.

There is no new editor, wizard, inventory tool, or dedicated representation keyboard shortcut.

## G. Recommendations for Phase B

These are recommendations only:

- Build coarse geographic heightfield coverage early, from the retained DEM cache, so distant silhouettes appear before detailed volumetric chunks. Preserve coverage/NoData rules and source transforms.
- Keep composed voxels and collision near the player; introduce simplified intermediate and coarse distant surfaces. Non-heightfield edits need appropriate volumetric extraction near authored features rather than silently disappearing into a heightfield.
- Key reusable meshes by content revision, representation, and future detail level. Keep occupancy and mesh budgets explicit, account for temporary replacements, and invalidate only affected content. The current source/runtime/mesher split already provides the starting boundary; no new world registry is needed.
- Prioritize current visibility and the movement corridor, retain useful resumable work across chunk-center changes, and measure cancellation/eviction churn. Benchmark worker generation and transferable buffers against the observed extraction cost before committing to a worker architecture.
- Prioritize near collision independently from visual detail and preload it along routes; retain a documented fallback while authoritative collision is unavailable.
- Use compatible boundaries or explicit transition meshes/skirts between detail levels, test seams under edits, and budget overlap during transitions. Add hysteresis to prevent repeated level changes at distance boundaries.

The benchmark and live diagnostics now provide a reproducible starting point for those decisions. No LOD bands, simultaneous terrain detail levels, predictive prefetching, or replacement streaming scheduler were added in Phase A.
