# Phase D: finite-world performance optimization and extent policy

## Status

This is the historical performance-only iteration report. Infinite procedural generation has since been implemented; see [World extent implementation](WorldExtent.md) for current behavior and validation. The measurements below describe the earlier finite-world optimization.

The rendering-performance work is implemented. Infinite generation is **not implemented or exposed**. This uses the prompt's explicit fallback: complete the focused optimization first and defer infinity when bounded generation, persistence, and coordinate behavior cannot yet be shipped reliably together. The full Phase D acceptance criteria therefore remain incomplete.

There is no misleading Infinite toggle, huge substitute dimension, or removed boundary check. Legacy documents remain finite without acquiring a new saved property. Explicit `worldExtent.mode: "finite"` is preserved. Geographic, authored-map and hybrid definitions requesting `"infinite"` fail with a source-specific error at validation/loading, authoring, and runtime serialization. A procedural infinite request also fails clearly as unsupported in this iteration.

## Diagnosis and implemented change

The old coarse renderer scanned every resident tile's 8-metre sections every frame, including after all queues drained. Each scan performed string-keyed detailed-column queries and created mask arrays/signatures. The existing `coarseCpuMs` counter excluded this work, understating the LOD cost. Vegetation also built a signature by iterating resident detail twice per frame even when residency was unchanged.

At the common local camera position (20,20), the larger fixtures retained 64 coarse tiles. Their settled frames performed **4,096 column checks each**. CPU-only isolation measured approximately **0.58–0.64 ms per update** for the three kilometre-scale extents; Chromium measured roughly **0.8–1.0 ms** of LOD work. Increasing finite boundaries from 1,000×2,000 to 4,000×4,000 did not increase the active footprint, coarse geometry, or settled column count. The initial increase from small worlds came from more active tiles and geometry, not a scan of every possible world region.

The final implementation uses structural revisions for resident chunks, known column levels, and invalidated chunks. Coarse masks update on actual ownership changes and tile installation. Known empty columns, invalidation, eviction, and representation replacement all invalidate the revision. Vegetation skips its resident signature scan when the loaded-chunk revision is unchanged. External test adapters without revision support retain conservative scanning.

**Terrain geometry, material groups, source sampling, coverage, and cache budgets are unchanged by the final optimization.** Vegetation proxies now greedily merge adjacent opaque, untextured cells that share material, tree identity, and owning chunk. Their exact occupied union is preserved; separate chunk ownership keeps detail handoff intact. Transparent, textured, and wireframe materials retain their original cells. Source cell counts remain distinct from rendered box counts in diagnostics, and existing conservative buffer budgets remain in force. No hierarchy, worker pool, shader replacement, or new terrain generator was introduced. New diagnostics expose planning CPU, mask CPU, mask-pass count, and finite extent alongside existing terrain counters.

### Rejected geometry experiment

An additional experiment removed exactly paired internal skirts while retaining top surfaces and open boundaries. It reduced coarse triangles from 54,784 to 20,736 in the isolated large fixture. Full rendering did not show a reliable benefit, and several vegetation-heavy SwiftShader cases became slower. The experiment was reverted. The observed triangle reduction is documented here as experimental evidence, not presented as the shipped result.

### Hardware qualification

These runs used headless Chromium with software WebGL at 640×480. They do **not** identify the exact cause of the user's hardware-specific 40 FPS observation or prove a return to 60 FPS on that hardware. They identify and remove a measured persistent CPU cost and reduce vegetation rendering geometry. Vegetation-heavy scenes still exceed the 60 FPS frame budget in some software-rendered cases.

GPU execution time and garbage-collection pauses were not measured. Draw-submission CPU time is not GPU time. CPU and geometry evidence must be distinguished from refresh-rate-capped frame intervals.

## Benchmarks

`TerrainPhaseDMeasurements.json` records the final 40-case matrix. `TerrainPhaseDCPU.json` records the final isolated CPU run, and `TerrainPhaseDSources.json` identifies the measured working-tree modules. The initial before/after and rejected-experiment raw files were stored in `/tmp` and were lost across the session environment restart. The historical comparisons below retain observations printed during those runs; they are not presented as a recoverable raw baseline dataset. The baseline included the uncommitted Phase C vegetation and teleporter implementation.

