# Phase E implementation and measurement record

Status: mesh reuse, extraction optimizations and visible-instance packing are implemented and regression-tested. Phase E is not complete: stationary FPS is not consistently improved, and polygonal vegetation LOD (E2) is not implemented.

## A. Performance root causes

Verified: residency eviction previously discarded all reusable polygonal extraction work. Revisiting unchanged chunks regenerated occupancy and Surface Nets. In the deterministic CPU route, six return legs spent 908 ms generating occupancy and 4,659 ms extracting geometry. The new cache eliminates those two costs on these return legs.

Verified in headless Chromium: settled update work is much smaller than frame intervals, and enabling distant terrain/vegetation increases submitted draws and triangles. Mesh reuse does not fix this steady-state rendering cost. Software-renderer results cannot identify the user's GPU bottleneck or establish hardware 60 FPS.

Verified: vegetation handoff previously hid instances with zero-scale matrices while retaining the full instance draw count. Visible instances now occupy a packed prefix and the submitted instance count excludes hidden owners.

Surface Nets previously allocated corner arrays and coordinate-key arrays inside extraction loops. Binary corner-pattern lookup and dense node indexing remove that repeated work. Exact geometry hashes remain unchanged. Individual chunk timings vary; some measured chunks are slower, so no universal extraction speedup is claimed.

## B. Files and architecture

- `TerrainRepresentation/MeshCache.mjs`: per-runtime LRU, 32 MiB/128 entries, compact CPU occupancy and geometry, signed chunk/representation keys, generation stamps and halo-aware invalidation. Runtime ownership supplies world/source identity. Runtime recreation handles changed seed/source/material definitions; existing edit APIs invalidate composition changes.
- `TerrainRepresentation/CachedChunkBuilder.mjs`: shared cooperative generation/extraction/reuse path. GPU installation remains with the chunk manager.
- `TerrainRepresentation/SurfaceNets.mjs`: precomputed binary patterns, dense node table and reduced temporary allocations.
- `ProceduralVoxelWorldRuntime.mjs`, `VoxelChunkManager.mjs`: cache ownership, edit invalidation, disposal, shared Editor/Viewer integration.
- `FinishTerrainChunk.mjs`: typed cached index-buffer installation.
- `TerrainDiagnostics/Snapshot.mjs`: CPU cache and disposal counters.
- `VegetationLOD/Instances.mjs`: compact visible instance draw ranges.

No saved world schema, source composition, elevation samples, or seed changes are introduced. GPU geometries still dispose on residency eviction; cached CPU buffers survive within their independent budget. Statistics distinguish cache hits from chunk installations, which still occur when buffers are reused.

## C. Measurements

Baseline commit: `b228d5f32d4846dc71257bcfaf86af6848eefd4c`.

Raw CPU results: [before](TerrainPhaseECPUBefore.json), [after](TerrainPhaseECPUAfter.json). Seed 42; real generator, vegetation/water/caves enabled; infinite procedural terrain; distant renderers disabled. Route X = 32, 64, 96, 64, 32, 64, 96, 64, 32 metres; Z = 32. Each position drains detailed chunk work.

| Six return legs combined | Before | After |
| --- | ---: | ---: |
| Route preparation elapsed | 6,003 ms | 35 ms |
| Occupancy generation CPU | 908 ms | 0 ms |
| Surface Nets CPU | 4,659 ms | 0 ms |
| Cache hits at route end | unavailable | 168 |
| Retained CPU cache | none | 6.84 MiB / 85 entries |

Eight independently extracted chunks have identical full geometry hashes before/after, including groups, materials, indices and normals. This is not a GPU frame benchmark.

Browser matrix: [original baseline](TerrainPhaseEBefore.json), [same-session baseline repeat](TerrainPhaseEBeforeRepeat.json), [after](TerrainPhaseEAfter.json). All three completed 40 configurations; all after-run preparation queues drained. Forty configurations cover five worlds, both representations and four distant-system combinations at 640×480 in Chromium SwiftShader. The harness records settled, walking, running, backtracking, repeat, turning, teleport, negative and far phases.

Measurement limitations: 36 settled frames and 12 frames per movement phase are short samples; p99 is effectively the maximum. Movement is frame-stepped, not real-time player speed. Teleport/negative/far coordinate changes apply only to infinite cases. Cold startup measures preparation CPU/elapsed work, not cold-cache FPS. Draw submission is not GPU execution. GPU timing and GC are unavailable/null. Geographic camera selection uses a diagonal derived from a covered candidate and is not a comprehensive irregular-coverage visual test. The after render run follows a session restart. A baseline repeat in the same session confirms substantial host variation and no consistent settled-frame improvement. The table below uses that repeat. Do not attribute the original-baseline timing differences to the implementation.


Polygonal mode, both distant systems enabled. Frame values are mean / p95 / p99 milliseconds. These results do **not** establish an improvement in stationary FPS.

