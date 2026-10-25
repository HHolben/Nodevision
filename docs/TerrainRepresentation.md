<!-- Nodevision/docs/TerrainRepresentation.md -->
<!-- Describes the existing terrain architectures and the incremental representation adapters. -->
# Terrain representation — Phase 1

## Architecture findings (before implementation)

`ProceduralVoxelWorldRuntime` owns a stable terrain group, a deterministic `VoxelTerrainGenerator`, a palette, an analytic collider and `VoxelChunkManager`. The generator composes procedural/geographic base occupancy, path grading and bounded vegetation. Chunks use 0.25 m cells and 32 cells per axis. Definitions, seeds, dimensions, geographic snapshots and environmental parameters serialize into the HTML world document. Existing geographic version-2 streaming is cooperative.

`TerrainTool/terrainSurfaceMesh` instead stores a centered regular height/color grid and generates indexed triangles. It has no general occupancy field or caves. Its serialized `terrain-surface` definition retains heights, dimensions and material metadata. These systems share Three.js/world management but not a generation model or coordinate origin convention.

`worldLoading` classifies definitions explicitly, registers logical world objects and installs history bridges. `worldSave` serializes their definitions into HTML. GOX and STL/glTF/GLB use separate linked-asset loaders and source references; they must never enter terrain conversion. Paths have their own runtime and apply constraints to the procedural field. Existing View widgets and the command registry provide the integration points; no new global shortcut is needed.

## Implementation approach

Retain the source models and stable objects. Procedural terrain derives polygonal surfaces from its existing occupancy using a single surface-net adapter with shared global sample coordinates and a one-cell halo. The legacy polygonal grid receives a 0.25 m voxel-column display adapter, while its original height/color grid stays authoritative. Representation state is per terrain instance; missing state defaults to the original rendering behavior.

