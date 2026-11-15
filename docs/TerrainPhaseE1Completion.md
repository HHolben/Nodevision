# Phase E1 rendering investigation

Implemented and measured in Chromium SwiftShader. This is not verification of the user's hardware FPS target. Phase E2 tree geometry is outside this task.

The follow-up investigation below uses the existing E1 implementation as its baseline. Earlier tables compare against the pre-batching implementation and must not be used to attribute an incremental follow-up improvement.

## A. Root-cause analysis

The repeated isolation test uses a settled infinite world, seed 42, polygonal detail, an 8 m detail radius, 512 m distant terrain and 128 m vegetation. All preparation queues drain before sampling. Each trial warms up for 60 frames and samples 120 frames. Three trials reverse the order of the controlled rendering conditions.

[Raw isolation measurements](TerrainE1Isolation.json) establish the following in **Chromium SwiftShader**, not the user's GPU:

| Condition | Mean frame time across trials (ms) | Driver elapsed query across trials (ms) |
| --- | --- | --- |
| Neither distant layer | 16.8, 16.7, 16.9 | 4.4, 3.8, 5.9 |
| Terrain only | 23.2, 22.6, 22.8 | 19.0, 18.6, 18.8 |
| Vegetation only | 39.2, 44.8, 41.0 | 34.7, 40.0, 36.3 |
| Both | 62.3, 57.5, 67.7 | 56.5, 52.4, 62.1 |
| Both with basic shading | 59.4, 59.0, 57.3 | 54.0, 53.6, 52.0 |
| Both at half width/height | 57.3, 52.3, 49.6 | 53.0, 48.3, 45.7 |
| Both without runtime updates | 62.6, 62.2, 57.4 | 57.5, 56.7, 52.4 |

Settled runtime updates are approximately 0.05–0.08 ms, versus tens of milliseconds of driver execution. The first both-enabled trial submits 129 draws and 74,354 triangles, versus 9 draws and 12,758 triangles with neither distant layer. Disabling updates barely changes the result. Basic shading and reduced pixel count help only modestly. This points to submitted geometry/draw work as a substantial component; it does not conclusively separate vertex processing, primitive setup and per-draw driver overhead. Fragment cost is not zero. Timer queries measure asynchronous execution on a software graphics backend and are not hardware GPU benchmarks.

The existing ownership-revision guards already avoid settled mask reconstruction. Further generation caching would not address these measurements. The prior bounded polygonal CPU cache remains unchanged.

## B. Changes made

- `TerrainDiagnostics/GpuTimer.mjs`: optional WebGL2 elapsed queries, at most four outstanding, availability polling without blocking, explicit null results when unavailable, and invalidation for disjoint/lost/disabled contexts.
- Production `GameViewDependencies/renderLoop.mjs`: separate CPU update/submission timing and optional driver queries through the existing FPS toggle; cleanup releases outstanding queries.
- `TerrainDiagnostics/Frames.mjs`, `Snapshot.mjs`, `SceneSubmission.mjs`: p99/max frame times, driver-query status, visible distant meshes, material groups, estimated instances and indexed vertex references. Estimates are distinct from renderer counters. Upload bytes and unsupported measurements remain null.
- `Rendering/ColorBatches.mjs`, `TerrainLOD/TileMesh.mjs`, `VegetationLOD/Instances.mjs`: compatible opaque materials can share a draw batch, carrying original linear base colors as vertex/instance attributes. Different roughness, transparency, textures, custom shader hooks and other serialized render state retain separate paths.
- `VegetationLOD/Runtime.mjs`: conservative buffer accounting includes color attributes.

Geometry, source samples, masks and tree identities are unchanged by material batching. Owned materials dispose with their tile/region; shared canonical palette materials remain owned by the terrain runtime. Additional color attributes consume 12 bytes per vertex/colored instance; memory budgets are still enforced. This is a memory-versus-submission tradeoff, not free compression.

The principal additional change is `VegetationLOD/FrustumInstances.mjs`: regional instanced meshes previously submitted all owned boxes whenever any part of their region intersected the frustum. Conservative per-box spheres now omit wholly off-frustum boxes, retaining the complete ownership list and full regional bounding sphere. Turning back restores those boxes, including regions whose submitted count reached zero. World transforms and scale are included. Camera/projection/world revisions skip stationary scans; unchanged selected lists skip instance-buffer rewrites. Counters distinguish CPU buffer rewrites from unavailable actual GPU upload-byte measurements.

