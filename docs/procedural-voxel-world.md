# Procedural voxel terrain infrastructure

This implementation adds a finite, deterministic, read-only terrain field to normal Game View. It does not add a Sandbox Focus Session. Copy [the example HTML](examples/procedural-voxel-world.html) into a notebook through the normal file workflow, then open Virtual World. The loader raises a below-ground spawn onto the terrain. `metadata.objectGroundOnly: true` removes the legacy fallback floor.

## Architecture found during reconnaissance

`MetaWorldLoader.mjs` validates embedded JSON and expands authored `voxel-pattern` definitions. Normal Game View also has a legacy conversion/loading path in `worldLoading.mjs`, with its own pattern expansion. Both need recognition of the new object before pattern expansion. Arrays are the existing object position/size convention; the top-level spawn uses `{x,y,z}`.

Game View keeps separate arrays for logical objects and colliders. Equation planes and expression layers already demonstrate specialized rendering and analytic collision. `TerrainGroundAbility` samples `expression-heightfield.sampleGroundY`, and `collisionCheck` handles movement against these surfaces. The existing polygonal `terrain-surface` runtime uses grid geometry and a box collider; it is not a chunk streamer. No reusable seeded terrain/chunk system was found. Module Map maps document extensions to panels, so this object subtype does not require a new entry.

`VoxelPlacementAbility` creates ordinary cube meshes and material-tagged box colliders. `VoxelRemovalAbility` recognizes `isVoxel`, `voxel`, and `voxelPlacer`; generated chunks deliberately carry none of these. Existing authored voxel serialization and compaction stay separate. Materials reuse grass, soil, and limestone catalog identities with opaque standard rendering.

The layer bridge stores declarative object history snapshots and owns visibility/deletion. `serializeMesh` is the save boundary. The Game View update loop already returns while paused, and panel/world teardown already visits logical objects. These APIs now invoke the procedural runtime. Picking previously filtered to meshes and used nonrecursive raycasting; terrain groups now forward placement rays to chunk meshes without adding those meshes to the object array.

## Definition and coordinates

The implemented object schema is the one in the example: required stable `id`, type `procedural-voxel-world`, `position` (default `[0,0,0]`), three positive `size` values, `voxelSize: 0.25`, trusted generator `{id:"nodevision-terrain-v1",version:1,seed}`, and `chunks:{voxelsPerAxis:32,loadRadius}`. Existing `name`, `visible`, and `hidden` fields remain usable.

The seed must be a signed 32-bit integer. Load radius must be an integer from 1 through 8. Dimensions must be finite positive multiples of 0.25, at most 4096 meters per axis, with at least 1 meter horizontally to fit the player. Position is bounded to ±1,000,000 meters. Nonidentity rotation and scale are rejected. Version 1 intentionally requires exactly 0.25 m voxels and exactly 32 cells per chunk edge. Generator selection never evaluates world-supplied code.

Position is the minimum corner of the field, unlike center-based ordinary boxes. Size describes its finite volume. Integer cell `[0,0,0]` occupies the half-open meter interval from position through position + 0.25. `VoxelCoordinates.mjs` owns floor-based meter/cell/chunk/local conversions, including negative coordinates. The example is 4000 × 512 × 4000 cells and 125 × 16 × 125 possible chunks; none of those entire domains is enumerated.

## Generation, meshing, and residency

The trusted versioned generator combines two smooth, integer-hashed noise scales. Height is the number of solid cells in a column; `getVoxel` returns air (0), grass (1), dirt (2), or stone (3). The top cell is grass, the next four are dirt, and lower cells are stone. Heights are clipped to world size. Queries do not depend on Three.js, residency, or traversal order. `generateChunk` returns a temporary 32³ byte array.

A chunk is 8 m per edge. `VoxelChunkManager` maintains integer keys, a nearest-first queue, and a one-chunk-per-update work limit. It requests a square horizontal radius and uses the generator's conservative vertical occupancy bound (at most 108 cells, four chunks in v1). A one-chunk hysteresis margin avoids churn at boundaries. At radius 8, stationary interior residency is 17 × 17 × 4 = 1156 records; moving residency is bounded by 19 × 19 × 4 = 1444. Empty and fully enclosed chunks can have no mesh. Voxel arrays are discarded after meshing.

`VoxelChunkMesher` emits only exposed faces and queries the deterministic generator across chunk boundaries. One indexed mesh per nonempty surface chunk shares one terrain material. Grass/dirt/stone use vertex colors; internal solid faces are absent. The bottom and finite outer sides are rendered too. There is no greedy meshing or per-voxel scene object, material, or collider.

## Collision, lifecycle, identity, and saving

One analytic `expression-heightfield` collider represents the field. It samples the same quantized column tops used by generation, independently of loaded graphics, using existing step/snap movement. Its finite horizontal boundary blocks player escape. This is a heightfield walking MVP, not an arbitrary solid voxel collision implementation. Spawn positions are clamped inside the terrain and lifted if buried.

One group is added to `objects` and one entry to Layers. Chunk children carry `proceduralTerrainId`, integer `proceduralChunk`, and `runtimeGenerated`, and remain absent from world objects and layer entries. Layer visibility disables rendering, ground sampling, and residency updates. Layer deletion, undo/redo rebuilding, world replacement, STL switching, and panel disposal release chunk geometries, the shared material, and the collider. Disposal is idempotent; there are no runtime listeners or independent animation loops. The existing paused update gate also stops chunk generation.

