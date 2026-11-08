# Phase C: vegetation continuity

This iteration adds an independently prepared vegetation representation to the existing terrain runtime shared by the Virtual World Editor and Viewer. It preserves the existing forest placement and detailed voxel trees. It does not replace authored objects or claim that the procedural Pelion vegetation is a survey of the real forest.

Full acceptance still requires better dense-forest startup and target-hardware performance verification. The measured availability improvement is substantial in several fixtures, but the dense-forest trace reaches only 8–9% represented samples during its short startup/movement window.

## A. Root cause

`VoxelTerrainGenerator.mjs` already separates feature placement from voxel occupancy. Generic trees come from `Features/TreePlacement.mjs`; Mediterranean plants come from `Aegean/PlantPlacement.mjs`; `Geographic/Vegetation.mjs` selects these same providers using the existing biome source. Seeded spatial cells determine origin, species, parameters, growth form and living/dead/fallen variants. `FeatureField.mjs` caches a bounded set of those descriptors and deterministically reconstructs them after eviction.

The rendering dependency caused the late appearance: `generateChunkSteps` samples features into the same 32³ occupancy arrays as terrain. The voxel mesher or surface-net mesher then produces a single chunk mesh, installed by `FinishTerrainChunk.mjs`. Trees crossing chunk boundaries can appear in pieces. Placement itself does not require generating that occupancy array, but the old visible tree did. Evicting detailed chunks removed their vegetation too. Phase B's coarse heightfield tiles contain ground and water, not trees. There was no separate procedural tree LOD or distant forest representation.

This is chiefly a chunk residency and meshing/installation dependency. Ordinary mesh frustum culling still applies, and the near detail radius bounds residency. Those mechanisms differ from texture-download delay: canonical material assets are prepared through the existing shared palette, not downloaded separately for each generated tree. Expanding near terrain range alone would increase occupancy/meshing work. The new path uses the already available placement and shape samplers before full chunks are ready.

## B. Architecture and ownership

`VegetationLOD/` contains three production modules:

- `Sampling.mjs` queries the existing feature field and samples its shapes. Distant proxies are limited to tree species; shrubs, flowers and grass retain their existing detailed rendering. No second seed, species selector, or vegetation distribution is introduced. A stable logical identity is the terrain identity plus the existing feature ID. A descriptor is reused when changing proxy detail within a resident region.
- `Instances.mjs` batches sampled cells by canonical material into Three.js instanced meshes. One unit box geometry belongs to each terrain vegetation runtime; the terrain palette owns the shared materials. Instance buffers belong to their region and are disposed on replacement/eviction. Proxy groups are children of the existing terrain root.
- `Runtime.mjs` owns bounded region metadata, one cooperative preparation task, the pending queue, and diagnostics. It receives invalidations from the existing terrain LOD owner. No global forest registry or competing world loader is added.

The implementation uses 32 × 32 metre vegetation regions, independently of Phase B's 64 metre terrain tiles. Regions query features that intersect them; a feature crossing a region boundary retains its original ID and coordinates. Cells align with the existing quarter-metre voxel grid and cannot straddle a detailed 8 metre chunk boundary. The height-limit offset and terrain root position match detailed terrain.

Authored objects are not queried by this layer. Their transforms, geometry, materials, HTML associations, picking and colliders remain with their original owners. Proxy geometry has no collider and is excluded from the terrain root's nonrecursive editing raycast.

## C. Visual behavior and transitions

Three effective detail levels are available:

| Level | Representation | Ownership |
|---|---|---|
| 0 | Existing quarter-metre voxel or polygonal chunk geometry | Existing detailed chunk manager |
| 1 | Half-metre samples of the same feature shapes | Instanced vegetation region |
| 2 | One-metre samples of the same feature shapes | Instanced vegetation region |

These are actual world-space shapes, not camera-facing cards or horizon rings. The canonical sampler preserves species, lean/orientation, variant and material choices. A supplemental authoritative trunk-axis sample avoids losing narrow trunks between coarse cell centres. Coarse sampling remains an approximation: slender branches, small plants and fallen/dead details can be less recognizable, and one-metre cells can make trunks appear thicker.

A missing region first receives level 2. Intermediate replacement enters within 40 metres and remains until 56 metres, providing distance hysteresis. Installed geometry stays until its replacement is prepared. The swap does not introduce a blank frame. As a detailed chunk becomes visible, only the corresponding proxy cells are masked; after chunk eviction those cells become visible again. Masks synchronize after the chunk update, avoiding a one-frame duplicate at installation. Ordinary frustum bounds are recomputed when the instance mask changes.