`Runtime.mjs` and the shared production render loop prepare these instance lists **before** `renderer.render`, because Three.js uploads instance attributes before `onBeforeRender`. Stereo/XR, disabled frustum culling, displacement and custom vertex shaders retain full-owner submission. This preserves conservative visibility where ordinary box bounds cannot describe the rendering. Source occupancy, collision and generation remain independent of this visual filter.

Two profiling-only experiments were rejected. [Paired-skirt filtering](TerrainE1SkirtExperiment.json) reduced submitted triangles from 74,354 to 56,286 but had mixed paired timings (45.73→37.43, 54.20→62.49, 54.37→46.15 ms). Production retains all original skirts and detail handoff. [Global instance batching](TerrainE1InstanceExperiment.json) reduced draws from 105 to 48 but lost spatial culling, increased triangles from 74,354 to 122,378 and roughly doubled frame time (56.07→113.83, 61.84→110.21, 60.37→116.09 ms). Regional grouping is retained. Neither experiment changes production tree geometry.

## C. Benchmark methodology

The [comparison dataset](TerrainE1Comparison.json) covers 50×50 m, 1000×2000 m, infinite procedural, infinite forest and the actual saved geographic world. Both appearances and all four independent distant-layer combinations are tested. Every case creates a fresh runtime, drains queues and warms up for 45 rendered frames. The initial batching comparison sampled 180 settled frames and 24 frames per movement phase. The final comparison samples 180 settled/24 movement frames for the repeated large/infinite polygonal both-layer cases and 120 settled/12 movement frames for the other configurations. The final trace also explicitly tests turning. Movement is frame-stepped, not a real-time player speed. Teleport, negative and far relocations apply only to infinite cases.

Large and infinite polygonal scenes with both distant layers run three independent paired trials, alternating baseline/modified order. Other configurations have one pair; their timing differences are diagnostic, not a statistical performance guarantee. Viewport is 640×480, camera pose/settings are identical within pairs. The forest anchor is 512 m; ordinary procedural views use 20 m. Geographic views use a covered diagonal coordinate. Cold preparation time is separate from settled timing and is not cold-render FPS.

The exact pre-batching modules and hashes are retained in [baseline sources](TerrainE1BaselineSources.json), including the prior Phase E improvements. The runner materializes those modules in a temporary directory and shares unchanged modules between variants. It never rewrites Notebook files.

The original browser reached its 30-minute runner timeout after 49 records. Resume discards the incomplete pair and retains the first 48 records. Subsequent pairs are a separate browser run. Do not combine the interrupted half-pair with the resumed half. GPU measurements are asynchronously delayed; they are not exact CPU-frame/GPU-frame correlations. Original-run first GPU readings can include the previous phase's pending result; resumed cases explicitly clear pending measurements at case boundaries.

A separate 160×120 offscreen readback compares paired rendered images outside the measured frame windows. It records changed color pixels and changed non-background coverage pixels. This is a limited fixed-view screen-space check, not a complete proof of world coverage or occlusion behavior. Geometry and ownership tests supply independent checks. Readback intentionally synchronizes the driver outside timing; the normal render loop never performs it.

Commands:

```sh
node scripts/test-terrain-e1-isolate.mjs docs/TerrainE1Isolation.json
node scripts/test-terrain-e1-compare.mjs docs/TerrainE1Final.json
node scripts/test-terrain-e1-isolate.mjs docs/TerrainE1SkirtExperiment.json skirts
node scripts/test-terrain-e1-isolate.mjs docs/TerrainE1InstanceExperiment.json instances
node scripts/profile-terrain-e1-electron.cjs
```

The comparison resumes an existing output file; use a new output filename for a fully fresh matrix. Do not run competing benchmarks concurrently.

## D. Before/after results

Material batching alone reduced draws but did not consistently improve infinite-world frame times: baseline 37.60/47.09/45.75 ms versus modified 46.19/45.66/48.73 ms. These are the earlier [batching-only results](TerrainE1Comparison.json), not the final implementation.