Surface-net background: [Gibson, Constrained Elastic SurfaceNets](https://www.merl.com/publications/TR99-24/). This implementation uses cell-local averages of sign-changing edge midpoints, not the paper's iterative elastic relaxation. No source code from the paper is copied.


## Shared contract and ownership

Only explicit `procedural-voxel-world` and `terrain-surface` definitions are admitted by the authoring bridge. Both expose `object.userData.terrainRuntime` with `representation`, asynchronous `setRepresentation`, `ready`, `dispose`, and a `data` adapter. Data supplies identity, source kind, origin, dimensions, seed where present, source parameters, materials and height sampling. Occupancy and biome queries are optional capabilities of the procedural adapter. Grid origins remain centered; procedural origins retain their existing corner and height-offset convention. Neither source model is rewritten to pretend it is the other.

The existing procedural runtime remains available as `proceduralVoxelRuntime` for paths, tools, seasons, water and streaming. Meshes are derived resources. No imported mesh is discovered or converted by scene traversal. Linked GOX/glTF/GLB instances retain their model runtime; STL uses the existing `object-file` loader. Source files and provenance are untouched.

## Meshing, switching and collision

The procedural adapter samples the same generated occupancy, including graded terrain, cavities, vegetation and water. A single surface-net algorithm places a vertex within each mixed occupancy cell and joins neighboring vertices around sign-changing edges. Solids and liquids are extracted separately. Material groups use the occupied side's existing palette index. A halo and occupied-endpoint edge ownership give neighboring chunks identical boundary vertices and normals. Vertex fractions are quantized to a fine binary grid (1/16384 m) to avoid different Float32 rounding on opposite sides of a chunk boundary. This is connected geometry, not the old cubic faces with different shading.

Legacy grids use their original triangle-interpolated heights to derive quarter-meter voxel columns, with clipped outer cells preserving the original footprint. Adjacent equal-height walls are omitted; exposed vertical walls are merged. The original height/color grid and original polygonal geometry remain available, so switching back does not regenerate or resample the original surface. Colors in voxel mode are sampled from the source grid.

Switching retains the old display while bounded replacement geometry is prepared cooperatively. Resident procedural chunks commit together; hidden staging meshes do not participate in picking or collision. The generator and shared palette survive switches. Old derived buffers are disposed after commit. A superseding request, disposal or terrain-data invalidation cancels stale work. Changed paths and seasons continue through the existing chunk invalidation pipeline. Inactive procedural geometry is not retained indefinitely; switching remeshes the cached deterministic field rather than creating a new seeded world.

Polygonal ground queries raycast the active solid terrain triangles. Body contact uses conservative player-box/triangle tests against those meshes, including overhead rock. Liquid groups do not become solid colliders. The collider object remains stable across swaps. Before a streamed polygonal surface arrives, procedural terrain retains analytic ground support to avoid falling through an unloaded region. Voxel mode retains its existing occupancy collision. Legacy grids now use their actual active mesh for terrain contact instead of an enclosing box. Imported colliders are unchanged. The switch does not teleport the player; ordinary movement grounding handles the small surface-height differences.

## Controls and persistence

Open **View → Terrain Representation** in the world editor. Choose the generated terrain instance, then **Voxel** or **Polygonal**. Native selects expose the current choice and support keyboard focus/arrows; preparation and failures appear in a status output. No shortcut was added. The same action is registered as `terrain.representation`, with arguments `mode` (`list`, `voxel`, `polygonal`) and optional terrain `id`. Omitting the ID is allowed when there is exactly one generated terrain. The terminal/command palette can discover this action through the existing registry.

The active choice is persisted as `representation` on the terrain definition. Legacy grid metadata also retains it. Definitions without the field default to voxel for procedural worlds and polygonal for grids. Source seeds, dimensions, elevations and geographic versions are unchanged. The existing history bridge records the old state immediately before a successful commit; rejected/canceled preparation adds no undo entry. Normal dirty-document notifications and the existing Ctrl+S save workflow are reused. Camera/player transforms, world time, panels and linked objects are not reinitialized by switching.

## Validation

- All 25 focused test files passed: terrain representation, procedural voxel, geographic, Aegean, paths, command registry and terrain materials.
- The seven new representation tests cover shared seam positions/normals, closed-surface edge connectivity, chunk-boundary feature ownership, cavity and liquid surfaces, triangle-based ground contact, atomic swaps, buffer disposal, legacy-grid coordinates/roundtrips, explicit ownership, rapid switching and cancellation during disposal.
- Chromium loads real GOX, STL, glTF and GLB fixtures through their existing loaders, then switches an eight-chunk terrain repeatedly. Object/geometry identity, transforms, source-read counts, camera/environment and collider counts remain unchanged. It also checks the View control, existing HTML save API and reopen, both legacy defaults, and undo/redo for both source models. The save API is the one used by Ctrl+S; the fixture does not synthesize the Ctrl+S keyboard shortcut.
- The existing path browser workflow passes, including native input, grading, collision, save/reload and history. The geographic browser workflow also passes worker import, KML preview, placement, undo/redo, offline HTML reload and its existing 5 km traversal workload.

Reproduce:

```sh
node --experimental-loader ./scripts/html-test-loader.mjs --test \
  ApplicationSystem/public/MetaWorld/TerrainRepresentation/*.test.mjs \
  ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Geographic/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Aegean/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Paths/*.test.mjs \
  ApplicationSystem/public/Commands/NodevisionCommandRegistry.test.mjs \
  ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/*.test.mjs
python3 scripts/test-terrain-representation-browser.py
python3 scripts/test-paths-browser.py
# Requires the synthetic TIFF fixtures described in GeographicTerrain.md:
python3 scripts/test-geographic-browser.py
```

The final eight-chunk Chromium run took 375–1910 ms per switch, including preparation and render submission, while the previous geometry stayed visible. Rendered geometry counts stayed at 9 throughout all five switches. These are headless software-renderer measurements, not a hardware-GPU frame-rate guarantee. [Raw report](benchmarks/terrain-representation-browser.json).

## Limits and next iteration

- The selector supports logical `procedural-voxel-world` and `terrain-surface` instances. Loose legacy terrain-tool box tiles and equation/function surfaces are not aggregated or converted in this phase.
- Surface nets round the occupancy boundary rather than preserving exact voxel corners. Very thin or diagonally touching features can change shape/connectivity; this initial binary extractor does not guarantee manifold topology for every ambiguous occupancy pattern. The original field, caves and vegetation remain stored/generated unchanged; switching back restores their voxel rendering. There is no polygonal sculpting or arbitrary-model conversion.
- Polygonal body collision is a conservative box/triangle test, not a new physics engine. It may constrain movement near narrow features more than an exact capsule test. Liquid-volume physics continues to use the existing occupancy implementation.
- The existing procedural chunk radius and residency caps remain; no distant LOD is added. Replacement buffers are capped at 128 MiB, in addition to the currently displayed geometry. Cooperative preparation targets 4 ms slices, but individual generator steps, buffer creation and garbage collection can exceed that target.
- Legacy grids are not streamed in the original implementation. Their voxel adapter admits at most 65,536 quarter-meter columns (64 m × 64 m for a square grid) to bound allocation, and reports an error while retaining the original surface if exceeded. This limit does not apply to streamed procedural/geographic worlds. Source grids and saves are retained exactly, but displayed voxel heights/colors are a quantized approximation.
- Resource measurements track rendered geometry counts and explicit disposal; they are not a process-memory or long-duration leak guarantee. Next steps should add accelerated polygonal collision queries, broader topology/feature tests and streamed legacy-grid voxelization before raising its budget. A bounded inactive-geometry cache could reduce repeat-switch latency if profiling justifies the extra memory.

## Files

Added under `ApplicationSystem/public/MetaWorld/TerrainRepresentation/`: `TerrainData.mjs`, `Representation.mjs`, `SurfaceNets.mjs`, `ChunkRepresentation.mjs`, `MeshCollision.mjs`, `GridVoxels.mjs`, `GridRepresentation.mjs`, `GridDefinition.mjs`, `Authoring.mjs`, `Command.mjs`, and `Representation.test.mjs`.

Integration changes: `ProceduralVoxelWorldRuntime.mjs`, `VoxelWorldDefinition.mjs`, `WorldAuthoringPermissions.mjs`, `TerrainTool/terrainSurfaceMesh.mjs`, `TerrainTool/terrainTilePainter.mjs`, `worldLoading.mjs`, `worldSave.mjs`, `Commands/CommandDefinitions.mjs`, `Commands/NodevisionCommandRegistry.mjs`, `ToolbarJSONfiles/viewToolbar.json`, and the new `terrainRepresentationWidget.mjs`.

Evidence: this document, `scripts/terrain-representation-browser.mjs`, `scripts/test-terrain-representation-browser.py`, and `docs/benchmarks/terrain-representation-browser.json`. The earlier path-turn fix remains a separate change in the workspace.
