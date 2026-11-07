<!-- Nodevision/docs/TerrainPhaseB.md -->
<!-- This report describes multi-resolution terrain rendering, predictive chunk scheduling, source and collision preservation, repeatable coverage measurements, and the implementation's remaining limitations. -->

# Phase B: multi-resolution terrain and movement streaming

The runtime now displays ordinary world-space coarse terrain independently of full-resolution voxel generation. Near terrain retains the selected voxel or polygonal appearance. The existing chunk manager retains useful work across movement boundaries and can prepare a bounded corridor ahead of travel. This is a working end-to-end implementation, with the performance and fidelity limits below; it is not a claim of universal 60 FPS or perfect coverage at every distance.

No horizon ring, billboard, skybox landscape, NPC behavior, or separate terrain editor was introduced.

## A. Architecture and source handling

The existing logical terrain object, generator, authoring bridge, material palette, chunk manager, collision adapter, history, and save routes remain authoritative. `TerrainLOD/Runtime.mjs` owns only that terrain's additional visual tiles, under a child group of the existing terrain root. It does not register a competing world or rewrite the geographic source.

Three detail levels are active:

| Level | Geometry | Source and ownership |
|---|---|---|
| LOD 0 | Existing 0.25 m occupancy, voxel faces or surface nets | Existing composed terrain generator and chunk manager |
| LOD 1 | Heightfield grid with nominal 2 m spacing | Same terrain sampler, shared material palette |
| LOD 2 | Heightfield grid with nominal 8 m spacing | Same terrain sampler, shared material palette |

Coarse tiles cover 64 × 64 metres and contain independently maskable 8 × 8 metre sections. This makes them compatible with existing detail columns without constructing full voxel occupancy for distant terrain. Tiles are geographically anchored and retain their coordinates when the player moves.

The distant representation is built first, with conservative omission at unresolved coverage edges. Refined geographic boundaries and intermediate detail follow after the initial distant tiles, retaining each outgoing mesh until its replacement is ready. The intermediate selection boundary has hysteresis: enter within 64 m of a tile, retain until 80 m. The existing near-detail/render-distance control still governs detailed chunks. Default coarse visibility requests extend to 512 m, subject to world boundaries and explicit resource caps.

`Heightfield.mjs` uses the terrain's existing metre-space sampler, including projection, origin, elevation scaling, and map/hybrid composition. `Coverage.mjs` checks the shared decoded geographic snapshot and effective crop geometry directly. It does not decode the TIFF again or allocate a DEM copy per level. Boundary and NoData cells are conservatively subdivided down toward native spacing rather than extending invented terrain outside coverage. Procedural terrain uses the same deterministic height source. Map and hybrid tiles await the existing range reader, and the configured procedural-outside policy is retained.

The first implementation densely resampled coverage through the generator. Benchmarking identified that as unnecessary work; the final implementation checks geographic crop edges and cached raster samples directly. The same raster cache remains authoritative for all levels.

### Authored changes and non-heightfield features

Paths, construction cuts, and session edits mark affected regions. Coarse cells there use the composed surface at native horizontal spacing, including excavation and authored height changes. Construction-owned rendered geometry is not turned into a duplicate terrain cap. The surrounding terrain still uses the ordinary coarse spacing.

Affected columns also receive full composed volumetric detail outside the ordinary near radius. Known procedural cavern regions are detected and use that refinement policy as well. At most 64 feature-refinement columns are requested at once, prioritized by proximity. This preserves actual cavities, tunnel walls, overhangs, and authored voxel geometry through the existing full-detail pipeline; a heightfield alone cannot represent them. The coarse top surface remains an approximation while volumetric refinement is pending.

Invalidation rebuilds intersecting coarse tiles and the existing affected detailed chunks. Outgoing coarse tiles remain until a replacement is ready. Up to 256 recorded modification regions are retained; beyond that, conservative bounds are merged to keep bookkeeping bounded. That overflow policy can over-refine unrelated space, rather than silently forgetting earlier edits.

### Collision and picking