The subsequent [focused culling comparison](TerrainE1CullingFocus.json) improved every repeated large/infinite pair. The independent [final full matrix](TerrainE1Final.json) measures batching plus fine culling. Detailed final tables follow below. Three trials support repeatability in this environment, not a tight confidence interval or a hardware performance guarantee. Coarse terrain alone remains expensive: in the final large polygonal case it changed 28.1→28.3 ms despite reducing draws 111→73; geometry remained 66,966 triangles. Vegetation alone improved 40.1→29.4 ms (38,066→29,150 triangles). Thus the verified improvement primarily comes from reducing invisible vegetation geometry, rather than eliminating the remaining coarse-terrain cost.

## E. Correctness

Material compatibility is checked independently from source material identity. Colors are preserved as linear attributes; canonical material IDs remain in authoritative occupancy, collision and source data. Detailed geometry and cached Surface Nets remain unchanged. Coarse masks still hide sections only after detail is ready, and visible instance packing retains chunk ownership. No geometry is made authoritative for collision merely by batching it.

Only purely procedural sources can be infinite. Map/geographic coverage, crops, NoData, composition, paths, construction excavation and session voxel semantics are unchanged. Neither source metadata nor saved schema changes. The original Notebook fixture is read-only; destructive persistence tests use temporary copies.

## F. Regression testing

Focused new tests pass for timer availability, bounded outstanding queries, disjoint/lost/disabled cleanup, compatible/incompatible material state, color preservation, section masks, chunk handoff and owned/shared resource disposal. All 251 MetaWorld tests pass (zero failures/skips). Production integrations passed after timing: actual GameView render loop and diagnostics, Editor save/Viewer reopen, extent validation and undo/redo, negative-coordinate streaming and collision/editing, linked construction excavation and paths, map source persistence and imports, and teleporter primary/controller input, cancellation, coarse/detailed landings, physics and cleanup. Production persistence checks use temporary Notebooks. The map/import suite separately hosts real terrain modules with mocked workspace/toolbar and API services; it is not a complete native application test. See [validation evidence and final source hashes](TerrainE1Validation.json).

Native Electron graphics probing is separate from Chromium production-UI integration. The environment has no `/dev/dri` device. The actual Electron 42.2.0 probe launched with ELECTRON_RUN_AS_NODE removed, but WebGL2 was blocklisted/unavailable and returned no context. Consequently no native desktop FPS result is available; headless SwiftShader is not the user's graphics hardware.

## G. Remaining limitations

Do not claim 60 FPS on the user's hardware. Existing distant trees retain their current box-based LOD geometry. Coarse-terrain-only execution cost remains unresolved. The rejected global batching experiment demonstrates why draw reduction alone is insufficient. Further terrain geometry organization or hierarchical culling needs independent measurement and coverage validation. Workers would not directly fix the settled graphics cost measured here. GC, exact overdraw, hardware vertex/fragment counters and actual upload bytes remain unavailable rather than inferred from CPU submission.

## H. User verification

1. In the Virtual World Editor, use **Insert → Voxel World** with seed 42 and dimensions 1000×64×2000 m. Use **World Extent → Infinite** for the infinite comparison; map-based worlds retain source-defined finite extent.
2. Select the terrain and open **View → Terrain Representation**; select **Polygonal**. Use the existing detail/render-distance control consistently between comparisons.
3. Enable **Show distant terrain** and **Show distant vegetation**, set terrain visibility to 512 m and vegetation visibility to 128 m, and select **Apply landscape settings**.
4. Enable **View → Show FPS**. Wait for queues to drain. Record frame time, CPU update/submission, driver query time where supported, draw calls and cache counters.
5. Compare the four distant-layer combinations from the same stationary camera. Then walk, backtrack, turn and repeat. Repeat in **Voxel** mode. Preserve identical visibility settings and camera pose when comparing builds.
6. Save and reopen in the Viewer. Both use the shared production renderer, diagnostics and terrain runtime. Cache contents and profiling data are temporary, not serialized world data.

## Final measured results