The common-view matrix contains 50×50, 256×256, 1,000×2,000, 2,000×2,000, and 4,000×4,000 metre worlds; voxel and polygonal appearances; and all four independent distant-terrain/distant-vegetation combinations. Each case records preparation, queue drain, settled frames, movement, and backtracking. All comparisons keep the same seed, local position, material palette, near distance, field of view, and visibility settings. An additional 1,000×2,000 comparison samples the interior at local (512,512).

Startup timing measures CPU preparation in yielding batches. `firstCoarseMs` measures the first installed coarse geometry, **not GPU-visible presentation latency**. Each settled phase contains 60 rendered frames and includes its initial submission. Results are single sequential runs, not a statistical hardware certification. Raw frame intervals, means, p95, maxima, draw calls, triangles, queues, residency, and installation/generation counters are retained rather than selecting only favorable results.

Commands:

```sh
node scripts/test-terrain-phase-d.mjs /tmp/phase-d-current.json
NV_PHASE_D_CENTER=1 node scripts/test-terrain-phase-d.mjs /tmp/phase-d-interior.json
node --loader ./scripts/html-test-loader.mjs scripts/profile-terrain-phase-d.mjs /tmp/phase-d-cpu.json
```

For a before/after checkout comparison, set `NV_PHASE_D_BASELINE` to a directory containing the baseline `MetaWorld` tree; the local server serves that tree ahead of the current modules. It never modifies Notebook files. For reproducible future comparisons, retain that baseline tree and its hashes alongside the results rather than relying on temporary files.

## Source boundaries and integrity

Purely procedural classification requires a procedural source and no geographic or terrain-map source payload. The new validator never changes source identity, invents samples, clips authored objects, or silently converts incompatible files. Inspector/source summaries and the existing generation dialog describe map-based extent as read-only source-defined information.

Geographic crop polygons, NoData, projection, cached elevation samples and scaling continue through their existing authoritative sampler. Authored maps and hybrids retain existing finite map/composition rules. An intentional procedural fallback inside an existing finite composition remains finite; it does not enable unbounded extension.

`Notebook/test.html` is protected; integration uses temporary copies. Expected original SHA-256:
`75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`.

## Bounded follow-up for infinite procedural worlds

The audit found concrete work beyond removing size limits:

1. Introduce an extent-aware coordinate contract shared by `VoxelCoordinates`, the base/composed generators, chunk-level queries, both meshers, coarse sampling, vegetation providers, collision, spawn and teleporter preparation. Retain a finite vertical domain and stable logical coordinates. Validate infinity exclusively for purely procedural sources at all entry points.
2. Replace finite clipping in chunk, coarse-tile, and vegetation planners with bounded signed-coordinate windows. Bound level registries even when distant terrain is disabled. Test positive/negative crossings, queue cancellation and teleport-like relocation without generating the intervening route.
3. Audit dimension-dependent biome anchors, landforms, waterways, tree footprint tests, Aegean coast/protection rules, and coordinate hashing. Finite-to-infinite conversion must retain seed/origin and authored state. Determinism must hold after eviction and generation-order changes.
4. Keep deterministic generated caches separate from authored data. Current session voxel opinions intentionally are not saved by ordinary world Save. Persistent constructions already use linked resources, but that does not implement a general sparse infinite-region edit journal. Establish a region-indexed authored store, atomic companion-resource save behavior, relative references, and recovery before offering persistent infinite editing. Unmodified visits must create no resource files.
5. Audit local render coordinates versus logical coordinates. No floating-origin system or new long-distance precision claim is included here. Test 100 m, 1 km, 10 km and, if safe, 100 km in both signs before documenting limits. If rebasing is needed, migrate cameras, collision, paths, imports, associations, geographic transforms, and save coordinates together.
6. Only then add Finite/Infinite to purely procedural creation/properties. Map-based worlds must never offer it. Disable infinite-to-finite conversion until out-of-bounds authored content has an explicit non-destructive policy. Integrate undo/redo and real Editor/Viewer save/reopen tests.

No infinite travel, sparse infinite-edit persistence, or 100-km precision result is claimed in this delivery.

## User walkthrough for the delivered work

- Create a finite world with the existing **Insert → Voxel World** interface. Width/length and seed retain their existing meaning.
- Select terrain and use its existing landscape controls to adjust terrain visibility, distant vegetation, and vegetation distance. Infinite mode is unavailable pending the follow-up above.
- Use **View → Show FPS** to inspect existing residency/queue/render counters plus the new LOD planning and mask totals. Once stationary with drained queues, ownership updates should stop increasing until residency or terrain changes.
- Use the existing terrain representation control to switch between voxel and polygonal appearance.
- Continue using existing path/construction editing and persistence workflows. Temporary session voxels remain temporary unless captured/saved through the persistent-construction workflow. This optimization does not change that contract.
- Save and reopen normally. Source-defined maps remain finite; legacy files do not gain an extent setting merely from being opened.