| World | Before frames | After frames | Before → after draws | Before → after triangles |
| --- | --- | --- | --- | --- |
| small | 23.0 / 28.4 / 152.3 | 19.5 / 25.2 / 119.5 | 17 → 16 | 20616 → 19368 |
| large | 63.8 / 74.6 / 191.4 | 69.2 / 88.3 / 196.5 | 177 → 176 | 93522 → 92274 |
| infinite | 59.8 / 66.7 / 193.7 | 98.5 / 224.0 / 279.3 | 130 → 129 | 75602 → 74354 |
| forest | 63.6 / 84.5 / 220.3 | 63.2 / 93.9 / 183.9 | 128 → 128 | 79370 → 79370 |
| geographic | 21.5 / 26.9 / 110.2 | 25.2 / 40.4 / 116.1 | 50 → 50 | 42168 → 42168 |

## D. Vegetation geometry

E2 remains outstanding. Distant trees still use the existing deterministic sampled box representations in both terrain modes. Instance packing changes submitted work, not tree shapes or identities. No claim of coherent polygonal silhouettes is made.

## E. Visual transitions

Existing chunk ownership and prepared replacement remain intact. Hidden proxies no longer consume instance vertex work. Polygonal silhouette discontinuities between coarse boxes and nearby Surface Nets remain unresolved and require geometry comparisons and rendered transition tests.

## F. Infinite-world behavior

Keys retain signed coordinates. LRU limits prevent indefinite travel-history accumulation. Cache misses regenerate authoritative occupancy. Regional edits invalidate affected chunks and a one-voxel halo; paths/constructions clear retained composition conservatively. In-flight work started before invalidation cannot populate the cache. Zero budgets disable caching; invalid budgets reject clearly.

Only pure procedural worlds may be infinite. Extent validation and geographic/map source coverage are unchanged.

## G. Testing

All MetaWorld unit tests: **243 passed, 0 failed**. Focused representation and vegetation test files: 7 passed. Tests include exact Surface Nets golden hashes, bounded cache eviction, signed keys, stale-generation rejection, halo invalidation, disabled/invalid budgets, representation rollback, authored additions/removals, collision/raycast alignment, actual runtime reuse and removal invalidation, path/construction invalidation hooks, and disposal.

Production Chromium Editor/Viewer checks passed, including actual save/reopen with the supplied geographic HTML. The first 771,948-character parser input exactly matches the original saved script; after the test edit/save, the 772,203-character parser input exactly matches the new saved script. Production extent UI, undo/redo, negative streaming/collision/editing, linked excavation and paths passed. Custom-map range loading, source coverage, local editing, collision and HTML persistence passed. Production teleporter inventory/input, coarse and detailed geographic landings, voxel/polygonal physics, cancellation, permissions, imported GOX/STL/glTF/GLB independence, constructions, cleanup and save/reopen passed. All modified native modules satisfy the required path/description headers and fewer-than-200-code-line limit; `git diff --check` passes. Native Electron and target-hardware performance are unverified.

The original `Notebook/test.html` remains unchanged, SHA-256 `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`. Tests use read-only input or temporary copies.

## H. User walkthrough

1. In the Virtual World Editor, open the procedural terrain creation/settings dialog. Select the procedural source and **World Extent → Infinite**. Map-based sources must retain read-only finite extent information.
2. Select the generated terrain, then open **View → Terrain Representation**, choose **Polygonal**, and apply the representation control.
3. In the landscape controls, enable **Show distant terrain** and **Show distant vegetation**. Set terrain visibility to 256 metres and vegetation visibility to 128 metres, then click **Apply landscape settings**.
4. Enable **View → Show FPS**. Let generation queues drain, then walk, turn, backtrack, and repeat the same route. Inspect CPU cache hits/misses and memory alongside frame diagnostics.
5. Repeat with **Voxel**, and independently disable each distant system for comparison. Cache reuse applies to polygonal extraction. Trees still transition through existing box proxies; coherent polygonal distant silhouettes are outstanding.
6. Save and reopen in the Viewer to verify representation and landscape settings persist. Both use the same terrain runtime; runtime cache contents are temporary and are not serialized.

## I. Remaining work

Essential: resolve the distant-rendering deficit with longer, interleaved GPU-hardware measurements; evaluate browser-worker responsiveness rather than only Node-worker latency; implement and verify representation-aware polygonal vegetation without increasing rendering cost. Validate deterministic geometry, silhouette/scale/material continuity, ownership handoff, source exclusions, signed coordinates, bounded memory and resource disposal.

The [single-worker experiment](TerrainPhaseEWorker.json) transferred 111,376 bytes of chunk/halo input per request and verified exact Float32 geometry and index/group equivalence. Worker startup was 38.6 ms, excluding module-ready handshake; first-request round trip was 85.5 ms. Seven subsequent requests averaged 23.7 ms synchronously versus 26.4 ms worker round trip. This does not establish a latency benefit; main-thread responsiveness under concurrent browser rendering still needs measurement. The worker experiment is intentionally separate from production. A Node worker result alone does not justify a browser-worker deployment. No 60 FPS claim is supported by these VM measurements.