There is no alpha blend, transparent forest pass, or temporal geomorph in this iteration. Refinement can visibly change the blockiness of the silhouette. Cold starts and teleports can still reveal newly installed proxy regions. The intended improvement is that approaching trees have an inexpensive prior representation instead of first appearing as detailed chunk geometry. This is a reduction in late appearance, not a promise of zero perceptible popping.

## D. Streaming, budgets and release

Preparation runs alongside the existing terrain work with an explicit **1 ms soft CPU budget per update**, at most one region installation per update, and one active generator. The existing terrain budgets remain unchanged. Individual sampler calls, allocation, bounds recomputation and upload can exceed the cooperative budget; this is not a hard frame deadline.

Requests prioritize immediate proximity, then the movement corridor, then surrounding regions. The lead is bounded to 32 metres per axis and follows the existing landscape predictive toggle. Missing regions precede detail replacements. Region requests are deduplicated; tasks leaving the selected set are cancelled. Placement metadata is reused for refinement and retained until region eviction. Map data is requested with the feature reach margin before sampling, using the existing map reader.

Limits:

- Default vegetation visibility: **160 metres**, configurable from 32 to 512 metres.
- At most **64 resident regions**, at most 64 selected requests plus the active task.
- **8 MiB** estimated resident instance matrices; shared box geometry is small and reused.
- One incoming region may temporarily coexist with its outgoing region during commit.
- No new distant collision objects.

The 64-region cap can shorten a requested visibility radius; 512 metres is a request, not guaranteed full-circle coverage. Matrix-byte diagnostics exclude JavaScript descriptors, renderer overhead, canonical shared textures and driver allocations. Generation intermediates are limited spatially to one region, rather than an entire world. Returning to evicted regions regenerates deterministic descriptors; this is a bounded resident cache, not a disk cache.

Queue scoring currently uses movement and distance, not the camera frustum or explicit route plans. Renderer frustum culling remains active. Predictive preparation is demonstrated as a scheduling mechanism by the focused test; the before/after browser comparison includes the entire feature and does not isolate its causal benefit from independent proxy rendering.

## E. Compatibility

The original seed, biome rules, geography, source cache, paths, constructions and session opinions remain authoritative. Feature queries retain existing path/protected-region exclusions. Proxy cells use composed `getFeatureVoxel`, so construction cuts and session overrides suppress procedural content. Geographic/map samples reject uncovered or pending points, while preserving the explicitly configured procedural fallback outside an authored map. Region invalidation expands edit bounds by the feature reach; unrelated installed regions remain resident. Source/season changes invalidate all affected cached descriptors.

The terrain appearance toggle does not change placement. Detailed trees continue to use the existing chosen mesher. Collision remains based on composed occupancy or the existing detailed polygon collision path; no new proxy collision exists. This preserves existing behavior rather than adding a separate trunk physics model. A tree whose graphics are still preparing can retain its existing analytic collision; cold-start/teleport collision-to-graphics timing is not eliminated by this work.

Runtime defaults do not add settings to old saved documents merely by opening them. Explicitly applying Landscape visibility persists `streaming.vegetationEnabled` and `streaming.vegetationDistance` through the existing authoring/history bridge. Viewer controls remain read-only.

`Notebook/test.html` is not modified. Its SHA-256 remains `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`. Production save/reopen runs on a temporary copy. Both original and saved application/json scripts were supplied verbatim to the production parser, retaining the earlier loading correction.

## F. Benchmark method and results

Results are recorded separately in `VegetationPhaseCBenchmarks.json`. The baseline is Phase B commit `f959cc1b80f62f9330b93d1e9f95d5a6e1cd6cae`. The harness materializes baseline runtime modules from Git and serves them alongside the working implementation. Baseline extraction waits for stdout closure before writing files, avoiding an observed truncated-module race in the previous harness.

The deterministic trace includes stationary viewing, walking/running, rapid travel, reversal/backtracking and teleporting. Each fixture runs in voxel and polygonal mode. Fixtures include procedural terrain, dense Mediterranean vegetation, synthetic geographic terrain, the supplied Pelion world, a 4 km world, construction cuts, and an authored landmark alongside procedural vegetation. Production integration separately exercises repeated live representation changes and save/reopen.