## Files

Production changes include opaque vegetation proxy box merging and terrain residency revisions (`ChunkRegionIndex`, `VoxelChunkManager`, `TerrainLOD/ResidencyVersion`), coarse/vegetation runtime mask scheduling, diagnostics, and explicit extent validation/source descriptions in the existing definition/runtime/dialog/inspector path. New focused tests cover mask invalidation, extent rejection, exact proxy occupancy, material exclusions, installed instance bounds, and independent chunk handoff. Profiling scripts live under `scripts/*terrain-phase-d*`; the map browser regression also checks read-only source extent and rejection through the production loader.

Earlier Phase C vegetation and Raycasting Teleporter changes remain in the working tree.

## Validation

- Final broad MetaWorld unit run: all 48 test files passed. The existing seasonal rebuild test assumed synchronous completion in one update; it now waits for bounded incremental generation.
- Production GameView integration passed using a temporary copy of `Notebook/test.html`: real render loop, native controls, inspector, representation changes, save, and Viewer reopen. Parser inputs remained identical to the saved script, including the geographic cache.
- Map browser integration passed: finite source UI, infinite hybrid rejection through the actual loader, map/hybrid editing, imports, save/reopen, undo/redo, and both appearances.
- Teleporter browser integration passed: inventory, trusted primary/controller input, geographic coarse and detailed destinations, collision, cancellation, imports, constructions, permissions, cleanup, and save/reopen.
- New unit regressions cover revision invalidation, source extent validation, opaque box occupancy, textured/transparent exclusions, and actual instanced chunk handoff.
- Dirty native-module standards audit passed for 32 files: path header, second-line description, fewer than 200 code lines. `git diff --check` passed. The original Notebook hash remains unchanged.
- Tests ran in Node and headless Chromium, not native Electron or the user's graphics hardware.

### Historical interior-view comparison

At (512,512) in the 1,000×2,000 fixture, both distant terrain and vegetation enabled, the initial same-environment comparison measured:

| Appearance | Before mean frame | Merged proxies mean frame | Submitted triangles before → after |
| --- | ---: | ---: | ---: |
| Voxel | 86.33 ms | 35.45 ms | 147,122 → 79,370 |
| Polygonal | 107.72 ms | 47.50 ms | 147,122 → 79,370 |

These measurements preceded the defensive exclusion of textured/wireframe materials. The final rerun is recorded separately; do not combine timing samples across the environment restart. Shape occupancy and material boundaries are unit-tested. No claim of bit-identical rasterization or a hardware FPS guarantee is made.

### Final complete matrix

All 40 cases drained their startup queues. Selected results below have both distant terrain and vegetation enabled; the JSON includes all four toggle combinations, movement/backtracking, and detailed counters. Startup is CPU preparation, not first GPU-visible presentation.

| World (m) | Appearance | Startup (ms) | Settled mean frame (ms) | Submitted triangles |
| --- | --- | ---: | ---: | ---: |
| 50×50 | voxel | 537 | 20.08 | 20,616 |
| 50×50 | polygonal | 1041 | 18.40 | 20,616 |
| 256×256 | voxel | 1026 | 59.23 | 62,802 |
| 256×256 | polygonal | 1598 | 57.80 | 62,802 |
| 1000×2000 | voxel | 1336 | 67.11 | 93,522 |
| 1000×2000 | polygonal | 1920 | 66.96 | 93,522 |
| 2000×2000 | voxel | 1298 | 62.46 | 93,522 |
| 2000×2000 | polygonal | 1702 | 61.77 | 93,522 |
| 4000×4000 | voxel | 1199 | 60.72 | 93,522 |
| 4000×4000 | polygonal | 1735 | 60.42 | 93,522 |

The three kilometre-scale sizes submit the same geometry at the common view. Total dimensions do not produce increasing settled rendering cost in this run. Software-rendered vegetation remains above the 60 FPS budget. The isolated mask test performs zero settled column checks for all five sizes; an initial rendered-frame ownership change can still cause one necessary mask pass.