Distant meshes are visual-only and excluded from terrain editing picks. Terrain picking and material inspection retain the existing detailed/session interfaces. Analytic composed ground queries do not depend on visible detail. Polygonal body collision uses rendered triangles only when the player's footprint has complete detailed columns; otherwise it uses composed voxel occupancy. This avoids the former empty-mesh collision gap while respecting construction voids and session edits.

For map data that is not resident, body movement into the pending footprint is blocked while the existing map reader prepares it. Source absence is not treated as solid ground, and purely visual distant tiles do not allocate collision meshes. The benchmark's collision fraction measures availability of ground queries; it is not a comprehensive physics simulation.

## B. Scheduling, caching, and budgets

`PredictiveColumns.mjs` plans through the existing chunk manager. It estimates movement from chunk-center changes, clamps the look-ahead to four columns per axis, and adds a narrow corridor of requests. Immediate neighboring columns outrank speculative work. Known feature regions join the same deduplicated queue. No worker queue or second scheduler owns detailed geometry.

Crossing a chunk boundary no longer automatically cancels a still-useful progressive task. Work outside the wanted region can be cancelled. Detailed residency retains a three-column margin to reduce boundary oscillation churn, with the existing global memory/chunk caps still enforced. Each queried column records its required vertical levels so a partially generated column cannot incorrectly hide coarse terrain.

Budgets:

- Detailed work retains the existing approximately 4 ms soft deadline and at most one completed chunk per update; an optional work-unit cap supports deterministic scheduler measurements.
- Coarse work has a separate approximately 2 ms soft deadline, with cooperative yields between cells. Installation is bounded to one tile per update.
- Detailed residency remains capped at 256 chunks and approximately 128 MiB of accounted buffers/occupancy.
- Coarse residency is capped at 128 tiles and 32 MiB of accounted buffers by default. Validated settings permit 4–64 MiB.
- One coarse tile is prepared at a time. The outgoing tile and incoming preparation can temporarily coexist. CPU arrays and JavaScript objects are additional to the reported typed-buffer estimates.
- Visibility requests accept 64–2048 m, but the tile and memory caps take precedence. A large setting is not a guarantee that every requested distant region is resident.

The coarse budget can be reduced without retaining a larger existing allocation. Disposal closes the visual layer, releases geometries, and leaves imported models and their resources alone. Retention is an in-memory reuse policy, not a new disk cache.

## C. Geometry and transitions

A coarse section is masked only after **all** required vertical detailed chunks are resident and valid. If detail is evicted or invalidated, the coarse section becomes visible again. Coarse resolution changes replace the outgoing tile only after the incoming tile is prepared. This avoids blank terrain during ordinary replacement and avoids overlapping horizontal coarse/detail surfaces.

Shared source samples and normal queries keep neighboring boundaries consistent. Downward skirts bridge differing edge resolutions; skirt depth accounts for local height variation. Geographic boundaries are subdivided conservatively, and mixed wet/dry cells are refined to reduce coarse shoreline gaps. Water uses the source's water height and palette material.

These are skirts and conservative refinement, not fully stitched volumetric transition meshes or continuous geomorphing. Fine voxel edges and surface-net rounding can still produce small visual changes at handoff. Distant heightfields approximate features below their sampling scale; volumetric regions depend on the bounded refinement queue. Complex cave entrances, pathological cliffs, and heavily edited regions still warrant interactive desktop inspection. No claim is made that every possible custom world has seamless transitions.

## D. Measured results

Artifacts:

- [Movement/coverage benchmark](TerrainPhaseBBenchmarks.json)
- [Real-generator prediction trace](TerrainPhaseBPrediction.json)

The browser comparison uses Phase A revision `8cf57bdb87d77106b58314526e9237cc968943f5`. The harness materializes its runtime, chunk manager, progressive scheduler, representation lifecycle, and mesher without changing the working tree. The first local snapshot was verified byte-for-byte against that revision; the runner now reproduces it directly from Git.

Environment: Linux VM, Chromium 156 with SwiftShader software rendering, 640 × 480 viewport. Each row runs 240 frames: stationary, slow walking, normal walking, running, rapid movement, then backtracking. Motion is a fixed distance per frame, not a fixed wall-clock speed. A separate scenario repeatedly changes direction. Near detail is set to 16 m for both versions. Tests include a genuine synthetic GeoTIFF import, the supplied geographic HTML, procedural worlds, and a construction/path-edited world. Imported asset identity is exercised separately by integration tests.