All 88 records completed with drained queues before stationary sampling. All 44 paired images had zero changed coverage pixels; at most two of 19,200 pixels differed in color. This does not substitute for full-world coverage testing.

Repeated polygonal trials with both distant layers enabled (milliseconds):

| World | Variant | Trial | Mean | p95 | p99 | Driver mean | Update mean | Submission mean | Draws | Triangles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| large | baseline | 1 | 62.50 | 70.70 | 80.00 | 57.261 | 0.081 | 1.671 | 176 | 92274 |
| large | modified | 1 | 52.32 | 62.40 | 69.60 | 47.230 | 0.092 | 1.677 | 130 | 83358 |
| large | modified | 2 | 52.61 | 61.40 | 71.20 | 47.212 | 0.069 | 1.837 | 130 | 83358 |
| large | baseline | 2 | 63.15 | 69.70 | 77.70 | 57.502 | 0.079 | 1.599 | 176 | 92274 |
| large | baseline | 3 | 63.53 | 71.50 | 105.60 | 58.192 | 0.082 | 1.765 | 176 | 92274 |
| large | modified | 3 | 52.58 | 61.00 | 71.70 | 47.344 | 0.083 | 1.648 | 130 | 83358 |
| infinite | baseline | 1 | 54.21 | 59.30 | 78.90 | 49.148 | 0.078 | 1.677 | 129 | 74354 |
| infinite | modified | 1 | 44.11 | 49.40 | 78.70 | 38.617 | 0.063 | 2.237 | 102 | 65438 |
| infinite | modified | 2 | 44.04 | 49.80 | 63.90 | 38.921 | 0.058 | 1.833 | 102 | 65438 |
| infinite | baseline | 2 | 52.98 | 57.20 | 59.30 | 48.141 | 0.076 | 1.650 | 129 | 74354 |
| infinite | baseline | 3 | 53.38 | 57.80 | 63.50 | 48.611 | 0.061 | 1.575 | 129 | 74354 |
| infinite | modified | 3 | 42.82 | 47.10 | 48.20 | 37.700 | 0.071 | 1.873 | 102 | 65438 |

Paired mean-frame reductions are 16.3–17.2% for large worlds and 16.9–19.8% for infinite worlds. Submission CPU time does not show a corresponding reliable reduction; driver execution does. Walking means improve in all repeated pairs: large 64.5–65.5→54.9–57.4 ms, infinite 54.8–56.2→48.7–49.5 ms. Walking p95 ranges are 71.5–74.5→63.3–69.4 ms and 62.9–65.6→57.2–60.9 ms respectively. Turning maxima improve 72.8–83.8→61.0–65.8 ms (large) and 74.3–156.3→65.7–67.4 ms (infinite). Short movement samples remain noisy and do not establish elimination of generation stalls. Raw records retain backtracking, teleport, negative and far traces.

Single-pair both-layer stationary results (exploratory):

| World | Appearance | Baseline mean ms | Modified mean ms |
| --- | --- | --- | --- |
| small | voxel | 22.77 | 18.13 |
| small | polygonal | 20.06 | 16.49 |
| large | voxel | 62.65 | 53.12 |
| large | polygonal | 62.50 | 52.32 |
| infinite | voxel | 56.32 | 43.08 |
| infinite | polygonal | 54.21 | 44.11 |
| forest | voxel | 52.77 | 47.20 |
| forest | polygonal | 52.58 | 47.26 |
| geographic | voxel | 18.57 | 20.25 |
| geographic | polygonal | 18.69 | 19.04 |

Resident counts are end-of-trace snapshots, not stationary or peak GPU allocations. Large repeated cases finish with 87–88 geometries, detailed byte estimates of 3.87–4.19 MB, and vegetation estimates 488,832→580,488 bytes. Infinite repeated cases finish after far relocation with six geometries, 245,144 detailed bytes and 25,280→30,020 vegetation bytes; streaming is still pending at this endpoint. These numbers must not be interpreted as fully settled infinite-world memory. Color storage increases memory; existing coarse budget enforcement, 8 MiB vegetation budget and 32 MiB/128-entry CPU mesh cache remain enforced. Temporary culling arrays scale with resident instances, not travel history.