This is a single sequential Chromium/SwiftShader comparison, not desktop hardware validation. Frame CPU timings include benchmark instrumentation; renderer counters are actual render counters. Expected feature descriptors are enumerated before timing in both versions, warming placement equally. The state metric tracks continuously range/frustum-eligible identities and records absence-to-detailed appearance separately from frustum/range entry and LOD transitions. Detailed presence uses authoritative material/occupancy anchors in installed meshes, including partially loaded crowns. Proxy presence means a prepared representation, not every leaf or trunk cell. Occlusion, exact pixel visibility, GPU completion and image-space popping are unmeasured. Cases with no eligible trees yield null coverage, not a fabricated success.

### Measured comparison

| Fixture / mode | Represented samples B → C | Absent → detailed events B → C | p95 CPU frame ms B → C | Peak scene draws B → C |
|---|---:|---:|---:|---:|
| small-procedural / voxel | 0.5% → 70.9% | 2 → 0 | 10.4 → 12.4 | 44 → 89 |
| small-procedural / polygonal | 0.0% → 66.1% | 0 → 0 | 11.3 → 11.9 | 33 → 77 |
| dense-forest / voxel | 0.9% → 9.1% | 5 → 0 | 12.0 → 14.8 | 132 → 155 |
| dense-forest / polygonal | 0.3% → 8.0% | 2 → 0 | 13.2 → 15.1 | 109 → 143 |
| synthetic-geotiff / voxel | 29.9% → 93.6% | 1 → 0 | 6.3 → 7.3 | 27 → 23 |
| synthetic-geotiff / polygonal | 19.7% → 94.9% | 1 → 0 | 7.2 → 7.7 | 20 → 18 |
| supplied-geographic / voxel | 0.0% → 38.9% | 0 → 0 | 8.7 → 20.4 | 16 → 33 |
| supplied-geographic / polygonal | 0.0% → 35.4% | 0 → 0 | 11.5 → 19.1 | 15 → 29 |
| 4km-forest / voxel | 0.4% → 60.3% | 1 → 0 | 11.4 → 12.8 | 128 → 155 |
| 4km-forest / polygonal | 0.0% → 60.2% | 0 → 0 | 13.3 → 13.6 | 116 → 161 |
| construction-cut / voxel | 0.0% → 46.1% | 0 → 0 | 63.2 → 59.9 | 8 → 37 |
| construction-cut / polygonal | 0.0% → 49.7% | 0 → 0 | 61.9 → 63.4 | 3 → 39 |
| authored-landmark / voxel | 0.2% → 66.3% | 1 → 0 | 10.1 → 11.7 | 42 → 79 |
| authored-landmark / polygonal | 0.0% → 68.8% | 0 → 0 | 11.3 → 12.7 | 33 → 77 |

Across these routes the object-state metric recorded **13 → 0** absence-to-detailed events. This is not a zero-popping claim: the metric does not count first proxy installation, pixel changes, or every possible route. Several baseline routes never completed tree geometry, so their zero event counts indicate absence rather than good continuity. The supplied-world availability percentages measure repeated eligible identity samples, not the percentage of the real Pelion forest rendered.

| Phase C fixture / mode | First represented identity ms | Mean CPU frame ms | Peak scene triangles | Resident instance MiB at end | Last request ms | Peak pending requests |
|---|---:|---:|---:|---:|---:|---:|
| small-procedural / voxel | 60 | 9.6 | 118650 | 0.552 | 1007 | 30 |
| small-procedural / polygonal | 81 | 9.5 | 78146 | 0.461 | 1024 | 30 |
| dense-forest / voxel | 345 | 11.7 | 56460 | 0.181 | 2432 | 42 |
| dense-forest / polygonal | 472 | 11.9 | 45952 | 0.181 | 1738 | 42 |
| synthetic-geotiff / voxel | 131 | 4.1 | 32490 | 0.060 | 538 | 1 |
| synthetic-geotiff / polygonal | 117 | 5.0 | 31096 | 0.060 | 493 | 1 |
| supplied-geographic / voxel | 1206 | 10.8 | 23200 | 0.031 | 625 | 30 |
| supplied-geographic / polygonal | 1154 | 10.6 | 22556 | 0.024 | 550 | 30 |
| 4km-forest / voxel | 273 | 10.4 | 97846 | 0.463 | 1761 | 34 |
| 4km-forest / polygonal | 287 | 10.6 | 91218 | 0.456 | 1647 | 34 |
| construction-cut / voxel | 90 | 16.0 | 36006 | 0.284 | 704 | 31 |
| construction-cut / polygonal | 66 | 16.2 | 34206 | 0.306 | 1102 | 30 |
| authored-landmark / voxel | 60 | 9.3 | 82484 | 0.396 | 1083 | 30 |
| authored-landmark / polygonal | 66 | 9.5 | 78082 | 0.426 | 1215 | 30 |