### Coverage metric

Every twelfth frame, the harness samples a fixed forward ground grid at three lateral offsets and six distances. It excludes positions outside authoritative source coverage and the camera frustum, then casts downward rays against actual rendered terrain geometry. Coverage is total successful probes divided by eligible probes; missing probes count sampled failures, **not distinct connected holes**. This is not a screen-pixel percentage. Skirts can contribute intersections, occlusion is not modeled, and the small worlds have fewer eligible probes. Cold-start frames are included.

### Before/after coverage

| World | Appearance | Phase A coverage | Phase B coverage | Missing probes A → B |
|---|---|---:|---:|---:|
| Small procedural | voxel | 100.0% | 94.3% | 0 → 2 |
| Small procedural | polygonal | 65.7% | 94.3% | 12 → 2 |
| Synthetic GeoTIFF | voxel | 73.3% | 93.3% | 4 → 1 |
| Synthetic GeoTIFF | polygonal | 46.7% | 93.3% | 8 → 1 |
| Pelion | voxel | 7.1% | 92.6% | 316 → 25 |
| Pelion | polygonal | 5.0% | 93.5% | 323 → 22 |
| 4 km procedural | voxel | 20.3% | 94.2% | 287 → 21 |
| 4 km procedural | polygonal | 6.9% | 94.2% | 335 → 21 |
| Excavation + object | voxel | 100.0% | 71.4% | 0 → 10 |
| Excavation + object | polygonal | 45.7% | 62.9% | 19 → 13 |
| Direction changes | voxel | 19.7% | 94.2% | 289 → 21 |
| Direction changes | polygonal | 6.1% | 94.2% | 338 → 21 |

### Phase B availability, frame time, and memory

Times are milliseconds. “Coarse available” means an unmasked coarse mesh exists after rendering, not a GPU timestamp. Geometry memory is a typed-buffer estimate across detail and coarse levels, not total process or GPU memory. Frame time includes software rendering and browser scheduling.

| World | Appearance | Coarse available | First detail | Mean / p95 frame | Geometry + occupancy MiB | Coarse queue at end |
|---|---|---:|---:|---:|---:|---:|
| Small procedural | voxel | 156.6 | 254.6 | 16.8 / 16.8 | 12.36 | 0 |
| Small procedural | polygonal | 40.7 | 280.7 | 16.7 / 16.8 | 3.65 | 0 |
| Synthetic GeoTIFF | voxel | 73.6 | 181.6 | 16.7 / 16.8 | 4.79 | 0 |
| Synthetic GeoTIFF | polygonal | 58.0 | 214.9 | 16.7 / 16.7 | 2.09 | 0 |
| Pelion | voxel | 117.7 | 163.5 | 18.6 / 33.3 | 11.83 | 6 |
| Pelion | polygonal | 90.1 | 234.3 | 17.4 / 16.8 | 5.14 | 4 |
| 4 km procedural | voxel | 58.5 | 117.1 | 22.4 / 33.4 | 21.20 | 0 |
| 4 km procedural | polygonal | 48.9 | 162.3 | 21.1 / 33.4 | 9.17 | 0 |
| Excavation + object | voxel | 2170.3 | 250.7 | 16.7 / 16.7 | 9.68 | 1 |
| Excavation + object | polygonal | 2622.5 | 335.9 | 16.7 / 16.8 | 3.15 | 1 |
| Direction changes | voxel | 40.8 | 85.5 | 24.0 / 33.4 | 19.64 | 0 |
| Direction changes | polygonal | 68.9 | 201.3 | 24.3 / 33.4 | 7.78 | 0 |

All rows retain generation/meshing/installation timings, detailed queues, level distribution, cancellations, evictions, and per-probe results in JSON. Missing legacy readiness counters are not evidence of zero latency. The Phase A per-probe detail indicator uses any resident level, whereas Phase B checks complete columns; those two detail indicators must not be compared as equivalent.