The short rendered backtracking traces show zero cache hits in these repeated cases, so they do not establish cache speedup. The separate deterministic Phase E route benchmark (6,003→35 ms, 168 hits) and cache regression tests remain the evidence for reuse. Settled phases perform no new generation in these cases. Source-defined map extents and geographic NoData never receive procedural extension.

## Validation commands and integrity

```sh
npm run test:metaworld
NV_TERRAIN_NATIVE=1 node scripts/test-vegetation-phase-c.mjs Notebook/test.html
node scripts/test-world-extent.mjs
python scripts/test-terrain-maps-browser.py
node scripts/test-raycasting-teleporter.mjs
git diff --check
sha256sum Notebook/test.html
```

The source fixture remains SHA256 `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`. All 23 dirty native application modules satisfy the path/description headers and fewer-than-200 code-line limit. Final source hashes include the retained earlier Phase E changes. GPU metadata in the comparison JSON files was corrected to describe the existing per-phase elapsed queries; measured samples were not altered. The final matrix completed in one run. The retained earlier batching-only matrix has the resume limitation described above.

## Follow-up: test resolution and coarse vertex reuse

The five import failures were Node test-environment failures. Browser adapters correctly import application URLs such as `/MetaWorld/WorldAuthoringPermissions.mjs`; the HTTP application serves those URLs, whereas plain Node interprets them as filesystem paths. Resolving that first namespace also exposed legitimate `/PanelInstances/` and `/Equation/` imports in its dependency graph. Production imports and serving behavior are unchanged.

`scripts/register-browser-test-imports.mjs` uses Node's synchronous module hooks, anchored to the application's public directory rather than the working directory. Only imports from application modules into existing public namespaces are mapped; unrelated filesystem paths retain Node resolution. `npm run test:metaworld` discovers the entire MetaWorld suite and installs this resolver. This command requires a Node version supporting `registerHooks`; verification uses Node 24.21.0. The old plain `node --test` command omitted the necessary browser namespace configuration. Historical individual-test counts above and current file-level runner totals are different reporting units.

One additional intermittent residency assertion depended on a fixed number of updates while distant streaming uses a wall-clock work budget. Its fixed-update test now explicitly disables the distant layers to exercise the one-chunk scheduler it asserts against. The existing terrain streaming tests continue to cover the bounded progressive scheduler. The full configured suite passes all 56 test files, including astronomy, canonical materials, biomes, water, sandbox planning and the new coarse-vertex tests.

The existing E1 implementation already provides material batching, fine vegetation frustum filtering, stable ownership revisions, bounded CPU mesh caching and graphics elapsed queries. None of those was reimplemented. A profiling-only candidate in `scripts/terrain-e1-vertex-tile.mjs` lets repeated coarse vertices share an index when their complete position, normal, derived UV and linear color agree. Triangle order, counts, skirts, colors, sections, source samples and ownership masks are preserved. Custom shader hooks retain the original per-face vertex identity. Existing byte accounting remains conservative; no cache budget is increased.

The new `TerrainLOD/VertexReuse.test.mjs` tests the profiling candidate and expands indexed draws into their original ordered attribute stream. Near/far resolution, signed coordinates, incomplete source coverage, water, color boundaries, independent section hiding/restoration, resource ownership and custom shader hooks are checked. The candidate reduces storage and vertex inputs; it does not remove coarse triangles, change tree geometry or make visual geometry authoritative for physics. It was rejected for production after measurement, as detailed below.

The follow-up baseline is **the previous E1 implementation**, including vegetation frustum filtering. [Baseline sources and shared-module hashes](TerrainE1FollowupBaselineSources.json) retain the previous tile builder, the measured candidate and 229 shared source hashes. The comparison runner validates shared sources. Its baseline import map shares Three.js identity with the modified variant; a startup assertion enforces this. An initial runner without that map loaded a second Three.js prototype and incorrectly disabled baseline material batching. Those exploratory measurements were discarded. Valid stationary comparisons require identical actual draw and triangle counts and identical fixed-view pixels.

Follow-up reproduction commands:

```sh
npm run test:metaworld
node scripts/test-terrain-e1-followup.mjs /tmp/terrain-e1-fresh.json
node scripts/analyze-terrain-e1-followup.mjs /tmp/terrain-e1-fresh.json
node scripts/test-terrain-e1-isolate.mjs /tmp/terrain-e1-vertices.json vertices
```