Save returns the compact declarative definition plus current translation/visibility. The serializer explicitly rejects generated children. It cannot export resident geometry or voxel buffers through normal world save. History stores the same compact definition and regenerates resources on restore. Ordinary objects and authored pattern expansion/compaction remain on their original paths.

Generated chunks occlude inspection/editing rays but are read-only to the current generic editing tools. `getInspectHit({includeProceduralTerrain:true})` is an explicit future integration hook; placement rays can already hit generated surfaces and place ordinary authored objects. The generic object inspector rejects terrain roots/chunks because it clones and edits ordinary scene objects. Layers still owns whole-field visibility, deletion, and history. Edit terrain settings in declarative JSON for this milestone.

## Measurements and verification

The [browser measurements](procedural-voxel-performance.json) are produced by the checked-in Electron harness with SwiftShader software WebGL. They report stationary interior radius-8 residency, cumulative generation/meshing milliseconds, peak chunk build time, resident solid voxel and exposed-face counts, geometry bytes, and a rendered-frame triangle count. `root.userData.proceduralVoxelRuntime.stats` exposes these counters without per-frame logging. `voxels` counts solid cells processed in resident chunks, not retained voxel arrays. `meshingMs` includes geometry/color construction; GPU upload is outside these timings.

The initial measured full area had 1156 chunk records, 642 meshes, 22,281,767 solid cells processed, and 654,640 exposed faces. The final cold build took approximately 4.5 seconds total (581 ms generation, 3940 ms meshing/geometry), with a 53 ms worst chunk and 102,123,840 bytes of geometry buffers. The terrain used one collider alongside the authored box collider. This harness drains the queue immediately to measure total work; normal Game View spreads it across updates (at least 1156 updates from empty at this radius). Measurements are machine-dependent and do not establish a smooth-frame guarantee. See the JSON for the final run.

Commands:

```sh
node ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorld.test.mjs
node --test ApplicationSystem/server/routes/worldRoutes.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPauseState.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/createWorldRenderer.test.mjs
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
```

Verification completed successfully: seven focused tests, three existing test files (world routes, pause state, renderer creation), the procedural browser harness, and the existing `world-browser.mjs` suite. The latter also checks ordinary object transforms, save/reload, infinite-plane collision/rendering, deletion history, and scoped pause/menu/input integration. Run it with `NV_WORLD_BROWSER=world-browser.mjs` using the same Electron runner.

Seven focused tests cover validation/rejection, coordinate boundaries, deterministic seeds/chunks, internal and cross-chunk face suppression, unload/reload identity, disposal, and unchanged ordinary/pattern validation. The browser harness uses real Three.js, Game View loading, directional/ground movement, layer history, and HTML saving with an in-memory fetch backend. It walks 150 m, checks finite bounds, returns to regenerate identical chunks, renders triangles, raycasts, verifies compact save/reload and ordinary object preservation, exercises delete/undo/redo, and verifies authored voxel expansion and compaction. It does not drive keyboard input through the complete application shell or measure production GPU performance.

## Limitations and next milestone

Generation/meshing remains synchronous with a fixed chunk work bound, not a hard millisecond deadline. Cold chunks can exceed a frame budget, and the full radius takes time to populate. Move pure generation and meshing to a worker with request generations/cancellation and a bounded upload queue next for smoother frames. The manager already separates residency from build/release ownership.

Version 1 supports one finite walking field per world as the intended configuration; multiple independent fields have intersecting boundary restrictions and independent generation budgets. It assumes upright flat-gravity movement, opaque materials, translation-only terrain, and no caves/overhangs. The underlying fallback floor remains an existing world choice; use object-ground-only mode for negative terrain elevations. Terrain roots are not editable through the generic mesh inspector. No edits, deltas, structures, biome changes, mobs, or Sandbox UI are included.

The smallest functional next milestone is sparse voxel overrides keyed by terrain ID and integer coordinates. Breaking stores air; placement stores a material override. Generator queries consult overrides first. A changed cell invalidates its chunk and adjacent chunks when on a boundary, then remeshes through the existing manager. Hit point ± a small face-normal offset converts through `VoxelCoordinates` to the affected cell. Persist only overrides plus the current generator definition, and add override-aware collision before permitting edits that invalidate the heightfield assumption. Connect existing voxel tools through the explicit terrain hit identity, retaining authored voxel behavior.

## Files

Added under `ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/`: definition validation, coordinate utilities, deterministic generator, chunk mesher, chunk manager, runtime, and focused tests. All new native modules remain below 200 nonblank/noncomment lines and have path/purpose comments.

Changed integration files: `MetaWorldLoader.mjs`; Game View `worldLoading.mjs`, `worldSave.mjs`, `initScene.mjs`, `collisionCheck.mjs`, `objectInspector.mjs`, `Abilities/InspectionModificationAbilities/PickingAbility.mjs`, `Abilities/InspectionModificationAbilities/InspectionTargetingAbility.mjs`; and `GameView.mjs`. Existing oversized modules receive only integration hooks. Added the browser harness/runner, this document, the example HTML, and measured results. Pre-existing unrelated workspace edits were preserved.