These single sequential trials show much better landscape coverage, not a universal speedup. There are real tradeoffs: cold-start coarse generation can delay small edited worlds; rendering more landscape costs software-rendering time. Some Phase B frame times are worse than Phase A's mostly empty view. Warm caches, JIT compilation, order effects, and timing-sensitive CPU budgets matter. The user-observed hardware 60 FPS has not been reproduced in this VM; these results cannot establish a hardware frame-rate guarantee.

### Prediction in isolation

The browser artifact includes four additional `phase-b-reactive` rows with LOD enabled but prediction disabled. The short browser trace does **not** establish a general readiness improvement from prediction alone; some reactive runs do as well or better. Most of the visible coverage improvement comes from independent coarse terrain.

The separate real-generator acceleration trace fixes work at 512 cooperative steps per update, with a 1000 ms emergency ceiling, to isolate scheduling from host speed. Production continues to use the ordinary 4 ms deadline. It runs 400 updates: stationary at x=24, a step to x=32 with preparation time, then movement at 0.5 m/update. It builds real procedural occupancy and meshes, without GPU rendering.

| Scheduling | Complete columns ready before entry | Entered columns |
|---|---:|---:|
| Reactive | 4 | 10 |
| Predictive | 10 | 10 |

A second deterministic test exercises the actual chunk scheduler with controlled resumable tasks. Both tests support the bounded prediction mechanism; neither predicts performance for every travel pattern. Abrupt reversals can make prefetched work less useful.

### Diagnostics

The existing **View → Show FPS** overlay includes LOD distribution, visibility distance, and pending coarse work. `window.NodevisionFpsOverlay.terrainSnapshot()` provides detailed and coarse CPU work, buffers by level, request counts, queue age, candidate/selected regions, missing selected tiles, refinement columns, evictions, and renderer counters. Tile counts and detailed chunk counts have different spatial units. Requested distance may exceed the region selected under the tile cap.

GPU upload time remains unavailable (`null`). The implementation uses no terrain workers, so worker latency is unavailable. Live diagnostics do not perform expensive viewport ray sampling; that measurement belongs to the benchmark. A precise live visible-coverage percentage, prefetch hit rate, and coarse-to-detail per-region latency are not yet implemented.

## E. Regression verification

Passed:

- **32 Node test files** covering geographic sources, procedural terrain, maps/hybrids, paths, constructions, session voxels, representation lifecycle, diagnostics, and FPS behavior.
- Eight focused LOD cases cover real coarse geometry, differing complexity, shared boundaries, conservative NoData/crop exclusion, independence from voxel generation, prediction, construction cuts, unstreamed collision, bounded backtracking/teleport residency, and disposal.
- `python3 scripts/test-terrain-representation-browser.py`: GOX/STL/glTF/GLB geometry identities, appearance switching, history, camera/environment, and save/reopen.
- `python3 scripts/test-terrain-maps-browser.py`: map/hybrid range loading, source composition, materials, biomes, collision, local edits, associations, settings, and persistence.
- `python3 scripts/test-constructions-browser.py`: **54 checks**, including terrain composition and construction identity.
- `NV_TERRAIN_NATIVE=1 node scripts/test-terrain-phase-b.mjs Notebook/test.html`: production `GameView.setupPanel`, actual toolbar and inspector, active render loop, coarse terrain, actual settings application, both appearance choices, production save, and read-only Viewer reopen.
- `node scripts/test-terrain-phase-a.mjs Notebook/test.html`: supplied-world View menu, delayed loading, selection, geometry, inspector, resource disposal, source identity, HTTP save/reopen, and Viewer permissions.
- `node scripts/test-terrain-phase-b.mjs Notebook/test.html`: 24 before/after scenario/appearance rows plus four reactive-LOD comparisons.
- `node --loader ./scripts/html-test-loader.mjs scripts/terrain-phase-b-prediction.mjs docs/TerrainPhaseBPrediction.json`: real-generator bounded-work acceleration comparison.
- Changed JavaScript syntax, required application headers/lengths, and `git diff --check`.

The old unit tests that assumed every terrain-root child was a detailed mesh now select detailed meshes explicitly; streaming tests wait for progressive completion rather than assuming an entire chunk installs synchronously in one call. The dedicated Phase A representation unit fixture disables LOD to retain its original single-representation lifecycle checks; separate new tests and the production browser workflow exercise appearance switching with LOD enabled.