Run the browser measurements sequentially, with no concurrent tests or other benchmarks. The production persistence regressions use temporary Notebooks; the supplied `Notebook/test.html` remains read-only.

### Follow-up measurements and decision

**The coarse vertex reuse candidate is rejected for production.** It substantially reduces attribute storage, but neither the longer movement matrix nor the same-scene isolation establishes a repeatable rendering gain across large and infinite worlds. `TerrainLOD/TileMesh.mjs` is restored byte-for-byte to its prior E1 implementation. Both follow-up runners explicitly opt into the retained profiling candidate; ordinary Editor/Viewer execution does not import it. The earlier E1 batching, vegetation frustum filtering and mesh cache remain intact.

[Full incremental matrix](TerrainE1Followup.json), [validated paired summary](TerrainE1FollowupSummary.json), [same-scene isolation](TerrainE1VertexIsolation.json) and [isolation summary](TerrainE1VertexIsolationSummary.json) retain all final results.

The matrix contains 32 fresh-runtime cases: large and infinite polygonal worlds, all four terrain/vegetation settings, three alternating pairs for terrain-enabled cases and one pair for each control. Every case drains preparation queues, warms up for 60 frames, measures 240 stationary frames, then 120 each walking, running and backtracking. Across three trials that is 720 stationary and 360 frames per movement phase per variant/terrain-enabled configuration. Movement is frame-stepped at 0.06 and 0.18 m/frame; it is not a hardware player-speed benchmark. Viewport is 640×480 at pixel ratio 1. GPU elapsed samples are recorded only on newly completed queries, and are asynchronous software-driver measurements rather than exact frame correlations.

The initial run experienced a host suspension: one running interval reached **1,004,261 ms**. The 30-minute runner then timed out with 30 saved cases. The [interrupted run](TerrainE1FollowupInterrupted.json) is retained as evidence, **not as a valid performance result**. The entire affected large/both/trial-2 pair was removed, leaving 28 valid records. Both variants of that pair and of the unfinished infinite/both/trial-2 pair were rerun in a fresh browser. No half-pair crosses browser runs; no frame outliers were trimmed. The final analyzer rejects intervals over five seconds, incomplete data, duplicate cases, mismatched stationary renderer counters and changed paired pixels.

Stationary frame means, prior E1 → candidate, in milliseconds:

| World / distant layers | Trial 1 | Trial 2 | Trial 3 |
| --- | ---: | ---: | ---: |
| large / terrain only | 25.80 → 24.12 | 26.40 → 23.97 | 24.64 → 24.58 |
| large / terrain + vegetation | 47.08 → 46.41 | 46.55 → 45.88 | 46.43 → 50.55 |
| infinite / terrain only | 25.31 → 23.88 | 21.69 → 22.08 | 24.76 → 28.89 |
| infinite / terrain + vegetation | 49.44 → 46.80 | 47.60 → 51.53 | 52.67 → 43.37 |

The unchanged vegetation-only control moved 26.79→27.21 ms in the large world and **45.01→33.10 ms in the infinite world**, although the candidate builder is inactive in both conditions. Both-off controls remain approximately 16.6 ms. This is direct evidence of substantial host/software-driver variation; selecting only favorable terrain-enabled pairs would overstate the optimization.

Movement means across the three paired trials (ranges, ms; ranges are not confidence intervals):

| World / layers | Walking: prior → candidate | Running: prior → candidate | Backtracking: prior → candidate |
| --- | --- | --- | --- |
| large / terrain only | 27.0–28.1 → 26.3–26.8 | 29.2–30.5 → 29.0–29.5 | 32.5–33.2 → 31.4–33.0 |
| large / both | 49.8–57.7 → 49.6–80.9 | 51.8–58.8 → 51.4–58.9 | 63.0–81.8 → 62.5–91.2 |
| infinite / terrain only | 24.9–27.1 → 23.0–27.2 | 26.9–29.5 → 26.5–28.2 | 31.3–33.3 → 31.3–36.1 |
| infinite / both | 56.3–63.3 → 49.4–57.5 | 54.1–57.8 → 54.9–56.5 | 62.6–70.5 → 72.0–72.8 |