Raw rows also contain first proxy installation time, appearance-distance samples summarized by their mean, observed coarse-to-detail latency, cache reuse, evictions, cancellation counts, generation/installation totals, and resident LOD counts. Null latency means no qualifying completed transition was observed. Memory values above are end-of-trace instance matrices, not peak total application memory. Scene draw/triangle counters include terrain and authored geometry; resident proxy estimates are separate in the JSON. Dense edited terrain remains a bottleneck, and the added visual coverage costs CPU/draw work.

## G. Verification

- Six focused tests exercise deterministic descriptors across eviction, measurable LOD complexity, actual instanced geometry, construction/coverage/road/session exclusion, independent installation, bounded travel/cleanup, shared runtime appearance/identity, outgoing residency and ahead-of-movement requests.
- The 33-file Node suite covers existing geographic, map/hybrid, path, construction, session, representation, material, diagnostics and FPS behavior.
- Production `GameView.setupPanel`, active render loop, actual inspector/View controls, vegetation instances, HTTP save and read-only Viewer reopen are exercised by `NV_TERRAIN_NATIVE=1 node scripts/test-vegetation-phase-c.mjs Notebook/test.html`.
- `python3 scripts/test-terrain-maps-browser.py` exercises map/hybrid rendering and persistence.
- Imported-model identity, undo/redo and representation persistence use `python3 scripts/test-terrain-representation-browser.py`.
- Syntax, application comment headers, fewer-than-200 nonblank/noncomment application lines, and `git diff --check` are checked.

Two pre-existing regression waits now observe actual progressive chunk installation instead of assuming completion after a fixed number of updates. The final combined run passed all 33 test files. Run the focused tests with `node --loader ./scripts/html-test-loader.mjs ApplicationSystem/public/MetaWorld/VegetationLOD/Vegetation.test.mjs`, and reproduce the comparison with `node scripts/test-vegetation-phase-c.mjs Notebook/test.html`.

Native Electron hardware travel is unverified. The production panel test runs in Chromium and must not be described as a native desktop success. Broader visual inspection of extreme vegetation species, caves, long routes, seasonal changes and dense edits remains necessary.

## H. User walkthrough

1. Open `Notebook/test.html` in **Virtual World Editing**.
2. Select its geographic terrain and open **Y properties → Landscape visibility**.
3. Leave **Show distant vegetation** checked. New runtime defaults enable it without changing the file until saved settings are explicitly applied.
4. Set **Vegetation visibility (metres)**, initially 160, and click **Apply landscape settings**. **Prepare terrain ahead of movement** also governs vegetation prediction.
5. Run through the landscape. Forest shapes should be present ahead of detailed chunks; nearby silhouettes resolve into the existing detailed vegetation. Allow preparation after a cold start or teleport.
6. Enable **View → Show FPS**. The compact vegetation line reports represented proxy identities, resident regions and pending work. `window.NodevisionFpsOverlay.terrainSnapshot()` exposes timings, counts, instance bytes, evictions, cache reuse and queue latency. Counts are resident/proxy states, not pixel-visible forest coverage; `visibleCoverage` and GPU timings remain null.
7. Use **View → Terrain Representation** to switch Voxel/Polygonal. Tree distribution remains the same.
8. Save and reopen in **Virtual World Viewing**. Vegetation preferences and source data persist; editing controls are read-only there.

## I. Remaining work

Measure on the user's hardware before claiming unchanged 60 FPS. Optimize installation/bounds work if it dominates. Explore species-aware shared silhouettes, especially for thin dead/fallen trees and Mediterranean shrubs, before adding costly transparency. Temporal refinement could reduce remaining silhouette changes and cold-start region appearance.

Hierarchical far regions would extend visibility beyond the present tile cap. Shared terrain/vegetation worker preparation is justified only after profiling; transfer compact descriptors/buffers rather than duplicating DEM caches. Camera-aware priority and an isolated predictive ablation would strengthen the current movement-only scheduler. Exact screen-space popping, occlusion-aware coverage, detailed latency distributions and broader authored-map/edit routes remain unverified.