To run the combined unit suite:

```sh
node --loader ./scripts/html-test-loader.mjs --test --test-concurrency=2 \
  ApplicationSystem/public/MetaWorld/TerrainLOD/*.test.mjs \
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

The production-route harness uses temporary Notebook copies. `Notebook/test.html` remains unchanged, SHA-256 `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`. Parser traces confirm original and saved scripts reach JSON.parse verbatim. Source metadata, cached samples, object identity, and the earlier shared Editor/Viewer loading repair are preserved.

Electron hardware rendering and manual desktop travel are unverified in this phase. Phase A encountered VM graphics/shared-memory failures. The verified interactive infrastructure here is the real production panel and controls in Chromium; the movement benchmark drives the real terrain runtime rather than simulating keyboard-controlled player physics.

## F. User walkthrough

1. Open your geographic world in **Virtual World Editing**. Legacy worlds automatically receive safe runtime defaults; opening them alone does not add streaming settings to their document.
2. Select the generated terrain and open **Y properties**. Under **Landscape visibility**, leave **Show distant terrain** and **Prepare terrain ahead of movement** enabled. The default visibility request is 512 metres, clipped to available source coverage and resource limits.
3. Use **Terrain visibility (metres)** and **Apply landscape settings** if you want a different limit. The existing render-distance setting continues to control near detailed terrain. Increasing distant visibility does not expand the DEM's geographic coverage.
4. Move through the world. Coarse 3D terrain should already cover areas where detailed chunks are still preparing. Nearby voxel or polygonal geometry replaces it when a complete column is ready. Cold starts and heavily edited areas can still show preparation delays.
5. Use **View → Terrain Representation** or the Y representation selector to choose Voxel or Polygonal. Distant terrain remains simplified polygonal geometry; imported models keep their own representation.
6. Enable **View → Show FPS**. Inspect coverage-related queues and LOD counts alongside frame time; FPS alone does not establish terrain availability. Capture `window.NodevisionFpsOverlay.terrainSnapshot()` in developer tools when reporting a problem.
7. Save normally, then reopen in **Virtual World Viewing**. The source, authored objects, chosen appearance, and explicitly applied landscape settings persist. Viewer settings remain read-only; return to an editable world to change them.

## G. Remaining work and practical limits

The primary coarse-plus-near-detail path, prediction, persistence, source preservation, and bounded lifecycle are implemented. Further work remains:

- Hardware Electron verification, longer walking/running routes, and representative dense construction worlds. The software-rendered frame results do not meet a universal 60 FPS claim.
- Broader real-renderer prediction measurements. The controlled work-budget trace shows a benefit, while the short browser ablation does not show a consistent one.
- Fully stitched volumetric LOD transitions and geomorphing. Current skirts/refinement handle tested boundaries, but complex caves and extreme cliff configurations are not exhaustively verified.
- Faster first coarse output for densely edited tiles. Native-spacing composed sampling deliberately favors preserving edits, and can delay an entire tile.
- Richer long-distance refinement for extensive edits. The 64-column feature cap and 128-tile visual cap can leave distant detail pending; a visibility request larger than available budgets is not guaranteed coverage.
- Larger hierarchical far tiles for kilometre-radius visibility. The current 128 tiles of 64 × 64 metres cover at most 0.524 square kilometres simultaneously. Kilometre-scale worlds can be explored incrementally, but a requested 2,048-metre visibility radius cannot be fully covered by this implementation.
- Exact live coverage, prefetch usefulness, and per-region coarse-to-detail latency telemetry.
- Worker extraction if profiling on target hardware still identifies main-thread meshing as limiting detail availability. A bounded worker pool and transferable chunk/halo buffers should be benchmarked against the current cooperative pipeline before adopting them; repeatedly copying entire DEM caches would be counterproductive.
- Route-informed prediction and collision preparation. No Chiron/NPC or navigation features were added.

Do not interpret this implementation report as proof that every acceptance condition holds for every arbitrary world. The checked-in artifacts identify the demonstrated improvements and the remaining performance/fidelity limits explicitly.