Raw records retain p95, p99, maximum, generation/meshing CPU, preparation, rendering submission, vegetation view preparation, cache hits and LOD planning/masking costs. Movement changes the amount of detail work completed within each frame budget; these traces do not prove removal of generation stalls or identical per-frame residency. Backtracking in the matrix produces 17–19 retained mesh-cache hits per terrain-enabled case, preserving the existing reuse path.

To remove fresh-runtime and material-cache differences, the isolation creates one settled runtime per world and reconstructs an unshared quad layout from its active draw stream. Every ordered position, normal, UV and color value is compared exactly; material objects, triangle order, full tile bounds and ownership are retained. Runtime updates are then frozen, and both layouts are warmed and timed in alternating order, across all four visible-layer combinations. Each of 48 cases warms up for 45 frames and measures 180. All 24 paired readbacks have zero changed pixels, and renderer calls/triangles match. This isolates indexing within this software renderer; it does not reproduce a hardware GPU cache.

Same-scene stationary means, unshared → shared candidate (ms):

| World / visible layers | Trial 1 | Trial 2 | Trial 3 |
| --- | ---: | ---: | ---: |
| large / terrain only | 26.34 → 29.29 | 25.09 → 24.89 | 30.34 → 25.47 |
| large / both | 46.67 → 51.23 | 49.42 → 50.70 | 58.57 → 52.30 |
| infinite / terrain only | 23.76 → 25.96 | 25.23 → 22.39 | 26.91 → 22.83 |
| infinite / both | 47.60 → 42.98 | 45.71 → 42.27 | 46.77 → 49.72 |

The candidate stores 109,568→18,242 coarse vertices in the large world and 226,048→38,113 in the infinite world: approximately **83% fewer attribute vertices**. At 44 attribute bytes/vertex this is approximately 4.60→0.77 MiB and 9.49→1.60 MiB, respectively, excluding indices and other resources. These are candidate buffer-storage measurements, not measured GPU upload bytes or vertex-shader invocation counts. They are **not savings in the final production application**, which retains the prior builder. Cold preparation sometimes increased; for example, the first infinite both-layer pair was 2,656→3,107 ms. Storage reduction alone does not justify deploying a change with mixed frame results.

### Remaining bottleneck and final validation

The steady-state distant-rendering deficit remains unresolved. In the unchanged large-world baseline, stationary submissions are 9 calls / 12,758 triangles with neither layer, 73 / 66,966 with terrain only, 66 / 29,150 with vegetation only and 130 / 83,358 with both. Stationary update work is approximately 0.05–0.08 ms, while software graphics elapsed work is tens of milliseconds. Stable mask/planning work is already skipped. Walking/running also incur generation and meshing CPU, but those are separate from the persistent stationary rendering cost. Additional workers or generation caches would not directly remove the settled graphics cost.

The results support investigating coarse submitted primitives, spatial culling and draw organization on a hardware graphics backend. They do not conclusively separate primitive setup, vertex execution, fragment work and per-draw driver overhead. Exact overdraw, hardware pipeline counters and actual GPU upload bytes remain unavailable. The environment has no `/dev/dri`; the earlier actual Electron probe could not create WebGL2. Production Chromium UI checks are not native Electron hardware FPS measurements. No 60 FPS claim is supported, and the user-observed hardware deficit is not declared fixed. E2 polygonal tree geometry remains outside this task.

[Final validation and source hashes](TerrainE1FollowupValidation.json) record 56/56 passing MetaWorld test files and successful production browser regressions for the actual GameView render loop/diagnostics, representation switching, Editor save/Viewer reopen, extent controls and undo/redo, signed-coordinate streaming/collision/editing, construction excavation/paths, geographic coverage and map persistence, imported GOX/STL/glTF/GLB independence, and Raycasting Teleporter input, landings, physics and cleanup. The separate map harness still mocks workspace/toolbar/API hosts as described earlier. All 25 dirty native modules meet the path/description header and fewer-than-200-code-line checks. `git diff --check` passes. `Notebook/test.html` retains the original SHA-256 above.
